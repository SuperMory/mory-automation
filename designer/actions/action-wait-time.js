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
    let rawDuration = Number(config?.duration);
    if (isNaN(rawDuration) || rawDuration < 0) rawDuration = 100;
    const unit = String(config?.unit || 'ms').toLowerCase();
    const isSeconds = unit === 's' || unit === 'sec' || unit === 'second' || unit.includes('秒');
    const ms = Math.max(0, Math.round(isSeconds ? rawDuration * 1000 : rawDuration));

    context.logger.info(`[等待时间] 等待 ${ms} 毫秒 (${isSeconds ? rawDuration + '秒' : rawDuration + 'ms'})...`);

    if (context.sleep) {
      const res = await context.sleep(ms, '等待时间');
      if (res.cancelled) {
        context.logger.warn('[等待时间] 等待被用户终止');
        return { success: false, stopWorkflow: true };
      }
    } else {
      // Fallback robust sleep with wall-clock precision (immune to timer drift & background throttling)
      const startTime = Date.now();
      while (Date.now() - startTime < ms) {
        if (context.isCancelled && context.isCancelled()) {
          context.logger.warn('[等待时间] 等待被用户终止');
          return { success: false, stopWorkflow: true };
        }
        const remaining = ms - (Date.now() - startTime);
        if (remaining <= 0) break;
        await new Promise(r => setTimeout(r, Math.min(50, remaining)));
      }
    }

    return { success: true, nextPort: 'default' };
  }
};
