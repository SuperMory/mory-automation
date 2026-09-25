// content.js - Automation execution layer injected into web pages

(function () {
  if (window.__MORY_CONTENT_INSTALLED__) return;
  window.__MORY_CONTENT_INSTALLED__ = true;

  let virtualCursor = null;
  let cursorX = window.innerWidth / 2;
  let cursorY = window.innerHeight / 2;

  // Track user's actual mouse movement so "click at current mouse position" matches reality
  window.addEventListener('mousemove', (e) => {
    if (!e.isTrusted) return;
    cursorX = e.clientX;
    cursorY = e.clientY;
  }, { passive: true, capture: true });

  // Ensure virtual cursor DOM element exists
  function ensureVirtualCursor() {
    if (virtualCursor && document.body.contains(virtualCursor)) return virtualCursor;

    virtualCursor = document.createElement('div');
    virtualCursor.id = 'mory-virtual-cursor';
    // Sleek modern SVG pointer cursor
    virtualCursor.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 3L11.5 21L14.5 13.5L22 10.5L4 3Z" fill="#10B981" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    `;
    virtualCursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
    document.body.appendChild(virtualCursor);
    return virtualCursor;
  }

  // Create temporary click ripple animation
  function createRipple(x, y, buttonType = 'left') {
    const ripple = document.createElement('div');
    ripple.className = `mory-click-ripple ${buttonType}`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  }

  // Show floating status badge
  function showFloatingBadge(x, y, text, icon = '⚡') {
    const badge = document.createElement('div');
    badge.className = 'mory-indicator-badge';
    badge.innerHTML = `<span>${icon}</span><span>${text}</span>`;
    badge.style.left = `${Math.min(Math.max(10, x + 20), window.innerWidth - 180)}px`;
    badge.style.top = `${Math.min(Math.max(10, y + 20), window.innerHeight - 50)}px`;
    document.body.appendChild(badge);
    setTimeout(() => {
      badge.style.opacity = '0';
      badge.style.transition = 'opacity 0.4s';
      setTimeout(() => badge.remove(), 400);
    }, 1200);
  }

  // Highlight a rectangle on the web page (e.g. found image / text match)
  function highlightBox(rect, label = '目标命中') {
    const box = document.createElement('div');
    box.className = 'mory-highlight-box';
    box.style.left = `${rect.x}px`;
    box.style.top = `${rect.y}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;

    const tag = document.createElement('div');
    tag.className = 'mory-highlight-label';
    tag.textContent = label;
    box.appendChild(tag);

    document.body.appendChild(box);
    setTimeout(() => {
      box.style.transition = 'opacity 0.6s';
      box.style.opacity = '0';
      setTimeout(() => box.remove(), 600);
    }, 2500);
  }

  // Dispatch synthetic keyboard modifier events
  function buildModifierEventInit(modifiers = {}) {
    return {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      ctrlKey: !!(modifiers.leftCtrl || modifiers.rightCtrl),
      shiftKey: !!(modifiers.leftShift || modifiers.rightShift),
      altKey: !!(modifiers.leftAlt || modifiers.rightAlt),
      metaKey: !!(modifiers.leftWin || modifiers.rightWin)
    };
  }

  // Accurate text similarity calculation with full substring matching support
  function calcTextSimilarity(source, target) {
    if (!source || !target) return 0;
    const s = String(source).toLowerCase().replace(/\s+/g, ' ').trim();
    const t = String(target).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!s || !t) return 0;
    if (s === t) return 100;

    // Substring exact match: target is within source (e.g. "确认登录" in "🟢 确认登录 (点击我)")
    if (s.includes(t)) {
      const diffLen = s.length - t.length;
      return Math.max(92, Math.round(100 - Math.min(8, diffLen * 0.4)));
    }
    if (t.includes(s)) {
      return Math.max(85, Math.round((s.length / t.length) * 100));
    }

    // Levenshtein Distance for fuzzy matching
    const matrix = [];
    for (let i = 0; i <= s.length; i++) matrix[i] = [i];
    for (let j = 0; j <= t.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= s.length; i++) {
      for (let j = 1; j <= t.length; j++) {
        if (s[i - 1] === t[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    const dist = matrix[s.length][t.length];
    const maxLen = Math.max(s.length, t.length);
    return Math.max(0, Math.round((1 - dist / maxLen) * 100));
  }

  // Listen for actions from Background / Designer
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { action, params } = request;

    switch (action) {
      case 'PING': {
        sendResponse({ success: true, message: 'PONG', url: location.href });
        return false;
      }

      case 'GET_VIEWPORT_METRICS': {
        sendResponse({
          success: true,
          dpr: window.devicePixelRatio || 1,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          scrollX: window.scrollX || 0,
          scrollY: window.scrollY || 0
        });
        return false;
      }

      case 'START_PICK_COORDINATE': {
        window.__MORY_PICKER__?.startPickCoordinate(params?.callbackId, params?.preCapturedDataUrl);
        sendResponse({ success: true, status: 'PICKING_COORDINATE' });
        return false;
      }

      case 'START_PICK_REGION': {
        window.__MORY_PICKER__?.startPickRegion(params?.callbackId, params?.preCapturedDataUrl);
        sendResponse({ success: true, status: 'PICKING_REGION' });
        return false;
      }

      case 'START_SCREEN_SNIP': {
        window.__MORY_PICKER__?.startScreenSnip(params?.callbackId, params?.preCapturedDataUrl);
        sendResponse({ success: true, status: 'SCREEN_SNIP' });
        return false;
      }

      case 'START_PICK_COLOR': {
        window.__MORY_PICKER__?.startPickColor(params?.callbackId, params?.preCapturedDataUrl);
        sendResponse({ success: true, status: 'PICKING_COLOR' });
        return false;
      }

      case 'EXECUTE_MOVE_MOUSE': {
        const { x = 0, y = 0, jitterEnabled = false, jitterX = 0, jitterY = 0, delay = 0 } = params || {};
        
        let finalX = Number(x);
        let finalY = Number(y);

        if (jitterEnabled) {
          const rx = (Math.random() * 2 - 1) * Number(jitterX || 0);
          const ry = (Math.random() * 2 - 1) * Number(jitterY || 0);
          finalX += rx;
          finalY += ry;
        }

        finalX = Math.round(Math.max(0, Math.min(window.innerWidth - 1, finalX)));
        finalY = Math.round(Math.max(0, Math.min(window.innerHeight - 1, finalY)));

        cursorX = finalX;
        cursorY = finalY;

        const cursor = ensureVirtualCursor();
        cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;

        // Fire mousemove event on DOM
        const targetElement = document.elementFromPoint(cursorX, cursorY) || document.body;
        const mouseMoveEvent = new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: cursorX,
          clientY: cursorY,
          screenX: cursorX + window.screenX,
          screenY: cursorY + window.screenY
        });
        targetElement.dispatchEvent(mouseMoveEvent);

        setTimeout(() => {
          sendResponse({
            success: true,
            action: 'MOVE_MOUSE',
            coords: { x: cursorX, y: cursorY }
          });
        }, 0);
        return true;
      }

      case 'EXECUTE_MOUSE_CLICK': {
        const {
          x,
          y,
          button = 'left',
          actionType = 'click',
          modifiers = {},
          delay = 0
        } = params || {};

        if (x !== undefined && y !== undefined && x !== null && y !== null) {
          cursorX = Math.round(Number(x));
          cursorY = Math.round(Number(y));
        }

        const cursor = ensureVirtualCursor();
        cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;

        const targetElement = document.elementFromPoint(cursorX, cursorY) || document.body;

        createRipple(cursorX, cursorY, button);

        const btnCode = button === 'right' ? 2 : button === 'middle' ? 1 : 0;
        const modInit = buildModifierEventInit(modifiers);
        const eventInit = {
          ...modInit,
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          clientX: cursorX,
          clientY: cursorY,
          screenX: cursorX + window.screenX,
          screenY: cursorY + window.screenY,
          button: btnCode,
          buttons: btnCode === 0 ? 1 : btnCode === 2 ? 2 : 4,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true
        };

        const dispatchPointerAndMouse = (el, type) => {
          if (window.PointerEvent) {
            try { el.dispatchEvent(new PointerEvent('pointer' + type, eventInit)); } catch (e) {}
          }
          try { el.dispatchEvent(new MouseEvent('mouse' + type, eventInit)); } catch (e) {}
        };

        if (actionType === 'down') {
          dispatchPointerAndMouse(targetElement, 'down');
        } else if (actionType === 'up') {
          dispatchPointerAndMouse(targetElement, 'up');
        } else if (actionType === 'dblclick') {
          dispatchPointerAndMouse(targetElement, 'down');
          dispatchPointerAndMouse(targetElement, 'up');
          targetElement.dispatchEvent(new MouseEvent('click', eventInit));
          setTimeout(() => {
            dispatchPointerAndMouse(targetElement, 'down');
            dispatchPointerAndMouse(targetElement, 'up');
            targetElement.dispatchEvent(new MouseEvent('dblclick', eventInit));
          }, 60);
        } else {
          // Standard Single Click
          dispatchPointerAndMouse(targetElement, 'down');
          dispatchPointerAndMouse(targetElement, 'up');
          if (button === 'right') {
            targetElement.dispatchEvent(new MouseEvent('contextmenu', eventInit));
          } else {
            targetElement.dispatchEvent(new MouseEvent('click', eventInit));

            // Find closest clickable ancestor if inner element (svg, path, span, text) was targeted
            const interactive = targetElement.closest('button, a, input, select, textarea, [role="button"], [role="link"], label');
            if (interactive && interactive !== targetElement) {
              if (typeof interactive.focus === 'function') {
                try { interactive.focus(); } catch (e) {}
              }
              if (typeof interactive.click === 'function') {
                try { interactive.click(); } catch (e) {}
              }
            } else if (typeof targetElement.click === 'function' && targetElement.tagName !== 'BODY') {
              try { targetElement.click(); } catch (e) {}
            }
          }
        }

        setTimeout(() => {
          sendResponse({
            success: true,
            action: 'MOUSE_CLICK',
            element: targetElement.tagName,
            coords: { x: cursorX, y: cursorY }
          });
        }, 0);
        return true;
      }

      case 'EXECUTE_MOUSE_SCROLL': {
        const {
          scrollType = 'vertical',
          direction = 'down',
          steps = 1,
          delay = 0
        } = params || {};

        const stepPixel = 140;
        let deltaX = 0;
        let deltaY = 0;

        if (scrollType === 'vertical') {
          deltaY = (direction === 'up' ? -1 : 1) * Number(steps) * stepPixel;
        } else {
          deltaX = (direction === 'left' ? -1 : 1) * Number(steps) * stepPixel;
        }

        const dirSymbol = direction === 'down' ? '↓' : direction === 'up' ? '↑' : direction === 'left' ? '←' : '→';
        showFloatingBadge(cursorX, cursorY, `滚动: ${steps} 步 ${dirSymbol}`, '📜');

        window.scrollBy({
          top: deltaY,
          left: deltaX,
          behavior: 'smooth'
        });

        const targetElement = document.elementFromPoint(cursorX, cursorY) || document.body;
        targetElement.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaX,
          deltaY,
          clientX: cursorX,
          clientY: cursorY
        }));

        setTimeout(() => {
          sendResponse({
            success: true,
            action: 'MOUSE_SCROLL',
            delta: { deltaX, deltaY }
          });
        }, 0);
        return true;
      }

      case 'EXECUTE_HOTKEY': {
        const { hotkey = 'Ctrl+C', delay = 0 } = params || {};
        const activeEl = document.activeElement || document.elementFromPoint(cursorX, cursorY) || document.body;

        showFloatingBadge(cursorX, cursorY, `按键: ${hotkey}`, '⌨️');

        const parts = hotkey.split('+');
        const hasCtrl = parts.some(p => p.toLowerCase().includes('ctrl'));
        const hasShift = parts.some(p => p.toLowerCase().includes('shift'));
        const hasAlt = parts.some(p => p.toLowerCase().includes('alt'));
        const hasWin = parts.some(p => p.toLowerCase().includes('win') || p.toLowerCase().includes('meta'));
        const keyChar = parts[parts.length - 1];

        let keyCode = 0;
        let code = `Key${keyChar.toUpperCase()}`;
        if (keyChar === 'Enter') { code = 'Enter'; keyCode = 13; }
        else if (keyChar === 'Tab') { code = 'Tab'; keyCode = 9; }
        else if (keyChar === 'Escape' || keyChar === 'Esc') { code = 'Escape'; keyCode = 27; }
        else if (keyChar === 'Backspace') { code = 'Backspace'; keyCode = 8; }
        else if (keyChar === 'Delete') { code = 'Delete'; keyCode = 46; }
        else if (keyChar === 'Space') { code = 'Space'; keyCode = 32; }
        else if (keyChar.startsWith('Arrow')) { code = keyChar; }
        else if (keyChar.startsWith('F') && !isNaN(keyChar.slice(1))) { code = keyChar; }

        const keyEventInit = {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          key: keyChar === 'Space' ? ' ' : keyChar,
          code,
          keyCode,
          which: keyCode,
          ctrlKey: hasCtrl,
          shiftKey: hasShift,
          altKey: hasAlt,
          metaKey: hasWin
        };

        activeEl.dispatchEvent(new KeyboardEvent('keydown', keyEventInit));
        activeEl.dispatchEvent(new KeyboardEvent('keypress', keyEventInit));
        activeEl.dispatchEvent(new KeyboardEvent('keyup', keyEventInit));

        // Browser-level clipboard simulation if copy/paste
        if (hotkey.toUpperCase() === 'CTRL+C') {
          const selText = window.getSelection()?.toString();
          if (selText) {
            navigator.clipboard?.writeText(selText).catch(() => {});
          }
        } else if (hotkey.toUpperCase() === 'CTRL+A') {
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            activeEl.select();
          }
        } else if (keyChar === 'Backspace' && !hasCtrl && !hasAlt) {
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            const start = activeEl.selectionStart;
            const end = activeEl.selectionEnd;
            if (start === end && start > 0) {
              activeEl.value = activeEl.value.slice(0, start - 1) + activeEl.value.slice(end);
              activeEl.selectionStart = activeEl.selectionEnd = start - 1;
              activeEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }

        setTimeout(() => {
          sendResponse({ success: true, hotkey });
        }, 0);
        return true;
      }

      case 'EXECUTE_TEXT_INPUT': {
        const { text = '', charDelay = 20, delay = 0 } = params || {};
        const activeEl = document.activeElement || document.elementFromPoint(cursorX, cursorY) || document.body;

        showFloatingBadge(cursorX, cursorY, `输入文本 (${text.length}字)`, '⌨️');

        const typeChar = (ch) => {
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
            let inserted = false;
            try {
              inserted = document.execCommand('insertText', false, ch);
            } catch (e) {}

            if (!inserted && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
              const start = activeEl.selectionStart ?? activeEl.value.length;
              const end = activeEl.selectionEnd ?? activeEl.value.length;
              const val = activeEl.value;
              activeEl.value = val.substring(0, start) + ch + val.substring(end);
              activeEl.selectionStart = activeEl.selectionEnd = start + ch.length;
              activeEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
              activeEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            }
          }

          const code = ch === ' ' ? 'Space' : (ch === '\n' ? 'Enter' : `Key${ch.toUpperCase()}`);
          const eventInit = {
            key: ch,
            code,
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window
          };
          activeEl.dispatchEvent(new KeyboardEvent('keydown', eventInit));
          activeEl.dispatchEvent(new KeyboardEvent('keypress', eventInit));
          activeEl.dispatchEvent(new KeyboardEvent('keyup', eventInit));
        };

        (async () => {
          for (let i = 0; i < text.length; i++) {
            typeChar(text[i]);
            if (charDelay > 0) {
              await new Promise(r => setTimeout(r, charDelay));
            }
          }
          sendResponse({ success: true, count: text.length });
        })();

        return true;
      }

      case 'FIND_TEXT_IN_REGION': {
        const { text = '', region = {}, minSimilarity = 90 } = params || {};
        if (!text) {
          sendResponse({ success: false, found: false, error: '查找文字不能为空' });
          return false;
        }

        const query = text.trim();
        const rx1 = Number(region.x1) || 0;
        const ry1 = Number(region.y1) || 0;
        const rx2 = (Number(region.x2) && Number(region.x2) > rx1) ? Number(region.x2) : window.innerWidth;
        const ry2 = (Number(region.y2) && Number(region.y2) > ry1) ? Number(region.y2) : window.innerHeight;

        let bestCandidate = null;
        let bestSim = 0;

        // Helper to check if rect is inside search region
        const isInsideRegion = (r) => {
          if (!r || r.width <= 0 || r.height <= 0) return false;
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          // Accept if center is in region or overlaps significantly
          const inBounds = cx >= rx1 - 20 && cx <= rx2 + 20 && cy >= ry1 - 20 && cy <= ry2 + 20;
          return inBounds;
        };

        // Strategy 1: Search Inputs and Textareas
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
          const val = (input.value || input.placeholder || '').trim();
          if (!val) return;
          const sim = calcTextSimilarity(val, query);
          if (sim >= minSimilarity && sim > bestSim) {
            const r = input.getBoundingClientRect();
            if (isInsideRegion(r)) {
              bestSim = sim;
              bestCandidate = {
                found: true,
                similarity: sim,
                text: val,
                element: input,
                x: Math.round(r.left),
                y: Math.round(r.top),
                width: Math.round(r.width),
                height: Math.round(r.height),
                centerX: Math.round(r.left + r.width / 2),
                centerY: Math.round(r.top + r.height / 2)
              };
            }
          }
        });

        // Strategy 2: Text Nodes with accurate Range coordinate computation
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const val = node.nodeValue?.trim();
            if (!val || val.length === 0) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.id === 'mory-virtual-cursor') {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        let textNode;
        while ((textNode = walker.nextNode())) {
          const rawText = textNode.nodeValue;
          const sim = calcTextSimilarity(rawText, query);
          if (sim >= minSimilarity && sim >= bestSim) {
            const parent = textNode.parentElement;
            let rect = parent.getBoundingClientRect();

            // Try exact substring range for sub-pixel accuracy
            try {
              const lowerRaw = rawText.toLowerCase();
              const lowerQ = query.toLowerCase();
              const idx = lowerRaw.indexOf(lowerQ);
              if (idx !== -1) {
                const range = document.createRange();
                range.setStart(textNode, idx);
                range.setEnd(textNode, idx + query.length);
                const rangeRect = range.getBoundingClientRect();
                if (rangeRect && rangeRect.width > 0 && rangeRect.height > 0) {
                  rect = rangeRect;
                }
              }
            } catch (e) {}

            if (isInsideRegion(rect)) {
              bestSim = sim;
              bestCandidate = {
                found: true,
                similarity: sim,
                text: rawText.trim(),
                element: parent,
                x: Math.round(rect.left),
                y: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                centerX: Math.round(rect.left + rect.width / 2),
                centerY: Math.round(rect.top + rect.height / 2)
              };
            }
          }
        }

        // Strategy 3: Clickable / Container elements (buttons, links, badges)
        if (!bestCandidate) {
          const interactiveEls = document.querySelectorAll('button, a, [role="button"], span, div, h1, h2, h3, h4, p, label');
          interactiveEls.forEach(el => {
            if (el.children.length > 5) return; // Skip big layouts
            const textContent = (el.innerText || '').trim();
            if (!textContent) return;
            const sim = calcTextSimilarity(textContent, query);
            if (sim >= minSimilarity && sim > bestSim) {
              const r = el.getBoundingClientRect();
              if (isInsideRegion(r)) {
                bestSim = sim;
                bestCandidate = {
                  found: true,
                  similarity: sim,
                  text: textContent,
                  element: el,
                  x: Math.round(r.left),
                  y: Math.round(r.top),
                  width: Math.round(r.width),
                  height: Math.round(r.height),
                  centerX: Math.round(r.left + r.width / 2),
                  centerY: Math.round(r.top + r.height / 2)
                };
              }
            }
          });
        }

        if (bestCandidate && bestCandidate.found) {
          // Highlight and scroll into view automatically
          highlightBox({
            x: bestCandidate.x,
            y: bestCandidate.y,
            width: bestCandidate.width,
            height: bestCandidate.height
          }, `命中文字: ${bestCandidate.similarity}%`);

          if (bestCandidate.element && typeof bestCandidate.element.scrollIntoView === 'function') {
            try {
              bestCandidate.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (e) {}
          }

          // Strip DOM element reference before serialization
          delete bestCandidate.element;
          sendResponse({ success: true, ...bestCandidate });
        } else {
          sendResponse({ success: true, found: false, similarity: bestSim });
        }
        return false;
      }

      case 'COPY_TO_CLIPBOARD': {
        const { text = '' } = params || {};
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(() => {});
        }
        sendResponse({ success: true });
        return false;
      }

      case 'HIGHLIGHT_MATCH': {
        const { rect, label } = params || {};
        if (rect) {
          highlightBox(rect, label || '找图/文字匹配成功');
        }
        sendResponse({ success: true });
        return false;
      }

      default:
        sendResponse({ success: false, error: `Content script: 未知动作 ${action}` });
        return false;
    }
  });
})();
