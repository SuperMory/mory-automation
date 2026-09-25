// modal-random-wait.js - Modal dialog for "随机等待时间" (Matching Image 4)

import { ModalBase } from './modal-base.js';

export class ModalRandomWait extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '随机等待时间',
      width: 440,
      onSave,
      onCancel
    });
    this.config = Object.assign({
      minMs: 1,
      maxMs: 100
    }, config);
    this.context = context;
  }

  show() {
    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>随机生成一个等待时间</span>
      </div>

      <div class="mory-form-group" style="margin-top: 14px;">
        <div class="mory-flex-align">
          <span style="font-size: 13.5px; color: #334155; font-weight: 500;">随机等待时间范围</span>
          <span class="mory-help-bubble" title="流程执行到此步骤时，会在该区间内随机等待指定毫秒">?</span>
        </div>

        <div class="mory-flex-align" style="margin-top: 12px;">
          <input type="number" class="mory-input mory-input-number" id="inp-min-wait" value="${this.config.minMs}" min="0" step="10">
          <span class="mory-unit-text" style="margin: 0 8px;">毫秒 ~</span>
          <input type="number" class="mory-input mory-input-number" id="inp-max-wait" value="${this.config.maxMs}" min="0" step="10">
          <span class="mory-unit-text" style="margin-left: 8px;">毫秒</span>
        </div>
      </div>
    `;

    return this.createContainer(html);
  }

  collectFormData() {
    let minMs = Math.max(0, Number(this.modalEl.querySelector('#inp-min-wait').value) || 0);
    let maxMs = Math.max(0, Number(this.modalEl.querySelector('#inp-max-wait').value) || 0);
    if (minMs > maxMs) {
      const temp = minMs;
      minMs = maxMs;
      maxMs = temp;
    }
    return {
      minMs,
      maxMs
    };
  }
}
