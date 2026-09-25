// main.cjs - Electron Main Process for Mory RPA Desktop (EXE Version)
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { NativeRobot } = require('./native-robot.cjs');

// Disable Chromium background timer throttling so RPA workflows never freeze when window is unfocused or backgrounded
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

let mainWindow = null;
let pickerWindow = null;
let highlightWindow = null;
let floatingWindow = null;

function createFloatingWindow() {
  if (floatingWindow && !floatingWindow.isDestroyed()) return floatingWindow;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW } = primaryDisplay.workAreaSize;

  floatingWindow = new BrowserWindow({
    width: 340,
    height: 48,
    x: Math.round((screenW - 340) / 2),
    y: 16,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: true,
    show: false,
    icon: path.join(__dirname, '..', 'icons', 'icon48.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });

  floatingWindow.loadFile(path.join(__dirname, 'floating-bar.html'));
  floatingWindow.setAlwaysOnTop(true, 'screen-saver');

  floatingWindow.on('closed', () => {
    floatingWindow = null;
  });

  return floatingWindow;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'Mory-Automation (魔力自动化) v1.0.0 - 轻量级现代自动化工作流引擎 | MORY HUB',
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'icons', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  const designerPath = path.join(__dirname, '..', 'designer', 'designer.html');
  mainWindow.loadFile(designerPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (pickerWindow) {
      try { pickerWindow.close(); } catch (e) {}
      pickerWindow = null;
    }
    if (highlightWindow) {
      try { highlightWindow.close(); } catch (e) {}
      highlightWindow = null;
    }
    if (floatingWindow) {
      try { floatingWindow.close(); } catch (e) {}
      floatingWindow = null;
    }
  });
}

// 100% Native Lossless Screen & Window Capture (Direct Windows GDI BitBlt)
async function captureDesktopScreen(params = {}) {
  const hwnd = Number(params?.hwnd) || 0;
  if (hwnd > 0) {
    return await NativeRobot.captureWindow(hwnd);
  }
  return await NativeRobot.captureGdi(params?.x || 0, params?.y || 0, params?.width || 0, params?.height || 0);
}

// Temporary on-screen highlight box
function showDesktopHighlight(rect, label = '目标命中') {
  if (highlightWindow) {
    try { highlightWindow.close(); } catch (e) {}
    highlightWindow = null;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const dpr = primaryDisplay.scaleFactor || 1;

  // Convert physical pixel coordinates to Electron DIP coordinates
  const x = Math.round((Number(rect.x) || 0) / dpr);
  const y = Math.round((Number(rect.y) || 0) / dpr);
  const w = Math.max(20, Math.round((Number(rect.width) || 30) / dpr));
  const h = Math.max(20, Math.round((Number(rect.height) || 30) / dpr));

  highlightWindow = new BrowserWindow({
    x: x - 4,
    y: y - 28,
    width: Math.max(140, w + 8),
    height: h + 36,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  highlightWindow.setIgnoreMouseEvents(true);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 100vw; height: 100vh; overflow: hidden; background: transparent; }
        .tag {
          display: inline-block;
          background: #10b981;
          color: #fff;
          font-family: -apple-system, sans-serif;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 3px;
          margin-bottom: 2px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .box {
          width: ${w}px;
          height: ${h}px;
          border: 3px solid #10b981;
          border-radius: 4px;
          background: rgba(16, 185, 129, 0.2);
          box-shadow: 0 0 14px rgba(16, 185, 129, 0.7);
        }
      </style>
    </head>
    <body>
      <div class="tag">${label}</div>
      <div class="box"></div>
    </body>
    </html>
  `;

  highlightWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  setTimeout(() => {
    if (highlightWindow) {
      try { highlightWindow.close(); } catch (e) {}
      highlightWindow = null;
    }
  }, 2500);
}

// IPC Handlers
ipcMain.handle('DESKTOP_GET_WINDOWS', async () => {
  return await NativeRobot.listWindows();
});

ipcMain.handle('DESKTOP_FOCUS_WINDOW', async (event, { hwnd }) => {
  return await NativeRobot.focusWindow(hwnd);
});

ipcMain.handle('DESKTOP_CAPTURE_SCREEN', async (event, params) => {
  return await captureDesktopScreen(params);
});

ipcMain.handle('DESKTOP_GET_DISPLAYS', () => {
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    bounds: d.bounds,
    size: d.size,
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === screen.getPrimaryDisplay().id
  }));
});

ipcMain.handle('DESKTOP_HIGHLIGHT', (event, { rect, label }) => {
  showDesktopHighlight(rect, label);
  return { success: true };
});

ipcMain.handle('DESKTOP_EXECUTE_ACTION', async (event, { action, params }) => {
  const p = params || {};
  switch (action) {
    case 'MOVE_MOUSE':
    case 'EXECUTE_MOVE_MOUSE':
      if (p.hwnd) {
        await NativeRobot.focusWindow(p.hwnd);
        await new Promise(r => setTimeout(r, 60));
      }
      await NativeRobot.moveMouse(p.x, p.y);
      return { success: true, coords: { x: p.x, y: p.y } };

    case 'MOUSE_CLICK':
    case 'EXECUTE_MOUSE_CLICK':
      if (p.hwnd) {
        await NativeRobot.focusWindow(p.hwnd);
        await new Promise(r => setTimeout(r, 60));
      }
      if (p.x !== undefined && p.y !== undefined && p.x !== null && p.y !== null) {
        await NativeRobot.moveMouse(p.x, p.y);
      }
      await NativeRobot.mouseClick(p.x, p.y, p.button || 'left', p.actionType || 'click');
      return { success: true };

    case 'MOUSE_SCROLL':
    case 'EXECUTE_MOUSE_SCROLL': {
      const steps = Math.max(1, Number(p.steps) || 1);
      const stepSize = 120; // Win32 WHEEL_DELTA

      let deltaY = 0;
      let deltaX = 0;

      if (p.deltaY !== undefined) {
        deltaY = Number(p.deltaY);
      } else if (p.deltaX !== undefined) {
        deltaX = Number(p.deltaX);
      } else if (p.delta !== undefined) {
        deltaY = Number(p.delta);
      } else {
        const scrollType = p.scrollType || 'vertical';
        const direction = (p.direction || 'down').toLowerCase();

        if (scrollType === 'vertical') {
          // In Windows Win32 API:
          // Negative delta = wheel rotated backward (toward user) = SCROLL DOWN
          // Positive delta = wheel rotated forward (away from user) = SCROLL UP
          deltaY = (direction === 'up' ? 1 : -1) * steps * stepSize;
        } else {
          // Horizontal:
          // Positive delta = tilted right = SCROLL RIGHT
          // Negative delta = tilted left = SCROLL LEFT
          deltaX = (direction === 'left' ? -1 : 1) * steps * stepSize;
        }
      }

      await NativeRobot.mouseScroll(deltaY, deltaX);

      if (p.delay > 0) {
        await new Promise(r => setTimeout(r, Number(p.delay)));
      }

      return {
        success: true,
        action: 'MOUSE_SCROLL',
        delta: { deltaX, deltaY }
      };
    }

    case 'FIND_TEXT_IN_REGION': {
      const os = require('os');
      const fs = require('fs');
      const tempPath = path.join(os.tmpdir(), `mory-findtext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`);
      try {
        const hwnd = Number(p.hwnd) || 0;
        let ok = false;
        if (hwnd > 0) {
          ok = await NativeRobot.captureWindowToFile(tempPath, hwnd);
        } else {
          ok = await NativeRobot.captureGdiToFile(tempPath);
        }
        if (!ok || !fs.existsSync(tempPath)) {
          return { success: false, found: false, error: '截取屏幕失败，无法进行文字识别' };
        }

        const res = await NativeRobot.findTextInImage(tempPath, p.text, p.minSimilarity || 80, p.region || {});
        fs.promises.unlink(tempPath).catch(() => {});

        if (res && res.found) {
          showDesktopHighlight({ x: res.x, y: res.y, width: res.width, height: res.height }, `文字命中: ${res.similarity}%`);
        }
        return res;
      } catch (err) {
        fs.promises.unlink(tempPath).catch(() => {});
        return { success: false, found: false, error: '文字识别异常: ' + err.message };
      }
    }

    case 'EXECUTE_HOTKEY':
      await NativeRobot.executeHotkey(p.hotkey || '');
      return { success: true };

    case 'COPY_TO_CLIPBOARD': {
      const { clipboard } = require('electron');
      clipboard.writeText(String(p.text || ''));
      return { success: true };
    }

    case 'GET_VIEWPORT_METRICS': {
      const shot = await captureDesktopScreen({ hwnd: p.hwnd || 0 });
      return shot.metrics;
    }

    case 'TYPE_TEXT':
    case 'EXECUTE_TEXT_INPUT':
      await NativeRobot.typeText(p.text || '');
      return { success: true };

    case 'KEY_PRESS':
    case 'EXECUTE_KEY_ACTION':
      await NativeRobot.keyPress(p.keyCode || 13, p.action || 'press');
      return { success: true };

    case 'HIGHLIGHT_MATCH':
      showDesktopHighlight(p.rect, p.label || '目标命中');
      return { success: true };

    default:
      console.warn('[Mory Desktop] 未知桌面动作:', action);
      return { success: false, error: `未知桌面动作: ${action}` };
  }
});

// Interactive Desktop Snip / Region / Color Picker
ipcMain.handle('DESKTOP_START_PICKER', async (event, { mode = 'region', hwnd = 0 }) => {
  return new Promise(async (resolve) => {
    // 1. Hide main window first so it never appears in the screenshot
    if (mainWindow) mainWindow.hide();

    // 2. If a specific window is selected, activate it
    if (hwnd > 0) {
      await NativeRobot.focusWindow(hwnd);
      await new Promise(r => setTimeout(r, 60));
    }

    // Wait for DWM to redraw without designer window
    await new Promise(r => setTimeout(r, 80));

    // 3. Capture screen before showing picker using 100% RAW GDI
    let shot = null;
    try {
      shot = await NativeRobot.captureGdi();
    } catch (err) {
      console.warn('[Mory Desktop] 截取桌面失败:', err);
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    pickerWindow = new BrowserWindow({
      x: 0,
      y: 0,
      width,
      height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      fullscreen: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    pickerWindow.loadFile(path.join(__dirname, 'desktop-picker.html'));

    pickerWindow.webContents.on('did-finish-load', () => {
      pickerWindow.webContents.send('INIT_PICKER', {
        mode,
        hwnd,
        screenshotDataUrl: shot?.dataUrl || ''
      });
    });

    const cleanup = (result) => {
      ipcMain.removeListener('PICKER_FINISH', onFinish);
      if (pickerWindow) {
        try { pickerWindow.close(); } catch (e) {}
        pickerWindow = null;
      }
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
      resolve(result || { canceled: true });
    };

    const onFinish = (e, res) => {
      cleanup(res);
    };

    ipcMain.once('PICKER_FINISH', onFinish);
  });
});

// Floating Controller HUD IPC
ipcMain.handle('FLOATING_TOGGLE', () => {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    createFloatingWindow();
    floatingWindow.show();
    return true;
  }
  if (floatingWindow.isVisible()) {
    floatingWindow.hide();
    return false;
  } else {
    floatingWindow.show();
    return true;
  }
});

ipcMain.on('FLOATING_STATUS', (e, data) => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('UPDATE_FLOATING_STATUS', data);
  }
});

ipcMain.on('FLOATING_TRIGGER_ACTION', (e, action) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('FLOATING_ACTION', action);
  }
});

ipcMain.on('FLOATING_SHOW_MAIN', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.on('FLOATING_HIDE', () => {
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.hide();
  }
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
