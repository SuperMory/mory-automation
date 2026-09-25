// background.js - Service Worker for Chrome/Edge Extension (MV3)

let activePickerSession = null; // { designerTabId, targetTabId, mode }

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Mory RPA] Extension installed / updated:', details.reason);
});

// Helper: Ensure content scripts are injected into target tab
async function ensureContentScript(tabId) {
  try {
    // Ping to check if already installed
    const pong = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: 'PING' }, (res) => {
        if (chrome.runtime.lastError || !res) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });

    if (!pong) {
      console.log(`[Mory RPA] Injecting content script into tab ${tabId}...`);
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/content.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/picker.js', 'content/content.js']
      });
    }
    return true;
  } catch (err) {
    console.warn(`[Mory RPA] Cannot inject script into tab ${tabId}:`, err.message);
    return false;
  }
}

// Communication Hub
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case 'GET_TABS': {
      // Query tabs that can be automated
      chrome.tabs.query({}, (tabs) => {
        const validTabs = (tabs || []).filter(tab => {
          if (!tab.url) return false;
          return tab.url.startsWith('http://') || tab.url.startsWith('https://') || tab.url.startsWith('file://');
        }).map(tab => ({
          id: tab.id,
          title: tab.title || '无标题网页',
          url: tab.url,
          favIconUrl: tab.favIconUrl || '',
          active: tab.active
        }));
        sendResponse({ success: true, tabs: validTabs });
      });
      return true;
    }

    case 'OPEN_DESIGNER': {
      const url = chrome.runtime.getURL('designer/designer.html');
      chrome.tabs.query({ url }, (existingTabs) => {
        if (existingTabs && existingTabs.length > 0) {
          chrome.tabs.update(existingTabs[0].id, { active: true });
          chrome.windows.update(existingTabs[0].windowId, { focused: true });
          sendResponse({ success: true, tabId: existingTabs[0].id });
        } else {
          chrome.tabs.create({ url }, (newTab) => {
            sendResponse({ success: true, tabId: newTab.id });
          });
        }
      });
      return true;
    }

    case 'START_PICKER': {
      // payload: { targetTabId, mode: 'coordinate' | 'region' | 'snip', callbackId }
      const designerTabId = sender?.tab?.id;
      const { targetTabId, mode, callbackId } = payload || {};

      if (!targetTabId) {
        sendResponse({ success: false, error: '请先在顶部选择目标网页！' });
        return false;
      }

      activePickerSession = {
        designerTabId,
        targetTabId,
        mode,
        callbackId
      };

      // Ensure script injected, then switch to target tab and activate picker overlay
      ensureContentScript(targetTabId).then(() => {
        chrome.tabs.update(targetTabId, { active: true }, () => {
          // Allow target tab to render and paint cleanly before capturing
          setTimeout(() => {
            chrome.tabs.captureVisibleTab(undefined, { format: 'png' }, (preCapturedDataUrl) => {
              if (chrome.runtime.lastError) {
                console.warn('[Mory RPA] Pre-capture warning:', chrome.runtime.lastError.message);
              }
              const actionMap = {
                coordinate: 'START_PICK_COORDINATE',
                region: 'START_PICK_REGION',
                snip: 'START_SCREEN_SNIP',
                color: 'START_PICK_COLOR'
              };
              const action = actionMap[mode] || 'START_PICK_REGION';

              chrome.tabs.sendMessage(targetTabId, {
                action,
                params: {
                  callbackId,
                  preCapturedDataUrl: preCapturedDataUrl || ''
                }
              }, (res) => {
                sendResponse({ success: true, status: 'PICKER_ACTIVATED' });
              });
            });
          }, 60);
        });
      });
      return true;
    }

    case 'PICKER_RESULT': {
      // Received from content script picker.js
      const result = payload;
      console.log('[Mory RPA] Picker result received:', result);

      const session = activePickerSession;
      const designerTabId = session?.designerTabId;

      // Switch back to designer tab if available
      if (designerTabId) {
        chrome.tabs.update(designerTabId, { active: true }, () => {
          // Forward result to designer tab
          chrome.tabs.sendMessage(designerTabId, {
            type: 'PICKER_RESULT',
            payload: result
          }, () => {
            if (chrome.runtime.lastError) {
              // Ignore if already closed
            }
          });
        });
      }

      // Also broadcast to all extension runtime views
      try {
        chrome.runtime.sendMessage({
          type: 'PICKER_RESULT',
          payload: result
        });
      } catch (e) {}

      activePickerSession = null;
      sendResponse({ success: true });
      return false;
    }

    case 'CAPTURE_TAB': {
      // Capture visible area of specified tab
      const targetTabId = payload?.tabId;
      const getWindowId = (callback) => {
        if (targetTabId) {
          chrome.tabs.get(targetTabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
              callback(null);
            } else {
              callback(tab.windowId);
            }
          });
        } else {
          callback(null);
        }
      };

      getWindowId((windowId) => {
        const captureOptions = { format: 'png' };
        const winArg = windowId ? windowId : undefined;
        chrome.tabs.captureVisibleTab(winArg, captureOptions, (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            sendResponse({
              success: false,
              error: chrome.runtime.lastError ? chrome.runtime.lastError.message : '截图失败'
            });
          } else {
            // Also retrieve viewport metrics from the target tab
            if (targetTabId) {
              ensureContentScript(targetTabId).then(() => {
                chrome.tabs.sendMessage(targetTabId, { action: 'GET_VIEWPORT_METRICS' }, (mRes) => {
                  if (chrome.runtime.lastError || !mRes) {
                    sendResponse({ success: true, dataUrl, metrics: null });
                  } else {
                    sendResponse({ success: true, dataUrl, metrics: mRes });
                  }
                });
              });
            } else {
              sendResponse({ success: true, dataUrl, metrics: null });
            }
          }
        });
      });
      return true;
    }

    case 'CALL_TAB_METHOD': {
      const { tabId, action, params } = payload || {};
      if (!tabId) {
        sendResponse({ success: false, error: '未指定目标标签页' });
        return false;
      }

      ensureContentScript(tabId).then(() => {
        chrome.tabs.sendMessage(tabId, { action, params }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message + ' (请确认网页已加载完成且已刷新)'
            });
          } else {
            sendResponse(response || { success: true });
          }
        });
      });
      return true;
    }

    default:
      sendResponse({ success: false, error: `未知的操作类型: ${type}` });
      return false;
  }
});
