// action-mouse-scroll.js - Mouse Scroll Action Definition

import { ModalMouseScroll } from '../modals/modal-mouse-scroll.js';

export const ActionMouseScroll = {
  type: 'mouse_scroll',
  category: 'mouse',
  name: '滚动滚轮',
  description: '在网页中进行垂直或水平方向的滚轮滚动',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="8 12 12 16 16 12"></polyline>
      <line x1="12" y1="8" x2="12" y2="16"></line>
    </svg>
  `,
  color: '#8b5cf6',
  defaultConfig: {
    scrollType: 'vertical',
    direction: 'down',
    steps: 1,
    delay: 0,
    delayUnit: 'ms'
  },
  formatSummary(config) {
    const dirMap = { down: '向下', up: '向上', left: '向左', right: '向右' };
    let text = `${config.scrollType === 'vertical' ? '垂直' : '水平'} ${dirMap[config.direction] || '向下'} ${config.steps} 步`;
    if (config.delay > 0) {
      const delayStr = (config.delay >= 1000 && config.delay % 1000 === 0) ? `${config.delay / 1000}秒` : `${config.delay}ms`;
      text += ` | 延时${delayStr}`;
    }
    return text;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalMouseScroll(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    context.logger.info(`[滚动滚轮] ${this.formatSummary(config)}`);
    const res = await context.tabBridge.callTabMethod('EXECUTE_MOUSE_SCROLL', {
      scrollType: config.scrollType,
      direction: config.direction,
      steps: config.steps,
      delay: config.delay
    });

    if (res && res.success) {
      const dx = res.delta?.deltaX ?? 0;
      const dy = res.delta?.deltaY ?? 0;
      context.logger.success(`[滚动滚轮] 成功滚动 (ΔX: ${dx}, ΔY: ${dy})`);
      return { success: true, nextPort: 'default' };
    } else {
      context.logger.error(`[滚动滚轮] 执行失败: ${res?.error || '通信异常'}`);
      return { success: false, error: res?.error };
    }
  }
};
