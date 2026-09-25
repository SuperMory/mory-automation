// action-wait-time.js - Wait Time Action Definition (Matching Image 3)

import { ModalWaitTime } from '../modals/modal-wait-time.js';

export const ActionWaitTime = {
  type: 'wait_time',
  category: 'flow',
  name: '等待时间',
  description: '等待一会再进行下一个任务',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  `,
  color: '#eab308',
  defaultConfig: {
    duration: 100,
    unit: 'ms'
  },
  formatSummary(config) {
    return `等待 ${config.duration} ${config.unit === 's' ? '秒' : '毫秒'}`;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalWaitTime(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    const ms = config.unit === 's' ? config.duration * 1000 : config.duration;
    context.logger.info(`[等待时间] 等待 ${ms} 毫秒...`);

    // Interruptible sleep checking cancellation every 100ms
    const step = 100;
    let elapsed = 0;
    while (elapsed < ms) {
      if (context.isCancelled && context.isCancelled()) {
        context.logger.warn('[等待时间] 等待被用户终止');
        return { success: false, stopWorkflow: true };
      }
      const wait = Math.min(step, ms - elapsed);
      await new Promise(r => setTimeout(r, wait));
      elapsed += wait;
    }

    return { success: true, nextPort: 'default' };
  }
};
