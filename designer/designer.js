// designer.js - Main Application Controller for RPA Flow Designer

import { ActionRegistry } from './actions/action-registry.js';
import { FlowCanvas } from './canvas.js';
import { FlowExecutor } from './executor.js';
import { ImageMatcher } from './image_matcher.js';

class DesignerApp {
  constructor() {
    this.targetTabId = null;
    this.canvas = null;
    this.executor = null;
    this.activePickerCallback = null;

    this.initLogger();
    this.initTabBridge();
    this.initCanvas();
    this.initSidebar();
    this.initExecutor();
    this.bindToolbarEvents();
    this.loadInitialWorkflow();
  }

  // Logger system
  initLogger() {
    this.logListEl = document.getElementById('log-list');
    this.statusTagEl = document.getElementById('log-status-tag');

    this.logger = {
      info: (msg) => this.appendLog('info', msg),
      success: (msg) => this.appendLog('success', msg),
      warn: (msg) => this.appendLog('warn', msg),
      error: (msg) => this.appendLog('error', msg)
    };

    document.getElementById('btn-clear-logs').addEventListener('click', () => {
      this.logListEl.innerHTML = '';
    });

    const toggleBtn = document.getElementById('btn-toggle-logs');
    const panel = document.getElementById('log-panel');
    let isCollapsed = false;
    toggleBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      panel.style.height = isCollapsed ? '32px' : '160px';
      toggleBtn.textContent = isCollapsed ? '展开 ▴' : '折叠 ▾';
    });
  }

  appendLog(level, msg) {
    // Keep max 200 log items in DOM to prevent memory leak and rendering lag during long loops
    while (this.logListEl.children.length >= 200) {
      this.logListEl.removeChild(this.logListEl.firstElementChild);
    }
    const line = document.createElement('div');
    line.className = `mory-log-line ${level}`;
    const time = new Date().toLocaleTimeString();
    line.innerHTML = `<span class="mory-log-time">[${time}]</span><span>${this.escapeHtml(msg)}</span>`;
    this.logListEl.appendChild(line);
    this.logListEl.scrollTop = this.logListEl.scrollHeight;
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Communication Bridge with Background / Content Scripts or Electron Desktop Process
  initTabBridge() {
    const isDesktop = typeof window !== 'undefined' && !!window.electronAPI;
    const isExtension = !isDesktop && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;

    // Update UI badge for runtime environment
    const envTag = document.getElementById('mory-env-tag') || document.querySelector('.mory-brand-badge');
    if (envTag) {
      if (isDesktop) {
        envTag.textContent = '桌面便携版 (EXE)';
        envTag.style.background = '#059669';
      } else if (isExtension) {
        envTag.textContent = '浏览器插件版';
        envTag.style.background = '#2563eb';
      }
    }

    const targetLabel = document.querySelector('.mory-target-tab-select span');
    if (targetLabel && isDesktop) {
      targetLabel.textContent = '🎯 执行目标 (桌面/窗口):';
    }

    this.tabBridge = {
      isExtension: () => isExtension,
      isDesktop: () => isDesktop,

      getTabs: async () => {
        if (isDesktop) {
          try {
            const windows = await window.electronAPI.getWindows();
            return windows.map(w => ({
              id: w.hwnd,
              hwnd: w.hwnd,
              title: w.title,
              url: w.process ? `win://${w.process}` : 'win://desktop',
              isScreen: !!w.isScreen
            }));
          } catch (e) {
            return [{ id: 0, hwnd: 0, title: '🖥️ 整个 Windows 桌面屏幕', url: 'win://desktop', isScreen: true }];
          }
        }
        return new Promise((resolve) => {
          if (!isExtension) {
            resolve([{ id: 'demo_tab', title: '本地测试模拟网页 (浏览器预览模式)', url: 'http://localhost' }]);
            return;
          }
          chrome.runtime.sendMessage({ type: 'GET_TABS' }, (res) => {
            if (chrome.runtime.lastError || !res?.tabs) {
              resolve([]);
            } else {
              resolve(res.tabs);
            }
          });
        });
      },

      captureTab: async () => {
        if (isDesktop) {
          const res = await window.electronAPI.captureScreen({ hwnd: this.targetTabId || 0 });
          if (res && res.success) {
            this.tabBridge.lastViewportMetrics = res.metrics;
            return res.dataUrl;
          }
          throw new Error(res?.error || '截取桌面失败');
        }
        return new Promise((resolve, reject) => {
          if (!isExtension) {
            resolve(this.generateMockScreenshot());
            return;
          }
          chrome.runtime.sendMessage({
            type: 'CAPTURE_TAB',
            payload: { tabId: this.targetTabId }
          }, (res) => {
            if (res && res.success) {
              if (res.metrics) {
                this.tabBridge.lastViewportMetrics = res.metrics;
              }
              resolve(res.dataUrl);
            } else {
              reject(new Error(res?.error || '截图失败'));
            }
          });
        });
      },

      getViewportMetrics: async () => {
        if (isDesktop) {
          if (this.tabBridge.lastViewportMetrics) return this.tabBridge.lastViewportMetrics;
          const shot = await window.electronAPI.captureScreen({ hwnd: this.targetTabId || 0 });
          this.tabBridge.lastViewportMetrics = shot.metrics;
          return shot.metrics;
        }
        if (this.tabBridge.lastViewportMetrics) return this.tabBridge.lastViewportMetrics;
        const res = await this.tabBridge.callTabMethod('GET_VIEWPORT_METRICS');
        if (res && res.success) {
          this.tabBridge.lastViewportMetrics = res;
          return res;
        }
        return null;
      },

      callTabMethod: (action, params = {}) => {
        if (isDesktop) {
          return window.electronAPI.executeAction(action, { ...params, hwnd: this.targetTabId || 0 });
        }
        return new Promise((resolve) => {
          if (!isExtension) {
            this.logger.info(`[模拟网页执行] ${action}: ${JSON.stringify(params)}`);
            setTimeout(() => resolve({ success: true, coords: { x: params.x || 100, y: params.y || 100 }, delta: params }), 200);
            return;
          }
          if (!this.targetTabId) {
            resolve({ success: false, error: '请先在顶部下拉框中选择要执行的目标网页标签！' });
            return;
          }
          chrome.runtime.sendMessage({
            type: 'CALL_TAB_METHOD',
            payload: {
              tabId: this.targetTabId,
              action,
              params
            }
          }, (res) => {
            resolve(res || { success: false, error: '未收到网页端响应' });
          });
        });
      }
    };

    // Listen for picker response from content script via background (Extension Mode)
    if (isExtension) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'PICKER_RESULT') {
          if (this.activePickerCallback) {
            this.activePickerCallback(message.payload);
            this.activePickerCallback = null;
          }
        }
      });
    }

    this.refreshTabsList();
    document.getElementById('btn-refresh-tabs').addEventListener('click', () => {
      this.refreshTabsList();
    });

    document.getElementById('sel-target-tab').addEventListener('change', (e) => {
      const val = e.target.value;
      this.targetTabId = val === '' ? null : (isNaN(Number(val)) ? val : Number(val));
      this.logger.info(`已切换目标环境: ${this.targetTabId}`);
    });
  }

  async refreshTabsList() {
    const selectEl = document.getElementById('sel-target-tab');
    selectEl.innerHTML = '<option value="">正在检测执行环境...</option>';
    const tabs = await this.tabBridge.getTabs();

    if (!tabs || tabs.length === 0) {
      selectEl.innerHTML = '<option value="">无可用目标 (请在浏览器中打开目标网站)</option>';
      this.targetTabId = null;
      return;
    }

    selectEl.innerHTML = '';
    tabs.forEach((tab, idx) => {
      const opt = document.createElement('option');
      opt.value = tab.id;
      opt.textContent = `${tab.title}`;
      if (idx === 0) {
        opt.selected = true;
        this.targetTabId = tab.id;
      }
      selectEl.appendChild(opt);
    });
  }

  // Initialize Flow Canvas
  initCanvas() {
    const container = document.getElementById('canvas-container');
    this.canvas = new FlowCanvas(container, {
      onNodeEdit: (nodeData) => this.openNodeConfig(nodeData),
      onNodeTest: (nodeData) => this.testSingleNode(nodeData),
      onChange: () => this.saveToLocalStorage()
    });
  }

  // Populate sidebar with registered actions
  initSidebar() {
    const libraryEl = document.getElementById('sidebar-action-library');
    libraryEl.innerHTML = '';

    const categories = ActionRegistry.getCategories();
    for (const cat of categories) {
      const actions = ActionRegistry.getByCategory(cat.id);
      if (actions.length === 0) continue;

      const groupEl = document.createElement('div');
      groupEl.className = 'mory-category-group';
      groupEl.innerHTML = `
        <div class="mory-category-title">
          <span>${cat.icon}</span>
          <span>${cat.name}</span>
        </div>
      `;

      for (const act of actions) {
        const card = document.createElement('div');
        card.className = 'mory-action-card';
        card.setAttribute('draggable', 'true');
        card.innerHTML = `
          <div class="mory-action-icon" style="color: ${act.color};">${act.icon}</div>
          <div class="mory-action-info">
            <div class="mory-action-name">${act.name}</div>
            <div class="mory-action-desc" title="${act.description}">${act.description}</div>
          </div>
        `;

        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('application/mory-action', act.type);
          e.dataTransfer.effectAllowed = 'copy';
        });

        // Double click card to auto add to canvas
        card.addEventListener('dblclick', () => {
          this.canvas.addNode(act.type, 160 + Math.random() * 80, 120 + Math.random() * 80);
        });

        groupEl.appendChild(card);
      }

      libraryEl.appendChild(groupEl);
    }
  }

  // Modal open helper with picker contexts
  openNodeConfig(nodeData) {
    const actionDef = ActionRegistry.get(nodeData.type);
    if (!actionDef || !actionDef.openConfigModal) return;

    const modalContext = {
      targetTabId: this.targetTabId,

      captureTab: () => this.tabBridge.captureTab(),

      getViewportMetrics: () => this.tabBridge.getViewportMetrics(),

      highlightTarget: (rect, label) => {
        this.tabBridge.callTabMethod('HIGHLIGHT_MATCH', { rect, label });
      },

      findColor: async (params) => {
        const screenshotUrl = await this.tabBridge.captureTab();
        const metrics = await this.tabBridge.getViewportMetrics();
        const dpr = metrics?.dpr || 1;
        const colorAction = ActionRegistry.get('find_color');
        if (colorAction && colorAction.searchColorInScreenshot) {
          const res = await colorAction.searchColorInScreenshot(
            screenshotUrl,
            params.color,
            params.region,
            params.tolerance,
            dpr,
            metrics
          );
          if (res && res.found) {
            this.tabBridge.callTabMethod('HIGHLIGHT_MATCH', {
              rect: {
                x: res.x - 12,
                y: res.y - 12,
                width: 24,
                height: 24
              },
              label: `找色命中: ${res.actualColor}`
            });
          }
          return res;
        }
        return { found: false, error: '未找到找色模块' };
      },

      findText: (params) => {
        return this.tabBridge.callTabMethod('FIND_TEXT_IN_REGION', params);
      },

      startPickCoordinate: async (callback) => {
        if (this.tabBridge.isDesktop()) {
          const res = await window.electronAPI.startPicker('coordinate', { hwnd: this.targetTabId || 0 });
          callback(res);
          return;
        }
        if (!this.targetTabId && this.tabBridge.isExtension()) {
          alert('请先在设计器顶部下拉栏中选择要操作的目标网页！');
          callback({ canceled: true });
          return;
        }
        this.activePickerCallback = callback;
        if (this.tabBridge.isExtension()) {
          chrome.runtime.sendMessage({
            type: 'START_PICKER',
            payload: {
              targetTabId: this.targetTabId,
              mode: 'coordinate',
              callbackId: 'coord'
            }
          });
        } else {
          setTimeout(() => {
            const tx = prompt('模拟拾取 X 坐标:', '350');
            const ty = prompt('模拟拾取 Y 坐标:', '200');
            if (tx !== null && ty !== null) {
              callback({ x: Number(tx) || 0, y: Number(ty) || 0, canceled: false });
            } else {
              callback({ canceled: true });
            }
          }, 300);
        }
      },

      startPickRegion: async (callback) => {
        if (this.tabBridge.isDesktop()) {
          const res = await window.electronAPI.startPicker('region', { hwnd: this.targetTabId || 0 });
          callback(res);
          return;
        }
        if (!this.targetTabId && this.tabBridge.isExtension()) {
          alert('请先在设计器顶部下拉栏中选择要操作的目标网页！');
          callback({ canceled: true });
          return;
        }
        this.activePickerCallback = callback;
        if (this.tabBridge.isExtension()) {
          chrome.runtime.sendMessage({
            type: 'START_PICKER',
            payload: {
              targetTabId: this.targetTabId,
              mode: 'region',
              callbackId: 'region'
            }
          });
        } else {
          setTimeout(() => {
            callback({ x1: 50, y1: 50, x2: 800, y2: 600, canceled: false });
          }, 300);
        }
      },

      startScreenSnip: async (callback) => {
        if (this.tabBridge.isDesktop()) {
          const res = await window.electronAPI.startPicker('snip', { hwnd: this.targetTabId || 0 });
          callback(res);
          return;
        }
        if (!this.targetTabId && this.tabBridge.isExtension()) {
          alert('请先在设计器顶部下拉栏中选择要操作的目标网页！');
          callback({ canceled: true });
          return;
        }
        this.activePickerCallback = async (regionRes) => {
          if (!regionRes || regionRes.canceled) {
            callback({ canceled: true });
            return;
          }
          if (regionRes.croppedDataUrl) {
            callback({ croppedDataUrl: regionRes.croppedDataUrl, region: regionRes });
            return;
          }
          try {
            const fullShot = await this.tabBridge.captureTab();
            const dpr = regionRes.dpr || 1;
            const croppedDataUrl = await ImageMatcher.cropImage(fullShot, {
              x: (regionRes.x1 ?? regionRes.x ?? 0) * dpr,
              y: (regionRes.y1 ?? regionRes.y ?? 0) * dpr,
              width: regionRes.width * dpr,
              height: regionRes.height * dpr
            });
            callback({ croppedDataUrl, region: regionRes });
          } catch (e) {
            console.warn('裁剪截图失败:', e);
            alert('裁剪截图失败: ' + e.message);
            callback({ canceled: true });
          }
        };

        if (this.tabBridge.isExtension()) {
          chrome.runtime.sendMessage({
            type: 'START_PICKER',
            payload: {
              targetTabId: this.targetTabId,
              mode: 'snip',
              callbackId: 'snip'
            }
          });
        } else {
          setTimeout(() => {
            const dummyCanvas = document.createElement('canvas');
            dummyCanvas.width = 100;
            dummyCanvas.height = 40;
            const ctx = dummyCanvas.getContext('2d');
            ctx.fillStyle = '#10b981';
            ctx.fillRect(0, 0, 100, 40);
            ctx.fillStyle = '#fff';
            ctx.font = '12px sans-serif';
            ctx.fillText('示例按钮', 25, 25);
            callback({ croppedDataUrl: dummyCanvas.toDataURL(), region: { x1: 50, y1: 50, x2: 150, y2: 90 } });
          }, 300);
        }
      },

      startPickColor: async (callback) => {
        if (this.tabBridge.isDesktop()) {
          const res = await window.electronAPI.startPicker('color', { hwnd: this.targetTabId || 0 });
          callback(res);
          return;
        }
        if (!this.targetTabId && this.tabBridge.isExtension()) {
          alert('请先在设计器顶部下拉栏中选择要操作的目标网页！');
          callback({ canceled: true });
          return;
        }
        this.activePickerCallback = callback;
        if (this.tabBridge.isExtension()) {
          chrome.runtime.sendMessage({
            type: 'START_PICKER',
            payload: {
              targetTabId: this.targetTabId,
              mode: 'color',
              callbackId: 'color'
            }
          });
        } else {
          setTimeout(() => {
            const hex = prompt('输入模拟颜色 Hex 代码:', '#10B981');
            if (hex) {
              callback({ color: hex, x: 200, y: 150, canceled: false });
            } else {
              callback({ canceled: true });
            }
          }, 300);
        }
      },

      findColor: async (params) => {
        const fullShot = await this.tabBridge.captureTab();
        const findColorAction = ActionRegistry.get('find_color');
        if (!findColorAction) throw new Error('未找到找色模块');
        const metrics = await this.tabBridge.callTabMethod('GET_VIEWPORT_METRICS');
        const dpr = metrics?.dpr || 1;
        const res = await findColorAction.searchColorInScreenshot(
          fullShot,
          params.color,
          params.region,
          params.tolerance,
          dpr,
          metrics
        );
        if (res && res.found) {
          this.tabBridge.callTabMethod('HIGHLIGHT_MATCH', {
            rect: {
              x: res.x - 12,
              y: res.y - 12,
              width: 24,
              height: 24
            },
            label: `找色命中: ${res.actualColor}`
          });
        }
        return res;
      },

      getViewportMetrics: () => {
        return this.tabBridge.callTabMethod('GET_VIEWPORT_METRICS');
      },

      getNodes: () => {
        return Array.from(this.canvas.nodes.values()).map((n, idx) => ({
          id: n.id,
          type: n.type,
          name: n.name || ActionRegistry.get(n.type)?.name || n.type,
          index: idx + 1
        }));
      },
      nodeId: nodeData.id,
      nodeName: nodeData.name || actionDef.name
    };

    actionDef.openConfigModal(
      nodeData.config,
      (newConfig, newName) => {
        this.canvas.updateNodeConfig(nodeData.id, newConfig, newName);
        this.logger.info(`已更新节点【${newName || nodeData.name || actionDef.name}】参数配置`);
      },
      () => {},
      modalContext
    );
  }

  // Single step node debugging
  async testSingleNode(nodeData) {
    if (!this.targetTabId && this.tabBridge.isExtension()) {
      alert('请先在顶部下拉列表中选择要执行操作的目标网页！');
      return;
    }
    if (this.tabBridge.isDesktop() && this.targetTabId) {
      await window.electronAPI.focusWindow(this.targetTabId);
      await new Promise(r => setTimeout(r, 60));
    }
    await this.executor.executeSingleNode(nodeData);
  }

  // Initialize Workflow Execution Engine
  initExecutor() {
    this.executor = new FlowExecutor({
      tabBridge: this.tabBridge,
      logger: this.logger,
      onNodeStateChange: (nodeId, state) => {
        this.canvas.setNodeHighlight(nodeId, state);
        if (state === 'active') {
          const node = this.canvas.nodes.get(nodeId);
          const stepName = node ? (node.name || node.type) : nodeId;
          this.updateFloatingStatus('running', `执行: ${stepName}`);
        }
      },
      onFinish: () => {
        this.updateRunButtons(false);
        this.statusTagEl.textContent = '完成';
        this.statusTagEl.style.background = '#059669';
        this.updateFloatingStatus('idle', '流程执行完成');
        setTimeout(() => this.canvas.clearHighlights(), 2000);
      }
    });
  }

  updateFloatingStatus(state, text) {
    // 1. Electron Desktop Native Floating Bar
    if (window.electronAPI && window.electronAPI.updateFloatingStatus) {
      window.electronAPI.updateFloatingStatus({ state, text });
    }

    // 2. In-App Floating Mini HUD
    const hudDot = document.getElementById('in-app-hud-dot');
    const hudText = document.getElementById('in-app-hud-text');
    const hudRun = document.getElementById('in-app-hud-run');
    const hudPause = document.getElementById('in-app-hud-pause');
    const hudStop = document.getElementById('in-app-hud-stop');

    if (hudDot && hudText) {
      hudDot.className = 'mory-hud-dot';
      if (state === 'running') {
        hudDot.classList.add('running');
        if (hudRun) hudRun.style.display = 'none';
        if (hudPause) hudPause.style.display = 'flex';
        if (hudStop) hudStop.style.display = 'flex';
      } else if (state === 'paused') {
        hudDot.classList.add('paused');
        if (hudRun) { hudRun.style.display = 'flex'; hudRun.title = '继续执行'; }
        if (hudPause) hudPause.style.display = 'none';
        if (hudStop) hudStop.style.display = 'flex';
      } else if (state === 'error') {
        hudDot.classList.add('error');
        if (hudRun) { hudRun.style.display = 'flex'; hudRun.title = '重新运行'; }
        if (hudPause) hudPause.style.display = 'none';
        if (hudStop) hudStop.style.display = 'none';
      } else {
        if (hudRun) { hudRun.style.display = 'flex'; hudRun.title = '启动流程'; }
        if (hudPause) hudPause.style.display = 'none';
        if (hudStop) hudStop.style.display = 'none';
      }
      if (text) hudText.textContent = text;
    }
  }

  updateRunButtons(running) {
    const runBtn = document.getElementById('btn-run-flow');
    const pauseBtn = document.getElementById('btn-pause-flow');
    const stopBtn = document.getElementById('btn-stop-flow');

    if (running) {
      runBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'inline-flex';
      this.statusTagEl.textContent = '执行中';
      this.statusTagEl.style.background = '#2563eb';
    } else {
      runBtn.style.display = 'inline-flex';
      pauseBtn.style.display = 'none';
      stopBtn.style.display = 'none';
      pauseBtn.textContent = '⏸ 暂停';
    }
  }

  // Toolbar Actions
  bindToolbarEvents() {
    const runBtn = document.getElementById('btn-run-flow');
    const pauseBtn = document.getElementById('btn-pause-flow');
    const stopBtn = document.getElementById('btn-stop-flow');
    const demoBtn = document.getElementById('btn-demo-flow');
    const importBtn = document.getElementById('btn-import-flow');
    const importFileInput = document.getElementById('inp-import-file');
    const exportBtn = document.getElementById('btn-export-flow');
    const clearBtn = document.getElementById('btn-clear-canvas');
    const floatingBtn = document.getElementById('btn-toggle-floating-hud');

    // Floating HUD toggle
    if (floatingBtn) {
      floatingBtn.addEventListener('click', async () => {
        if (this.tabBridge.isDesktop() && window.electronAPI && window.electronAPI.toggleFloatingHUD) {
          await window.electronAPI.toggleFloatingHUD();
        } else {
          const hud = document.getElementById('in-app-floating-hud');
          if (hud) {
            hud.style.display = (hud.style.display === 'none' || !hud.style.display) ? 'flex' : 'none';
          }
        }
      });
    }

    // Dropdown toggle for compact screens
    const fileDropdownBtn = document.getElementById('btn-file-dropdown');
    const fileDropdownMenu = document.getElementById('file-dropdown-menu');
    if (fileDropdownBtn && fileDropdownMenu) {
      fileDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileDropdownMenu.style.display = fileDropdownMenu.style.display === 'none' ? 'flex' : 'none';
      });
      document.addEventListener('click', () => {
        fileDropdownMenu.style.display = 'none';
      });
      document.getElementById('menu-item-demo')?.addEventListener('click', () => demoBtn.click());
      document.getElementById('menu-item-import')?.addEventListener('click', () => importBtn.click());
      document.getElementById('menu-item-export')?.addEventListener('click', () => exportBtn.click());
      document.getElementById('menu-item-clear')?.addEventListener('click', () => clearBtn.click());
    }

    // In-App Floating HUD controls
    const inAppHud = document.getElementById('in-app-floating-hud');
    if (inAppHud) {
      document.getElementById('in-app-hud-run')?.addEventListener('click', () => runBtn.click());
      document.getElementById('in-app-hud-pause')?.addEventListener('click', () => pauseBtn.click());
      document.getElementById('in-app-hud-stop')?.addEventListener('click', () => stopBtn.click());
      document.getElementById('in-app-hud-close')?.addEventListener('click', () => { inAppHud.style.display = 'none'; });

      // Drag in-app floating HUD
      const handle = inAppHud.querySelector('.mory-hud-handle');
      if (handle) {
        let isDraggingHud = false;
        let hudStartX = 0, hudStartY = 0;
        let origLeft = 0, origTop = 0;
        handle.addEventListener('mousedown', (e) => {
          isDraggingHud = true;
          hudStartX = e.clientX;
          hudStartY = e.clientY;
          const rect = inAppHud.getBoundingClientRect();
          origLeft = rect.left;
          origTop = rect.top;
          e.stopPropagation();
        });
        window.addEventListener('mousemove', (e) => {
          if (!isDraggingHud) return;
          const dx = e.clientX - hudStartX;
          const dy = e.clientY - hudStartY;
          inAppHud.style.left = `${Math.max(10, origLeft + dx)}px`;
          inAppHud.style.top = `${Math.max(10, origTop + dy)}px`;
          inAppHud.style.right = 'auto';
        });
        window.addEventListener('mouseup', () => { isDraggingHud = false; });
      }
    }

    // Listen for Desktop Floating Actions from Electron IPC
    if (window.electronAPI && window.electronAPI.onFloatingAction) {
      window.electronAPI.onFloatingAction((action) => {
        if (action === 'run') runBtn.click();
        if (action === 'pause') pauseBtn.click();
        if (action === 'stop') stopBtn.click();
      });
    }

    // Run
    runBtn.addEventListener('click', async () => {
      if (!this.targetTabId && this.tabBridge.isExtension()) {
        alert('请先在顶部栏选择目标网页标签页！');
        return;
      }
      if (this.tabBridge.isDesktop() && this.targetTabId) {
        await window.electronAPI.focusWindow(this.targetTabId);
        await new Promise(r => setTimeout(r, 60));
      }
      this.canvas.clearHighlights();
      this.updateRunButtons(true);
      this.updateFloatingStatus('running', '正在启动流程...');
      const graphData = this.canvas.exportData();
      this.executor.runFlow(graphData);
    });

    // Pause / Resume
    pauseBtn.addEventListener('click', () => {
      if (this.executor.isPaused) {
        this.executor.resume();
        pauseBtn.innerHTML = '<span>⏸</span> 暂停';
        this.updateFloatingStatus('running', '流程继续执行');
      } else {
        this.executor.pause();
        pauseBtn.innerHTML = '<span>▶</span> 继续';
        this.updateFloatingStatus('paused', '流程已暂停');
      }
    });

    // Stop
    stopBtn.addEventListener('click', () => {
      this.executor.stop();
      this.updateRunButtons(false);
      this.statusTagEl.textContent = '已停止';
      this.statusTagEl.style.background = '#dc2626';
      this.updateFloatingStatus('idle', '流程已停止');
    });

    // Demo Template
    demoBtn.addEventListener('click', async () => {
      try {
        const resp = await fetch('templates/demo-flow.json');
        const demoData = await resp.json();
        this.canvas.importData(demoData);
        this.logger.success('成功加载演示流程模板（包含找图、移动、点击、滚动）');
      } catch (e) {
        alert('加载演示模板失败: ' + e.message);
      }
    });

    // Export Flow JSON
    exportBtn.addEventListener('click', () => {
      const data = this.canvas.exportData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mory-automation-flow-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.logger.success('自动化工作流已成功导出为 JSON 文件');
    });

    // Import Flow JSON
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          this.canvas.importData(data);
          this.logger.success(`成功导入工作流: ${file.name}`);
        } catch (err) {
          alert('解析流程 JSON 失败: ' + err.message);
        }
      };
      reader.readAsText(file);
      importFileInput.value = '';
    });

    // Clear Canvas
    clearBtn.addEventListener('click', () => {
      if (confirm('确认清空当前画布上的所有步骤吗？')) {
        this.canvas.clear();
        this.logger.info('画布已清空');
      }
    });
  }

  saveToLocalStorage() {
    try {
      const data = this.canvas.exportData();
      localStorage.setItem('__mory_automation_current_flow__', JSON.stringify(data));
      localStorage.setItem('__mory_rpa_current_flow__', JSON.stringify(data));
    } catch (e) {}
  }

  async loadInitialWorkflow() {
    try {
      const saved = localStorage.getItem('__mory_automation_current_flow__') || localStorage.getItem('__mory_rpa_current_flow__');
      if (saved) {
        const data = JSON.parse(saved);
        if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
          this.canvas.importData(data);
          return;
        }
      }
    } catch (e) {}

    // First time fallback: load demo flow
    try {
      const resp = await fetch('templates/demo-flow.json');
      const demoData = await resp.json();
      this.canvas.importData(demoData);
    } catch (e) {}
  }

  generateMockScreenshot() {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#334155';
    ctx.font = '24px sans-serif';
    ctx.fillText('模拟网页视口画面 (1280x720)', 60, 80);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(520, 360, 120, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('确认提交', 545, 388);
    return canvas.toDataURL('image/png');
  }
}

// Start Application
window.addEventListener('DOMContentLoaded', () => {
  window.__MORY_APP__ = new DesignerApp();
});
