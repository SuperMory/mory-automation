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
    let min = Number(config?.minMs);
    let max = Number(config?.maxMs);
    if (isNaN(min) || min < 0) min = 1;
    if (isNaN(max) || max < 0) max = 100;
    if (min > max) {
      const temp = min;
      min = max;
      max = temp;
    }
    const randomMs = Math.round(min + Math.random() * (max - min));

    context.logger.info(`[随机等待] 随机生成等待: ${randomMs} 毫秒 (范围: ${min}~${max}ms)...`);

    if (context.sleep) {
      const res = await context.sleep(randomMs, '随机等待');
      if (res.cancelled) {
        context.logger.warn('[随机等待] 等待被用户终止');
        return { success: false, stopWorkflow: true };
      }
    } else {
      // Fallback robust sleep with wall-clock precision (immune to timer drift & background throttling)
      const startTime = Date.now();
      while (Date.now() - startTime < randomMs) {
        if (context.isCancelled && context.isCancelled()) {
          context.logger.warn('[随机等待] 等待被用户终止');
          return { success: false, stopWorkflow: true };
        }
        const remaining = randomMs - (Date.now() - startTime);
        if (remaining <= 0) break;
        await new Promise(r => setTimeout(r, Math.min(50, remaining)));
      }
    }

    return { success: true, nextPort: 'default' };
  }
};
