// action-hotkey.js - Enhanced Keyboard Action with Custom Keys and Typing

import { ModalHotkey } from '../modals/modal-hotkey.js';

export const ActionHotkey = {
  type: 'hotkey',
  category: 'keyboard',
  name: '键盘按键与输入',
  description: '支持自定义按键、快捷键组合以及自动文本输入',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
      <line x1="6" y1="8" x2="6" y2="8"></line>
      <line x1="10" y1="8" x2="10" y2="8"></line>
      <line x1="14" y1="8" x2="14" y2="8"></line>
      <line x1="18" y1="8" x2="18" y2="8"></line>
      <line x1="8" y1="16" x2="16" y2="16"></line>
    </svg>
  `,
  color: '#6366f1',
  defaultConfig: {
    mode: 'hotkey',
    hotkey: 'Ctrl+C',
    customKey: '',
    typeText: '',
    charDelay: 20,
    delay: 0,
    delayUnit: 'ms'
  },
  formatSummary(config) {
    if (config.mode === 'type_text') {
      const preview = config.typeText ? `"${config.typeText.slice(0, 10)}..."` : '空文本';
      return `输入文本: ${preview}`;
    }
    let text = `按键: ${config.hotkey || 'Ctrl+C'}`;
    if (config.delay > 0) {
      const delayStr = (config.delay >= 1000 && config.delay % 1000 === 0) ? `${config.delay / 1000}秒` : `${config.delay}ms`;
      text += ` | 延时${delayStr}`;
    }
    return text;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalHotkey(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    if (config.mode === 'type_text') {
      context.logger.info(`[键盘输入] 开始输入文本: "${config.typeText}"`);
      const res = await context.tabBridge.callTabMethod('EXECUTE_TEXT_INPUT', {
        text: config.typeText || '',
        charDelay: config.charDelay || 20,
        delay: config.delay
      });
      if (res && res.success) {
        context.logger.success(`[键盘输入] 文本输入完成`);
        return { success: true, nextPort: 'default' };
      } else {
        context.logger.error(`[键盘输入] 失败: ${res?.error || '通信异常'}`);
        return { success: false, error: res?.error };
      }
    }

    // Hotkey / Custom key mode
    context.logger.info(`[键盘按键] 发送按键: ${config.hotkey}`);
    const res = await context.tabBridge.callTabMethod('EXECUTE_HOTKEY', {
      hotkey: config.hotkey,
      delay: config.delay
    });

    if (res && res.success) {
      context.logger.success(`[键盘按键] 成功触发按键: ${config.hotkey}`);
      return { success: true, nextPort: 'default' };
    } else {
      context.logger.error(`[键盘按键] 执行失败: ${res?.error || '通信异常'}`);
      return { success: false, error: res?.error };
    }
  }
};
