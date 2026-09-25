// popup.js - Extension popup toolbar logic

document.addEventListener('DOMContentLoaded', () => {
  const activeTabTitle = document.getElementById('active-tab-title');
  const activeTabUrl = document.getElementById('active-tab-url');
  let currentActiveTab = null;

  // Query active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      currentActiveTab = tabs[0];
      activeTabTitle.textContent = currentActiveTab.title || '当前标签页';
      activeTabUrl.textContent = currentActiveTab.url || '';
    } else {
      activeTabTitle.textContent = '未获取到当前标签页';
    }
  });

  // Open Designer Studio
  document.getElementById('btn-open-designer').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_DESIGNER' }, () => {
      window.close();
    });
  });

  // Quick Run: open designer and trigger execution
  document.getElementById('btn-quick-run').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_DESIGNER' }, () => {
      window.close();
    });
  });

  // Quick Pick Coordinate
  document.getElementById('btn-quick-coord').addEventListener('click', () => {
    if (!currentActiveTab) return;
    chrome.tabs.sendMessage(currentActiveTab.id, {
      action: 'START_PICK_COORDINATE',
      params: { callbackId: 'popup_coord' }
    }, () => {
      window.close();
    });
  });

  // Quick Screen Snip
  document.getElementById('btn-quick-snip').addEventListener('click', () => {
    if (!currentActiveTab) return;
    chrome.tabs.sendMessage(currentActiveTab.id, {
      action: 'START_SCREEN_SNIP',
      params: { callbackId: 'popup_snip' }
    }, () => {
      window.close();
    });
  });
});
