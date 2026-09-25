// action-mouse-click.js - Mouse Click Action Definition

import { ModalMouseClick } from '../modals/modal-mouse-click.js';

export const ActionMouseClick = {
  type: 'mouse_click',
  category: 'mouse',
  name: '鼠标点击',
  description: '在当前鼠标所在位置触发点击或按键动作',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="7"></rect>
      <line x1="12" y1="6" x2="12" y2="10"></line>
    </svg>
  `,
  color: '#10b981',
  defaultConfig: {
    clickPosition: 'current', // 'current' | 'coord'
    x: 0,
    y: 0,
    button: 'left',
    actionType: 'click',
    modifiers: {
      leftCtrl: false,
      rightCtrl: false,
      leftShift: false,
      rightShift: false,
      leftAlt: false,
      rightAlt: false,
      leftWin: false,
      rightWin: false
    },
    delay: 0,
    delayUnit: 'ms'
  },
  formatSummary(config) {
    const btnMap = { left: '左键', right: '右键', middle: '中键' };
    const actMap = { click: '单击', dblclick: '双击', down: '按下', up: '松开' };
    const posStr = config.clickPosition === 'coord' ? `(${config.x ?? 0}, ${config.y ?? 0}) ` : '';
    let text = `${posStr}${btnMap[config.button] || '左键'} ${actMap[config.actionType] || '单击'}`;

    const activeMods = Object.entries(config.modifiers || {})
      .filter(([_, v]) => v)
      .map(([k]) => k.replace(/^(left|right)/, ''));
    if (activeMods.length > 0) {
      text += ` + [${[...new Set(activeMods)].join('+')}]`;
    }
    if (config.delay > 0) {
      const delayStr = (config.delay >= 1000 && config.delay % 1000 === 0) ? `${config.delay / 1000}秒` : `${config.delay}ms`;
      text += ` | 延时${delayStr}`;
    }
    return text;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalMouseClick(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    context.logger.info(`[鼠标点击] 执行: ${this.formatSummary(config)}`);
    const clickParams = {
      button: config.button,
      actionType: config.actionType,
      modifiers: config.modifiers,
      delay: config.delay
    };

    if (config.clickPosition === 'coord') {
      clickParams.x = Number(config.x) || 0;
      clickParams.y = Number(config.y) || 0;
      await context.tabBridge.callTabMethod('EXECUTE_MOVE_MOUSE', { x: clickParams.x, y: clickParams.y });
      await new Promise(r => setTimeout(r, 60));
    }

    const res = await context.tabBridge.callTabMethod('EXECUTE_MOUSE_CLICK', clickParams);

    if (res && res.success) {
      const coordStr = res.coords ? ` (${res.coords.x}, ${res.coords.y})` : '';
      context.logger.success(`[鼠标点击] 完成，点击元素: <${res.element || 'BODY'}>${coordStr}`);
      return { success: true, nextPort: 'default' };
    } else {
      context.logger.error(`[鼠标点击] 执行失败: ${res?.error || '通信异常'}`);
      return { success: false, error: res?.error };
    }
  }
};
