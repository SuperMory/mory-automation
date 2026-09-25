// action-mouse-move.js - Mouse Move Action Definition

import { ModalMouseMove } from '../modals/modal-mouse-move.js';

export const ActionMouseMove = {
  type: 'mouse_move',
  category: 'mouse',
  name: '移动鼠标',
  description: '将鼠标平滑移动到指定坐标位置',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
      <path d="M13 13l6 6"></path>
    </svg>
  `,
  color: '#3b82f6',
  defaultConfig: {
    x: 100,
    y: 100,
    jitterEnabled: false,
    jitterX: 0,
    jitterY: 0,
    delay: 0,
    delayUnit: 'ms'
  },
  formatSummary(config) {
    let text = `移动至 (${config.x}, ${config.y})`;
    if (config.jitterEnabled && (config.jitterX > 0 || config.jitterY > 0)) {
      text += ` ±(${config.jitterX}, ${config.jitterY})`;
    }
    if (config.delay > 0) {
      text += ` | 延时${config.delay}ms`;
    }
    return text;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalMouseMove(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    context.logger.info(`[移动鼠标] 目标坐标: (${config.x}, ${config.y})`);
    const res = await context.tabBridge.callTabMethod('EXECUTE_MOVE_MOUSE', {
      x: config.x,
      y: config.y,
      jitterEnabled: config.jitterEnabled,
      jitterX: config.jitterX,
      jitterY: config.jitterY,
      delay: config.delay
    });

    if (res && res.success) {
      context.logger.success(`[移动鼠标] 完成，当前坐标: (${res.coords.x}, ${res.coords.y})`);
      return { success: true, nextPort: 'default' };
    } else {
      context.logger.error(`[移动鼠标] 执行失败: ${res?.error || '通信异常'}`);
      return { success: false, error: res?.error };
    }
  }
};
