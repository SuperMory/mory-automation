// picker.js - High-Precision Selection Engine with Real-time Magnifier and 1px Arrow Control

(function () {
  if (window.__MORY_PICKER_INSTALLED__) return;
  window.__MORY_PICKER_INSTALLED__ = true;

  let currentMode = null; // 'coordinate' | 'region' | 'snip' | 'color'
  let overlayEl = null;
  let crosshairH = null;
  let crosshairV = null;
  let bannerEl = null;
  let selectionBoxEl = null;
  let magnifierEl = null;
  let magnifierCanvas = null;
  let magnifierCtx = null;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let callbackId = null;

  // Background screenshot snapshot for crisp pixel magnification
  let snapshotImg = null;
  let snapshotCanvas = null;
  let snapshotCtx = null;
  let snapshotPromise = null;

  function loadSnapshot(dataUrl) {
    if (!dataUrl) return;
    snapshotPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        snapshotImg = img;
        snapshotCanvas = document.createElement('canvas');
        snapshotCanvas.width = img.width;
        snapshotCanvas.height = img.height;
        snapshotCtx = snapshotCanvas.getContext('2d');
        snapshotCtx.drawImage(img, 0, 0);
        updateMagnifier(currentX, currentY);
        resolve(true);
      };
      img.onerror = (err) => {
        console.warn('[Mory RPA] 加载预截屏图片失败:', err);
        resolve(false);
      };
      img.src = dataUrl;
    });
  }

  // Cleanup helper
  function cleanup() {
    currentMode = null;
    isDragging = false;

    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    window.removeEventListener('keydown', onKeyDown, true);

    if (overlayEl) overlayEl.remove();
    if (crosshairH) crosshairH.remove();
    if (crosshairV) crosshairV.remove();
    if (bannerEl) bannerEl.remove();
    if (selectionBoxEl) selectionBoxEl.remove();
    if (magnifierEl) magnifierEl.remove();

    overlayEl = null;
    crosshairH = null;
    crosshairV = null;
    bannerEl = null;
    selectionBoxEl = null;
    magnifierEl = null;
    magnifierCanvas = null;
    magnifierCtx = null;
    snapshotImg = null;
    snapshotCanvas = null;
    snapshotCtx = null;
    snapshotPromise = null;
  }

  // Keyboard navigation & 1px fine-tuning
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
      chrome.runtime.sendMessage({
        type: 'PICKER_RESULT',
        payload: { callbackId, canceled: true }
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      confirmSelection();
      return;
    }

    // 1px arrow key movements (Shift = 10px)
    const step = e.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;

    if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;

    if (dx !== 0 || dy !== 0) {
      e.preventDefault();
      e.stopPropagation();

      currentX = Math.max(0, Math.min(window.innerWidth - 1, currentX + dx));
      currentY = Math.max(0, Math.min(window.innerHeight - 1, currentY + dy));

      updateCrosshairs(currentX, currentY);
      updateMagnifier(currentX, currentY);

      if (isDragging) {
        updateSelectionBox();
      }
    }
  }

  function updateCrosshairs(x, y) {
    if (crosshairH) crosshairH.style.top = `${y}px`;
    if (crosshairV) crosshairV.style.left = `${x}px`;
  }

  function updateBannerInfo(text) {
    if (!bannerEl) return;
    const infoSpan = bannerEl.querySelector('.mory-banner-text');
    if (infoSpan) infoSpan.textContent = text;
  }

  // Real-time Magnifier updater (shows 5x pixel zoom, color hex, and coord)
  function updateMagnifier(x, y) {
    if (!magnifierEl || !magnifierCanvas || !magnifierCtx) return;

    // Smart repositioning to avoid blocking user's cursor / box
    const magSize = 130;
    const padding = 20;
    let magLeft = x + padding;
    let magTop = y + padding;

    if (magLeft + magSize > window.innerWidth) {
      magLeft = x - magSize - padding;
    }
    if (magTop + magSize + 40 > window.innerHeight) {
      magTop = y - magSize - 40;
    }

    magnifierEl.style.left = `${magLeft}px`;
    magnifierEl.style.top = `${magTop}px`;

    // Draw magnified pixels
    const sampleSize = 24; // 24x24 px source
    const dpr = window.devicePixelRatio || 1;

    magnifierCtx.imageSmoothingEnabled = false;
    magnifierCtx.clearRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);

    let hexColor = '#888888';
    let rgbText = 'RGB(128,128,128)';

    if (snapshotCanvas && snapshotCtx) {
      const scaleX = snapshotCanvas.width / (window.innerWidth || 1);
      const scaleY = snapshotCanvas.height / (window.innerHeight || 1);
      const physX = Math.round(x * scaleX);
      const physY = Math.round(y * scaleY);
      const srcX = Math.round(physX - sampleSize / 2);
      const srcY = Math.round(physY - sampleSize / 2);

      magnifierCtx.drawImage(
        snapshotCanvas,
        srcX,
        srcY,
        sampleSize,
        sampleSize,
        0,
        0,
        magnifierCanvas.width,
        magnifierCanvas.height
      );

      // Read center pixel color directly from unscaled physical pixel
      try {
        const clampedX = Math.max(0, Math.min(snapshotCanvas.width - 1, physX));
        const clampedY = Math.max(0, Math.min(snapshotCanvas.height - 1, physY));
        const p = snapshotCtx.getImageData(clampedX, clampedY, 1, 1).data;
        hexColor = `#${((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase()}`;
        rgbText = `RGB(${p[0]}, ${p[1]}, ${p[2]})`;
      } catch (e) {}
    } else {
      // Fallback grid pattern
      magnifierCtx.fillStyle = '#1e293b';
      magnifierCtx.fillRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
    }

    // Draw center crosshair target in magnifier
    const cx = magnifierCanvas.width / 2;
    const cy = magnifierCanvas.height / 2;
    magnifierCtx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    magnifierCtx.lineWidth = 1.5;
    magnifierCtx.strokeRect(cx - 3, cy - 3, 6, 6);

    // Update info text
    const colorThumb = magnifierEl.querySelector('.mory-mag-color-thumb');
    const colorText = magnifierEl.querySelector('.mory-mag-color-hex');
    const coordText = magnifierEl.querySelector('.mory-mag-coords');

    if (colorThumb) colorThumb.style.backgroundColor = hexColor;
    if (colorText) colorText.textContent = hexColor;
    if (coordText) coordText.textContent = `(${x}, ${y})`;
  }

  function updateSelectionBox() {
    if (!selectionBoxEl) return;
    const minX = Math.min(startX, currentX);
    const minY = Math.min(startY, currentY);
    const maxX = Math.max(startX, currentX);
    const maxY = Math.max(startY, currentY);
    const width = maxX - minX;
    const height = maxY - minY;

    selectionBoxEl.style.display = 'block';
    selectionBoxEl.style.left = `${minX}px`;
    selectionBoxEl.style.top = `${minY}px`;
    selectionBoxEl.style.width = `${width}px`;
    selectionBoxEl.style.height = `${height}px`;

    updateBannerInfo(`选区尺寸: ${width} × ${height} 像素 [(${minX}, ${minY}) 到 (${maxX}, ${maxY})] (可用方向键微调，松开/Enter确认)`);
  }

  async function confirmSelection() {
    if (snapshotPromise) {
      try {
        await snapshotPromise;
      } catch (e) {}
    }

    if (currentMode === 'coordinate') {
      const result = { x: currentX, y: currentY, canceled: false, callbackId };
      cleanup();
      chrome.runtime.sendMessage({ type: 'PICKER_RESULT', payload: result });
      return;
    }

    const scaleX = (snapshotCanvas && window.innerWidth) ? (snapshotCanvas.width / window.innerWidth) : (window.devicePixelRatio || 1);
    const scaleY = (snapshotCanvas && window.innerHeight) ? (snapshotCanvas.height / window.innerHeight) : (window.devicePixelRatio || 1);
    const dpr = window.devicePixelRatio || 1;

    if (currentMode === 'color') {
      let hexColor = '#FFFFFF';
      if (snapshotCanvas && snapshotCtx) {
        const sx = Math.max(0, Math.min(snapshotCanvas.width - 1, Math.round(currentX * scaleX)));
        const sy = Math.max(0, Math.min(snapshotCanvas.height - 1, Math.round(currentY * scaleY)));
        const p = snapshotCtx.getImageData(sx, sy, 1, 1).data;
        hexColor = `#${((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1).toUpperCase()}`;
      }
      const result = { x: currentX, y: currentY, color: hexColor, canceled: false, callbackId };
      cleanup();
      chrome.runtime.sendMessage({ type: 'PICKER_RESULT', payload: result });
      return;
    }

    // Region or Snip
    const x1 = Math.min(startX, currentX);
    const y1 = Math.min(startY, currentY);
    const x2 = Math.max(startX, currentX);
    const y2 = Math.max(startY, currentY);
    const width = x2 - x1;
    const height = y2 - y1;

    if (width < 4 || height < 4) {
      updateBannerInfo('选区过小，请按住鼠标左键拖拽拉出一个矩形范围');
      return;
    }

    let croppedDataUrl = '';

    if (currentMode === 'snip' && snapshotCanvas) {
      try {
        const cropX = Math.round(x1 * scaleX);
        const cropY = Math.round(y1 * scaleY);
        const cropW = Math.max(1, Math.round(width * scaleX));
        const cropH = Math.max(1, Math.round(height * scaleY));
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(
          snapshotCanvas,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          cropW,
          cropH
        );
        croppedDataUrl = cropCanvas.toDataURL('image/png');
      } catch (err) {
        console.warn('[Mory RPA] 截图裁剪异常:', err);
      }
    }

    const result = {
      x1,
      y1,
      x2,
      y2,
      width,
      height,
      dpr,
      croppedDataUrl,
      mode: currentMode,
      canceled: false,
      callbackId
    };

    cleanup();
    chrome.runtime.sendMessage({ type: 'PICKER_RESULT', payload: result });
  }

  // Create UI overlay elements
  function initOverlay(mode, title, preCapturedDataUrl) {
    cleanup();
    currentMode = mode;
    currentX = Math.round(window.innerWidth / 2);
    currentY = Math.round(window.innerHeight / 2);

    overlayEl = document.createElement('div');
    overlayEl.id = 'mory-picker-overlay';

    // Top instruction banner
    bannerEl = document.createElement('div');
    bannerEl.id = 'mory-picker-banner';
    bannerEl.innerHTML = `
      <span class="mory-badge">Mory RPA</span>
      <span class="mory-banner-text">${title} (支持方向键微调1像素, Shift微调10像素)</span>
      <button type="button" class="mory-cancel-btn">取消 (ESC)</button>
    `;
    bannerEl.querySelector('.mory-cancel-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      cleanup();
      chrome.runtime.sendMessage({
        type: 'PICKER_RESULT',
        payload: { callbackId, canceled: true }
      });
    });

    // Crosshairs
    crosshairH = document.createElement('div');
    crosshairH.id = 'mory-picker-crosshair-h';
    crosshairV = document.createElement('div');
    crosshairV.id = 'mory-picker-crosshair-v';

    // Selection box for region
    selectionBoxEl = document.createElement('div');
    selectionBoxEl.id = 'mory-selection-box';

    // Floating Magnifier Widget
    magnifierEl = document.createElement('div');
    magnifierEl.id = 'mory-magnifier';
    magnifierEl.innerHTML = `
      <canvas class="mory-mag-canvas" width="110" height="110"></canvas>
      <div class="mory-mag-meta">
        <div class="mory-mag-row">
          <span class="mory-mag-color-thumb"></span>
          <span class="mory-mag-color-hex">#000000</span>
        </div>
        <div class="mory-mag-coords">(0, 0)</div>
      </div>
    `;
    magnifierCanvas = magnifierEl.querySelector('.mory-mag-canvas');
    magnifierCtx = magnifierCanvas.getContext('2d');

    document.body.appendChild(overlayEl);
    document.body.appendChild(bannerEl);
    document.body.appendChild(crosshairH);
    document.body.appendChild(crosshairV);
    document.body.appendChild(selectionBoxEl);
    document.body.appendChild(magnifierEl);

    // If pristine tab capture was provided by background service worker, load it immediately!
    if (preCapturedDataUrl) {
      loadSnapshot(preCapturedDataUrl);
    } else {
      // Fallback: request tab capture from background
      chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' }, (res) => {
        if (res && res.success && res.dataUrl) {
          loadSnapshot(res.dataUrl);
        }
      });
    }

    // Global event listeners
    window.addEventListener('keydown', onKeyDown, true);
    overlayEl.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);

    updateCrosshairs(currentX, currentY);
    updateMagnifier(currentX, currentY);
  }

  function onMouseMove(e) {
    if (!overlayEl) return;
    currentX = Math.round(e.clientX);
    currentY = Math.round(e.clientY);

    updateCrosshairs(currentX, currentY);
    updateMagnifier(currentX, currentY);

    if (currentMode === 'coordinate') {
      updateBannerInfo(`目标坐标: (X: ${currentX}, Y: ${currentY}) —— 单击鼠标左键或按Enter确认`);
    } else if (currentMode === 'color') {
      updateBannerInfo(`取色光标: (${currentX}, ${currentY}) —— 单击鼠标左键确认取色`);
    } else if (isDragging) {
      updateSelectionBox();
    } else {
      updateBannerInfo(`当前光标: (${currentX}, ${currentY}) —— 请按住鼠标左键拖拽拉出选区框 (可用键盘方向键微调1像素)`);
    }
  }

  function onMouseDown(e) {
    if (e.button !== 0) return; // Left button only
    e.preventDefault();
    e.stopPropagation();

    currentX = Math.round(e.clientX);
    currentY = Math.round(e.clientY);

    if (currentMode === 'coordinate' || currentMode === 'color') {
      confirmSelection();
      return;
    }

    // Region or snip mode: start dragging
    isDragging = true;
    startX = currentX;
    startY = currentY;

    if (selectionBoxEl) {
      selectionBoxEl.style.display = 'block';
      selectionBoxEl.style.left = `${currentX}px`;
      selectionBoxEl.style.top = `${currentY}px`;
      selectionBoxEl.style.width = '0px';
      selectionBoxEl.style.height = '0px';
    }
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();

    isDragging = false;
    currentX = Math.round(e.clientX || currentX);
    currentY = Math.round(e.clientY || currentY);

    confirmSelection();
  }

  // Public methods on window
  window.__MORY_PICKER__ = {
    startPickCoordinate: function (cbId, preDataUrl) {
      callbackId = cbId;
      initOverlay('coordinate', '移动鼠标到目标位置，单击鼠标左键确认坐标', preDataUrl);
    },
    startPickRegion: function (cbId, preDataUrl) {
      callbackId = cbId;
      initOverlay('region', '请按住鼠标左键并拖拽拉出选区框，松开完成选取', preDataUrl);
    },
    startScreenSnip: function (cbId, preDataUrl) {
      callbackId = cbId;
      initOverlay('snip', '请按住鼠标左键框选要查找的图片目标，松开完成截取', preDataUrl);
    },
    startPickColor: function (cbId, preDataUrl) {
      callbackId = cbId;
      initOverlay('color', '移动准星对准要提取颜色的像素，单击确认取色', preDataUrl);
    },
    cancel: function () {
      cleanup();
    }
  };
})();
