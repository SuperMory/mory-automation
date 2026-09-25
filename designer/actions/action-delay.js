// action-delay.js - Delay/Wait Action Definition (Bonus standard flow action)

export const ActionDelay = {
  type: 'delay_wait',
  category: 'flow',
  name: '延时等待',
  description: '流程暂停等待指定的时长',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  `,
  color: '#eab308',
  defaultConfig: {
    duration: 1000,
    unit: 'ms'
  },
  formatSummary(config) {
    return `等待 ${config.duration} ${config.unit === 's' ? '秒' : '毫秒'}`;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const rawVal = config.duration || 1000;
    const input = prompt('请输入等待时间(毫秒):', rawVal);
    if (input !== null) {
      onSave({ duration: Number(input) || 1000, unit: 'ms' });
    } else {
      onCancel();
    }
  },
  async execute(context, config) {
    let rawDuration = Number(config?.duration);
    if (isNaN(rawDuration) || rawDuration < 0) rawDuration = 1000;
    const unit = String(config?.unit || 'ms').toLowerCase();
    const isSeconds = unit === 's' || unit === 'sec' || unit.includes('秒');
    const ms = Math.max(0, Math.round(isSeconds ? rawDuration * 1000 : rawDuration));

    context.logger.info(`[延时等待] 等待 ${ms}ms...`);
    if (context.sleep) {
      const res = await context.sleep(ms, '延时等待');
      if (res.cancelled) {
        return { success: false, stopWorkflow: true };
      }
    } else {
      await new Promise(r => setTimeout(r, ms));
    }
    return { success: true, nextPort: 'default' };
  }
};
