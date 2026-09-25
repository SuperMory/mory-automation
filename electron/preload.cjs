// preload.cjs - Secure Bridge between Electron Main Process and Flow Designer UI
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,

  getWindows: () => ipcRenderer.invoke('DESKTOP_GET_WINDOWS'),

  focusWindow: (hwnd) => ipcRenderer.invoke('DESKTOP_FOCUS_WINDOW', { hwnd }),

  captureScreen: (params) => ipcRenderer.invoke('DESKTOP_CAPTURE_SCREEN', params),

  executeAction: (action, params) => ipcRenderer.invoke('DESKTOP_EXECUTE_ACTION', { action, params }),

  startPicker: (mode, params) => ipcRenderer.invoke('DESKTOP_START_PICKER', { mode, ...(params || {}) }),

  getDisplays: () => ipcRenderer.invoke('DESKTOP_GET_DISPLAYS'),

  highlightScreen: (rect, label) => ipcRenderer.invoke('DESKTOP_HIGHLIGHT', { rect, label }),

  toggleFloatingHUD: () => ipcRenderer.invoke('FLOATING_TOGGLE'),

  updateFloatingStatus: (status) => ipcRenderer.send('FLOATING_STATUS', status),

  onFloatingAction: (callback) => {
    ipcRenderer.on('FLOATING_ACTION', (event, action) => {
      if (typeof callback === 'function') callback(action);
    });
  }
});
