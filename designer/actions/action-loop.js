import { ModalLoop } from '../modals/modal-loop.js';

export const ActionLoop = {
  type: 'flow_loop',
  category: 'flow',
  name: '循环控制',
  description: '循环重复执行后续流程步骤',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="17 1 21 5 17 9"></polyline>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
      <polyline points="7 23 3 19 7 15"></polyline>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
    </svg>
  `,
  color: '#3b82f6',
  hasBranchOut: true,
  outputPorts: [
    { id: 'body', name: '循环执行', color: '#10b981' },
    { id: 'done', name: '循环结束', color: '#64748b' }
  ],
  defaultConfig: {
    loopType: 'times', // 'times' | 'infinite'
    times: 3,
    _counter: 0
  },
  formatSummary(config) {
    if (config.loopType === 'infinite') return '无限循环执行';
    return `循环执行 ${config.times || 3} 次`;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalLoop(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    config._counter = (config._counter || 0) + 1;

    if (config.loopType === 'infinite') {
      context.logger.info(`[循环控制] 第 ${config._counter} 次循环迭代`);
      return { success: true, nextPort: 'body' };
    }

    const maxTimes = Math.max(1, Number(config.times) || 1);
    if (config._counter <= maxTimes) {
      context.logger.info(`[循环控制] 进度: (${config._counter} / ${maxTimes}) 次`);
      return { success: true, nextPort: 'body' };
    } else {
      context.logger.success(`[循环控制] 已完成全部 ${maxTimes} 次循环`);
      config._counter = 0; // Reset for next execution run
      return { success: true, nextPort: 'done' };
    }
  }
};
