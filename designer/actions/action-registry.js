// action-registry.js - Central Extensible Action Registry

import { ActionStart } from './action-start.js';
import { ActionMouseMove } from './action-mouse-move.js';
import { ActionMouseClick } from './action-mouse-click.js';
import { ActionMouseScroll } from './action-mouse-scroll.js';
import { ActionFindImage } from './action-find-image.js';
import { ActionOcrText } from './action-ocr-text.js';
import { ActionHotkey } from './action-hotkey.js';
import { ActionWaitTime } from './action-wait-time.js';
import { ActionRandomWait } from './action-random-wait.js';
import { ActionFindColor } from './action-find-color.js';
import { ActionLoop } from './action-loop.js';
import { ActionJump } from './action-jump.js';
import { ActionStop } from './action-stop.js';

class ActionRegistryClass {
  constructor() {
    this.registry = new Map();
    this.categories = [
      { id: 'flow', name: '流程控制', icon: '🔀' },
      { id: 'mouse', name: '鼠标操作', icon: '🖱️' },
      { id: 'keyboard', name: '键盘与输入', icon: '⌨️' },
      { id: 'image', name: '图像与识别', icon: '🖼️' }
    ];

    // Register all core actions (Start is first!)
    this.register(ActionStart);
    this.register(ActionMouseMove);
    this.register(ActionMouseClick);
    this.register(ActionMouseScroll);
    this.register(ActionHotkey);
    this.register(ActionFindImage);
    this.register(ActionFindColor);
    this.register(ActionOcrText);
    this.register(ActionWaitTime);
    this.register(ActionRandomWait);
    this.register(ActionLoop);
    this.register(ActionJump);
    this.register(ActionStop);
  }

  /**
   * Register a new action definition (Open for extension!)
   * @param {Object} actionDef - Action definition object
   */
  register(actionDef) {
    if (!actionDef || !actionDef.type) {
      throw new Error('动作定义必须包含唯一 type 属性');
    }
    this.registry.set(actionDef.type, actionDef);
    console.log(`[Mory RPA] Registered Action: [${actionDef.type}] ${actionDef.name}`);
  }

  get(type) {
    return this.registry.get(type);
  }

  getAll() {
    return Array.from(this.registry.values());
  }

  getByCategory(categoryId) {
    return this.getAll().filter(item => item.category === categoryId);
  }

  getCategories() {
    return this.categories;
  }
}

export const ActionRegistry = new ActionRegistryClass();
