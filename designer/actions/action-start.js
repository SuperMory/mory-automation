// action-start.js - Flow Start Action Definition
import { ModalStart } from '../modals/modal-start.js';

export const ActionStart = {
  type: 'flow_start',
  category: 'flow',
  name: '开始',
  description: '流程运行的起始起点，由该节点开始顺序执行后续步骤',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="6 4 20 12 6 20 6 4" fill="#10b981"></polygon>
    </svg>
  `,
  color: '#10b981',
  defaultConfig: {
    startDelay: 0,
    remark: '流程起始点'
  },
  formatSummary(config) {
    if (config && config.startDelay > 0) {
      return `等待 ${config.startDelay} 秒后启动流程`;
    }
    return '流程起点 (顺序向下执行)';
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalStart(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    const delaySec = Math.max(0, Number(config?.startDelay) || 0);
    if (delaySec > 0) {
      context.logger.info(`[开始流程] 延时准备: 等待 ${delaySec} 秒...`);
      if (context.sleep) {
        const res = await context.sleep(delaySec * 1000, '开始延时');
        if (res.cancelled) {
          context.logger.warn('[开始流程] 流程在启动等待阶段被终止');
          return { success: false, stopWorkflow: true };
        }
      } else {
        await new Promise(r => setTimeout(r, delaySec * 1000));
      }
    }
    context.logger.success('[开始流程] 自动化流程正式开始执行 ✔');
    return { success: true, nextPort: 'default' };
  }
};
