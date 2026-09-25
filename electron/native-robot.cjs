// native-robot.cjs - High-Performance Windows Native Driver Bridge for Mory RPA
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

let binPath = path.join(__dirname, 'bin', 'win-input.exe');
let ocrScriptPath = path.join(__dirname, 'win-ocr.ps1');

if (process.resourcesPath) {
  const resourceBin = path.join(process.resourcesPath, 'electron', 'bin', 'win-input.exe');
  if (fs.existsSync(resourceBin)) {
    binPath = resourceBin;
  }
  const resourceOcr = path.join(process.resourcesPath, 'electron', 'win-ocr.ps1');
  if (fs.existsSync(resourceOcr)) {
    ocrScriptPath = resourceOcr;
  }
}

function runWinInput(args) {
  return new Promise((resolve) => {
    const child = spawn(binPath, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });

    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });

    child.on('close', (code) => {
      resolve({ success: code === 0, stdout: stdout.trim(), stderr: stderr.trim() });
    });

    child.on('error', (err) => {
      console.warn('[Mory Desktop] WinInput error:', err.message);
      resolve({ success: false, stdout: '', stderr: err.message });
    });
  });
}

class NativeRobot {
  /**
   * Enumerate all interactive Windows applications & full desktop
   */
  static async listWindows() {
    const res = await runWinInput(['list-windows']);
    if (!res.success || !res.stdout) {
      return [{ id: 0, hwnd: 0, title: '🖥️ 整个 Windows 桌面屏幕', isScreen: true }];
    }
    try {
      const list = JSON.parse(res.stdout);
      return list;
    } catch (err) {
      console.warn('[Mory Desktop] Failed to parse windows list:', err);
      return [{ id: 0, hwnd: 0, title: '🖥️ 整个 Windows 桌面屏幕', isScreen: true }];
    }
  }

  /**
   * Bring a specific window to foreground
   */
  static async focusWindow(hwnd) {
    if (!hwnd) return true;
    const res = await runWinInput(['focus-window', String(hwnd)]);
    return res.success;
  }

  /**
   * 100% Native GDI BitBlt Fullscreen or Region Capture (No WebRTC / Zero Compression)
   */
  static async captureGdi(x = 0, y = 0, width = 0, height = 0) {
    const tempFile = path.join(os.tmpdir(), `mory-gdi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`);
    const args = ['capture-gdi', String(x), String(y), String(width), String(height), tempFile];

    const res = await runWinInput(args);
    if (!res.success || !fs.existsSync(tempFile)) {
      throw new Error(`GDI 原生截图失败: ${res.stderr || '文件未生成'}`);
    }

    try {
      const buf = await fs.promises.readFile(tempFile);
      const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
      await fs.promises.unlink(tempFile).catch(() => {});

      let parsedInfo = {};
      try {
        parsedInfo = JSON.parse(res.stdout);
      } catch (e) {}

      const finalW = parsedInfo.width || width;
      const finalH = parsedInfo.height || height;

      return {
        success: true,
        dataUrl,
        metrics: {
          innerWidth: finalW,
          innerHeight: finalH,
          dpr: 1,
          screenWidth: finalW,
          screenHeight: finalH,
          scrollX: 0,
          scrollY: 0
        }
      };
    } catch (err) {
      try { await fs.promises.unlink(tempFile); } catch (e) {}
      throw err;
    }
  }

  /**
   * Save GDI capture directly to a specific file
   */
  static async captureGdiToFile(filePath, x = 0, y = 0, width = 0, height = 0) {
    const args = ['capture-gdi', String(x), String(y), String(width), String(height), filePath];
    const res = await runWinInput(args);
    return res.success && fs.existsSync(filePath);
  }

  /**
   * 100% Native GDI Capture of a Specific Window
   */
  static async captureWindow(hwnd = 0) {
    const tempFile = path.join(os.tmpdir(), `mory-wnd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`);
    const args = ['capture-window', String(hwnd), tempFile];

    const res = await runWinInput(args);
    if (!res.success || !fs.existsSync(tempFile)) {
      throw new Error(`窗口截图失败: ${res.stderr || '文件未生成'}`);
    }

    try {
      const buf = await fs.promises.readFile(tempFile);
      const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
      await fs.promises.unlink(tempFile).catch(() => {});

      let parsedInfo = {};
      try {
        parsedInfo = JSON.parse(res.stdout);
      } catch (e) {}

      return {
        success: true,
        dataUrl,
        windowRect: {
          x: parsedInfo.x || 0,
          y: parsedInfo.y || 0,
          width: parsedInfo.width || 0,
          height: parsedInfo.height || 0
        },
        metrics: {
          innerWidth: parsedInfo.width || 1920,
          innerHeight: parsedInfo.height || 1080,
          dpr: 1,
          screenWidth: parsedInfo.width || 1920,
          screenHeight: parsedInfo.height || 1080,
          scrollX: 0,
          scrollY: 0
        }
      };
    } catch (err) {
      try { await fs.promises.unlink(tempFile); } catch (e) {}
      throw err;
    }
  }

