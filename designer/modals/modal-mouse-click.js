// modal-mouse-click.js - Modal dialog for "鼠标点击" (Matching Image 2)

import { ModalBase } from './modal-base.js';

export class ModalMouseClick extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '鼠标点击',
      width: 480,
      onSave,
      onCancel
    });
    this.config = Object.assign({
      clickPosition: 'current', // 'current' | 'coord'
      x: 0,
      y: 0,
      button: 'left', // left | right | middle
      actionType: 'click', // click | dblclick | down | up
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
    }, config);
    this.context = context;
  }

  show() {
    const mods = this.config.modifiers || {};
    const isCoord = this.config.clickPosition === 'coord';
    const isSec = this.config.delayUnit === 's';
    const displayDelay = isSec ? ((this.config.delay || 0) / 1000) : (this.config.delay || 0);
    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>模拟鼠标在网页或屏幕上的点击动作</span>
      </div>

      <div class="mory-form-row mory-flex-align">
        <label class="mory-label-inline">点击位置</label>
        <label class="mory-radio-label" style="margin-right: 14px; cursor: pointer;">
          <input type="radio" name="rad-click-pos" value="current" ${!isCoord ? 'checked' : ''}>
          <span>当前鼠标所在位置</span>
        </label>
        <label class="mory-radio-label" style="cursor: pointer;">
          <input type="radio" name="rad-click-pos" value="coord" ${isCoord ? 'checked' : ''}>
          <span>指定坐标位置</span>
        </label>
      </div>

      <div class="mory-form-row mory-flex-align" id="row-click-coord" style="display: ${isCoord ? 'flex' : 'none'};">
        <label class="mory-label-inline">目标坐标</label>
        <span class="mory-coord-axis">X</span>
        <input type="number" class="mory-input mory-input-number" id="inp-click-x" value="${this.config.x || 0}" min="0" step="1">
        <span class="mory-coord-axis" style="margin-left: 8px;">Y</span>
        <input type="number" class="mory-input mory-input-number" id="inp-click-y" value="${this.config.y || 0}" min="0" step="1">
        <button type="button" class="mory-btn-outline" id="btn-pick-click-coord" style="margin-left: 12px;">选取坐标</button>
      </div>

      <div class="mory-form-row mory-flex-align" style="gap: 16px; margin-top: 14px;">
        <div class="mory-flex-align">
          <label class="mory-label-inline">鼠标按键</label>
          <select class="mory-select" id="sel-button" style="width: 110px;">
            <option value="left" ${this.config.button === 'left' ? 'selected' : ''}>鼠标左键</option>
            <option value="right" ${this.config.button === 'right' ? 'selected' : ''}>鼠标右键</option>
            <option value="middle" ${this.config.button === 'middle' ? 'selected' : ''}>鼠标中键</option>
          </select>
        </div>

        <div class="mory-flex-align">
          <label class="mory-label-inline">点击动作</label>
          <select class="mory-select" id="sel-action" style="width: 150px;">
            <option value="click" ${this.config.actionType === 'click' ? 'selected' : ''}>单击 (按下+松开)</option>
            <option value="dblclick" ${this.config.actionType === 'dblclick' ? 'selected' : ''}>双击</option>
            <option value="down" ${this.config.actionType === 'down' ? 'selected' : ''}>按下</option>
            <option value="up" ${this.config.actionType === 'up' ? 'selected' : ''}>松开</option>
          </select>
        </div>
      </div>

      <div class="mory-form-row" style="margin-top: 16px; align-items: flex-start;">
        <label class="mory-label-inline" style="padding-top: 2px;">同时按下键盘</label>
        <div class="mory-modifiers-grid">
          <label class="mory-checkbox-label">
            <input type="checkbox" id="mod-l-ctrl" ${mods.leftCtrl ? 'checked' : ''}>
            <span>左Ctrl</span>
          </label>
          <label class="mory-checkbox-label">
            <input type="checkbox" id="mod-r-ctrl" ${mods.rightCtrl ? 'checked' : ''}>
            <span>右Ctrl</span>
          </label>

          <label class="mory-checkbox-label">
            <input type="checkbox" id="mod-l-shift" ${mods.leftShift ? 'checked' : ''}>
            <span>左Shift</span>
          </label>
          <label class="mory-checkbox-label">
            <input type="checkbox" id="mod-r-shift" ${mods.rightShift ? 'checked' : ''}>
            <span>右Shift</span>
          </label>

          <label class="mory-checkbox-label">
            <input type="checkbox" id="mod-l-alt" ${mods.leftAlt ? 'checked' : ''}>
            <span>左Alt</span>
          </label>
          <label class="mory-checkbox-label">
            <input type="checkbox" id="mod-r-alt" ${mods.rightAlt ? 'checked' : ''}>
            <span>右Alt</span>
          </label>

          <label class="mory-checkbox-label">
            <input type="checkbox" id="mod-l-win" ${mods.leftWin ? 'checked' : ''}>
            <span>左Win</span>
          </label>
          <label class="mory-checkbox-label">
            <input type="checkbox" id="mod-r-win" ${mods.rightWin ? 'checked' : ''}>
            <span>右Win</span>
          </label>
        </div>
      </div>

      <div class="mory-form-row mory-flex-align" style="margin-top: 18px;">
        <label class="mory-label-inline">延迟</label>
        <input type="number" class="mory-input mory-input-number" id="inp-delay" value="${displayDelay}" min="0" step="${isSec ? '0.1' : '10'}">
        <select class="mory-select" id="sel-delay-unit" style="margin-left: 6px; width: 80px;">
          <option value="ms" ${!isSec ? 'selected' : ''}>毫秒</option>
          <option value="s" ${isSec ? 'selected' : ''}>秒</option>
        </select>
        <span class="mory-suffix-text">后执行下一个动作</span>
      </div>
    `;

    const el = this.createContainer(html);
    this.bindEvents(el);
    return el;
  }

  bindEvents(el) {
    const selUnit = el.querySelector('#sel-delay-unit');
    const inpDelay = el.querySelector('#inp-delay');
    if (selUnit && inpDelay) {
      selUnit.addEventListener('change', () => {
        const val = Number(inpDelay.value) || 0;
        if (selUnit.value === 's') {
          if (val >= 1000) inpDelay.value = (val / 1000).toFixed(1).replace(/\.0$/, '');
          inpDelay.step = '0.1';
        } else {
          inpDelay.value = Math.round(val * 1000);
          inpDelay.step = '10';
        }
      });
    }

    const radios = el.querySelectorAll('input[name="rad-click-pos"]');
    const rowCoord = el.querySelector('#row-click-coord');
    const pickBtn = el.querySelector('#btn-pick-click-coord');

    radios.forEach(r => {
      r.addEventListener('change', () => {
        rowCoord.style.display = r.value === 'coord' && r.checked ? 'flex' : 'none';
      });
    });

    if (pickBtn) {
      pickBtn.addEventListener('click', () => {
        pickBtn.disabled = true;
        pickBtn.textContent = '请在目标上单击...';

        if (this.context && this.context.startPickCoordinate) {
          this.context.startPickCoordinate((res) => {
            pickBtn.disabled = false;
            pickBtn.textContent = '选取坐标';
            if (res && !res.canceled) {
              el.querySelector('#inp-click-x').value = res.x;
              el.querySelector('#inp-click-y').value = res.y;
            }
          });
        } else {
          setTimeout(() => {
            pickBtn.disabled = false;
            pickBtn.textContent = '选取坐标';
            const testX = prompt('请输入拾取的 X 坐标 (模拟拾取):', '320');
            const testY = prompt('请输入拾取的 Y 坐标 (模拟拾取):', '240');
            if (testX !== null && testY !== null) {
              el.querySelector('#inp-click-x').value = Number(testX) || 0;
              el.querySelector('#inp-click-y').value = Number(testY) || 0;
            }
          }, 300);
        }
      });
    }
  }

  collectFormData() {
    const isCoord = this.modalEl.querySelector('input[name="rad-click-pos"]:checked')?.value === 'coord';
    const x = Number(this.modalEl.querySelector('#inp-click-x')?.value) || 0;
    const y = Number(this.modalEl.querySelector('#inp-click-y')?.value) || 0;

    const button = this.modalEl.querySelector('#sel-button').value;
    const actionType = this.modalEl.querySelector('#sel-action').value;
    const modifiers = {
      leftCtrl: this.modalEl.querySelector('#mod-l-ctrl').checked,
      rightCtrl: this.modalEl.querySelector('#mod-r-ctrl').checked,
      leftShift: this.modalEl.querySelector('#mod-l-shift').checked,
      rightShift: this.modalEl.querySelector('#mod-r-shift').checked,
      leftAlt: this.modalEl.querySelector('#mod-l-alt').checked,
      rightAlt: this.modalEl.querySelector('#mod-r-alt').checked,
      leftWin: this.modalEl.querySelector('#mod-l-win').checked,
      rightWin: this.modalEl.querySelector('#mod-r-win').checked
    };
    const rawDelay = Math.max(0, Number(this.modalEl.querySelector('#inp-delay').value) || 0);
    const unit = this.modalEl.querySelector('#sel-delay-unit').value;
    const delay = unit === 's' ? Math.round(rawDelay * 1000) : Math.round(rawDelay);

    return {
      clickPosition: isCoord ? 'coord' : 'current',
      x,
      y,
      button,
      actionType,
      modifiers,
      delay,
      delayUnit: unit
    };
  }
}
