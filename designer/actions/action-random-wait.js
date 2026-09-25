// action-random-wait.js - Random Wait Action Definition (Matching Image 4)

import { ModalRandomWait } from '../modals/modal-random-wait.js';

export const ActionRandomWait = {
  type: 'random_wait',
  category: 'flow',
  name: '随机等待时间',
  description: '随机生成一个等待时间后继续执行',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
    </svg>
  `,
  color: '#f97316',
  defaultConfig: {
    minMs: 1,
    maxMs: 100
  },
  formatSummary(config) {
    return `随机等待 ${config.minMs}ms ~ ${config.maxMs}ms`;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalRandomWait(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    const min = Math.max(0, Number(config.minMs) || 1);
    const max = Math.max(min, Number(config.maxMs) || 100);
    const randomMs = Math.round(min + Math.random() * (max - min));

    context.logger.info(`[随机等待] 随机生成等待: ${randomMs} 毫秒 (范围: ${min}~${max}ms)...`);

    // Interruptible sleep checking cancellation every 100ms
    const step = 100;
    let elapsed = 0;
    while (elapsed < randomMs) {
      if (context.isCancelled && context.isCancelled()) {
        context.logger.warn('[随机等待] 等待被用户终止');
        return { success: false, stopWorkflow: true };
      }
      const wait = Math.min(step, randomMs - elapsed);
      await new Promise(r => setTimeout(r, wait));
      elapsed += wait;
    }

    return { success: true, nextPort: 'default' };
  }
};
