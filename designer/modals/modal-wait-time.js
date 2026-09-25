// modal-wait-time.js - Modal dialog for "等待时间" (Matching Image 3)

import { ModalBase } from './modal-base.js';

export class ModalWaitTime extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '等待时间',
      width: 440,
      onSave,
      onCancel
    });
    this.config = Object.assign({
      duration: 100,
      unit: 'ms'
    }, config);
    this.context = context;
  }

  show() {
    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>等待一会再进行下一个任务</span>
      </div>

      <div class="mory-form-row mory-flex-align" style="margin-top: 16px;">
        <label class="mory-label-inline" style="width: 80px;">等待时间</label>
        <input type="number" class="mory-input mory-input-number" id="inp-wait-duration" value="${this.config.duration}" min="0" step="10">
        <select class="mory-select" id="sel-wait-unit" style="margin-left: 8px; width: 90px;">
          <option value="ms" ${this.config.unit === 'ms' ? 'selected' : ''}>毫秒</option>
          <option value="s" ${this.config.unit === 's' ? 'selected' : ''}>秒</option>
        </select>
      </div>
    `;

    return this.createContainer(html);
  }

  collectFormData() {
    const duration = Math.max(0, Number(this.modalEl.querySelector('#inp-wait-duration').value) || 0);
    const unit = this.modalEl.querySelector('#sel-wait-unit').value;
    return {
      duration,
      unit
    };
  }
}
