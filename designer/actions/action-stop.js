import { ModalStop } from '../modals/modal-stop.js';

export const ActionStop = {
  type: 'flow_stop',
  category: 'flow',
  name: '结束流程',
  description: '到达此步骤时，正常终止整个自动化流程',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    </svg>
  `,
  color: '#ef4444',
  defaultConfig: {
    message: '自动化流程顺利执行完成'
  },
  formatSummary(config) {
    return `终止: ${config.message || '执行完毕'}`;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalStop(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    context.logger.success(`[结束流程] ${config.message || '自动化流程顺利执行完成'}`);
    return { success: true, stopWorkflow: true };
  }
};