  /**
   * Save window capture directly to a specific file
   */
  static async captureWindowToFile(filePath, hwnd = 0) {
    const args = ['capture-window', String(hwnd), filePath];
    const res = await runWinInput(args);
    return res.success && fs.existsSync(filePath);
  }

  /**
   * Windows Native OCR Text Recognition on Image
   */
  static async findTextInImage(imagePath, searchText, minSimilarity = 80, region = {}) {
    const x1 = Math.round(Number(region.x1) || 0);
    const y1 = Math.round(Number(region.y1) || 0);
    const x2 = Math.round(Number(region.x2) || 0);
    const y2 = Math.round(Number(region.y2) || 0);

    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', ocrScriptPath,
      '-ImagePath', imagePath,
      '-SearchText', String(searchText),
      '-MinSimilarity', String(minSimilarity),
      '-X1', String(x1),
      '-Y1', String(y1),
      '-X2', String(x2),
      '-Y2', String(y2)
    ];

    return new Promise((resolve) => {
      const child = spawn('powershell', args, { windowsHide: true });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
      child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

      child.on('close', (code) => {
        try {
          const res = JSON.parse(stdout.trim());
          resolve(res);
        } catch (e) {
          resolve({
            success: false,
            found: false,
            error: stdout.trim() || stderr.trim() || 'OCR解析失败'
          });
        }
      });

      child.on('error', (err) => {
        resolve({
          success: false,
          found: false,
          error: '启动OCR引擎失败: ' + err.message
        });
      });
    });
  }

  static async moveMouse(x, y) {
    const px = Math.round(Number(x) || 0);
    const py = Math.round(Number(y) || 0);
    const res = await runWinInput(['move', String(px), String(py)]);
    return res.success;
  }

  static async mouseClick(x, y, button = 'left', actionType = 'click') {
    const hasCoords = x !== undefined && y !== undefined && x !== null && y !== null;
    const px = hasCoords ? Math.round(Number(x)) : -1;
    const py = hasCoords ? Math.round(Number(y)) : -1;

    if (actionType === 'dblclick') {
      const res = await runWinInput(['dblclick', String(px), String(py)]);
      return res.success;
    }

    const btn = button.toLowerCase();
    const res = await runWinInput(['click', String(px), String(py), btn]);
    return res.success;
  }

  static async mouseScroll(deltaY = 0, deltaX = 0) {
    const dy = Math.round(Number(deltaY) || 0);
    const dx = Math.round(Number(deltaX) || 0);
    const res = await runWinInput(['scroll', String(dy), String(dx)]);
    return res.success;
  }

  static async typeText(text) {
    const res = await runWinInput(['text', String(text)]);
    return res.success;
  }

  static async keyPress(keyCode, action = 'press') {
    const res = await runWinInput(['key', String(keyCode), String(action)]);
    return res.success;
  }

  static async executeHotkey(hotkeyStr) {
    if (!hotkeyStr) return true;
    const hk = hotkeyStr.trim();
    let sendKeysStr = '';
    const upper = hk.toUpperCase();
    if (upper === 'ENTER') sendKeysStr = '{ENTER}';
    else if (upper === 'TAB') sendKeysStr = '{TAB}';
    else if (upper === 'ESC' || upper === 'ESCAPE') sendKeysStr = '{ESC}';
    else if (upper === 'BACKSPACE' || upper === 'BACK') sendKeysStr = '{BACKSPACE}';
    else if (upper === 'DELETE' || upper === 'DEL') sendKeysStr = '{DELETE}';
    else if (upper === 'UP') sendKeysStr = '{UP}';
    else if (upper === 'DOWN') sendKeysStr = '{DOWN}';
    else if (upper === 'LEFT') sendKeysStr = '{LEFT}';
    else if (upper === 'RIGHT') sendKeysStr = '{RIGHT}';
    else if (upper === 'SPACE') sendKeysStr = ' ';
    else if (upper === 'CTRL+A') sendKeysStr = '^a';
    else if (upper === 'CTRL+C') sendKeysStr = '^c';
    else if (upper === 'CTRL+V') sendKeysStr = '^v';
    else if (upper === 'CTRL+X') sendKeysStr = '^x';
    else if (upper === 'CTRL+Z') sendKeysStr = '^z';
    else if (upper === 'CTRL+S') sendKeysStr = '^s';
    else if (upper === 'ALT+F4') sendKeysStr = '%{F4}';
    else if (/^F([1-9]|1[0-2])$/i.test(hk)) sendKeysStr = `{${upper}}`;
    else {
      let prefix = '';
      let key = hk;
      if (upper.includes('CTRL+')) { prefix += '^'; key = key.replace(/ctrl\+/i, ''); }
      if (upper.includes('ALT+')) { prefix += '%'; key = key.replace(/alt\+/i, ''); }
      if (upper.includes('SHIFT+')) { prefix += '+'; key = key.replace(/shift\+/i, ''); }
      sendKeysStr = prefix + key.toLowerCase();
    }
    const res = await runWinInput(['text', sendKeysStr]);
    return res.success;
  }
}

module.exports = { NativeRobot };
