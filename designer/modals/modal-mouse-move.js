// modal-mouse-move.js - Modal dialog for "移动鼠标" (Matching Image 1)

import { ModalBase } from './modal-base.js';

export class ModalMouseMove extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '移动鼠标',
      width: 480,
      onSave,
      onCancel
    });
    this.config = Object.assign({
      x: 0,
      y: 0,
      jitterEnabled: false,
      jitterX: 0,
      jitterY: 0,
      delay: 0,
      delayUnit: 'ms' // ms
    }, config);
    this.context = context; // tabId, app controller
  }

  show() {
    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>将鼠标移动到指定位置</span>
      </div>

      <div class="mory-form-row mory-flex-align">
        <label class="mory-label-inline">移动到坐标</label>
        <span class="mory-coord-axis">X</span>
        <input type="number" class="mory-input mory-input-number" id="inp-x" value="${this.config.x}" min="0" step="1">
        <span class="mory-coord-axis" style="margin-left: 8px;">Y</span>
        <input type="number" class="mory-input mory-input-number" id="inp-y" value="${this.config.y}" min="0" step="1">
        <button type="button" class="mory-btn-outline" id="btn-pick-coord" style="margin-left: 12px;">选取坐标</button>
      </div>

      <div class="mory-form-group" style="margin-top: 14px;">
        <div class="mory-flex-align">
          <label class="mory-checkbox-label">
            <input type="checkbox" id="chk-jitter" ${this.config.jitterEnabled ? 'checked' : ''}>
            <span>添加坐标随机抖动</span>
          </label>
          <span class="mory-help-bubble" title="在执行移动时随机偏移指定像素，模拟真人操作">?</span>
          
          <div class="mory-jitter-inputs" id="jitter-wrap" style="margin-left: 20px; display: inline-flex; flex-direction: column; gap: 8px;">
            <div class="mory-flex-align">
              <span class="mory-sub-label">x ±随机</span>
              <input type="number" class="mory-input mory-input-number-sm" id="inp-jitter-x" value="${this.config.jitterX}" min="0">
              <span class="mory-unit-text">像素</span>
            </div>
            <div class="mory-flex-align">
              <span class="mory-sub-label">y ±随机</span>
              <input type="number" class="mory-input mory-input-number-sm" id="inp-jitter-y" value="${this.config.jitterY}" min="0">
              <span class="mory-unit-text">像素</span>
            </div>
          </div>
        </div>
      </div>

      <div class="mory-form-row mory-flex-align" style="margin-top: 18px;">
        <label class="mory-label-inline">延迟</label>
        <input type="number" class="mory-input mory-input-number" id="inp-delay" value="${this.config.delay}" min="0" step="10">
        <select class="mory-select" id="sel-delay-unit" style="margin-left: 6px; width: 80px;">
          <option value="ms" selected>毫秒</option>
          <option value="s">秒</option>
        </select>
        <span class="mory-suffix-text">后执行下一个动作</span>
      </div>
    `;

    const el = this.createContainer(html);

    // Bind coordinate picker button
    const pickBtn = el.querySelector('#btn-pick-coord');
    pickBtn.addEventListener('click', () => {
      this.triggerPickCoordinate();
    });

    return el;
  }

  triggerPickCoordinate() {
    const pickBtn = this.modalEl.querySelector('#btn-pick-coord');
    pickBtn.disabled = true;
    pickBtn.textContent = '请在网页单击...';

    if (this.context && this.context.startPickCoordinate) {
      this.context.startPickCoordinate((res) => {
        pickBtn.disabled = false;
        pickBtn.textContent = '选取坐标';
        if (res && !res.canceled) {
          this.modalEl.querySelector('#inp-x').value = res.x;
          this.modalEl.querySelector('#inp-y').value = res.y;
        }
      });
    } else {
      // Fallback prompt
      setTimeout(() => {
        pickBtn.disabled = false;
        pickBtn.textContent = '选取坐标';
        const testX = prompt('请输入拾取的 X 坐标 (模拟拾取):', '320');
        const testY = prompt('请输入拾取的 Y 坐标 (模拟拾取):', '240');
        if (testX !== null && testY !== null) {
          this.modalEl.querySelector('#inp-x').value = Number(testX) || 0;
          this.modalEl.querySelector('#inp-y').value = Number(testY) || 0;
        }
      }, 300);
    }
  }

  collectFormData() {
    const x = Number(this.modalEl.querySelector('#inp-x').value) || 0;
    const y = Number(this.modalEl.querySelector('#inp-y').value) || 0;
    const jitterEnabled = this.modalEl.querySelector('#chk-jitter').checked;
    const jitterX = Number(this.modalEl.querySelector('#inp-jitter-x').value) || 0;
    const jitterY = Number(this.modalEl.querySelector('#inp-jitter-y').value) || 0;
    const rawDelay = Number(this.modalEl.querySelector('#inp-delay').value) || 0;
    const unit = this.modalEl.querySelector('#sel-delay-unit').value;
    const delay = unit === 's' ? rawDelay * 1000 : rawDelay;

    return {
      x,
      y,
      jitterEnabled,
      jitterX,
      jitterY,
      delay,
      delayUnit: unit
    };
  }
}
