import { ModalJump } from '../modals/modal-jump.js';

export const ActionJump = {
  type: 'flow_jump',
  category: 'flow',
  name: '跳转到指定步骤',
  description: '无条件跳转到指定的流程步骤继续执行',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `,
  color: '#8b5cf6',
  defaultConfig: {
    targetNodeId: '',
    targetNodeName: ''
  },
  formatSummary(config) {
    if (!config.targetNodeId) return '跳转至: 未指定步骤';
    const nameStr = config.targetNodeName ? `【${config.targetNodeName}】` : '';
    return `跳转至: ${nameStr}(${config.targetNodeId})`;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalJump(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    if (!config.targetNodeId) {
      context.logger.warn('[跳转步骤] 未配置目标步骤，按原路径继续');
      return { success: true, nextPort: 'default' };
    }
    const nameStr = config.targetNodeName ? `【${config.targetNodeName}】` : '';
    context.logger.info(`[跳转步骤] 流程跳转至步骤: ${nameStr}(${config.targetNodeId})`);
    return { success: true, jumpToNodeId: config.targetNodeId };
  }
};
