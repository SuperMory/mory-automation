// modal-loop.js - Modal dialog for Loop Control configuration

import { ModalBase } from './modal-base.js';

export class ModalLoop extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '循环控制',
      width: 440,
      onSave,
      onCancel
    });
    this.config = Object.assign({
      loopType: 'times', // 'times' | 'infinite'
      times: 3,
      _counter: 0
    }, config);
    this.context = context;
  }

  show() {
    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>控制流程重复执行，“循环执行”分支连接循环体，“循环结束”分支连接退出后的步骤</span>
      </div>

      <div class="mory-form-row" style="align-items: flex-start; margin-top: 14px;">
        <label class="mory-label-inline" style="padding-top: 4px; width: 100px;">循环模式</label>
        <div class="mory-flex-col" style="gap: 12px;">
          <div class="mory-flex-align">
            <label class="mory-radio-label">
              <input type="radio" name="loop-mode" value="times" ${this.config.loopType === 'times' ? 'checked' : ''}>
              <span>指定循环次数</span>
            </label>
            <input type="number" class="mory-input mory-input-number" id="inp-loop-times" value="${this.config.times || 3}" min="1" max="9999" style="margin: 0 8px;">
            <span class="mory-unit-text">次</span>
          </div>

          <label class="mory-radio-label">
            <input type="radio" name="loop-mode" value="infinite" ${this.config.loopType === 'infinite' ? 'checked' : ''}>
            <span>无限循环 (配合找图/找色成功时跳转或结束)</span>
          </label>
        </div>
      </div>
    `;

    const el = this.createContainer(html);
    this.bindEvents(el);
    return el;
  }

  bindEvents(el) {
    const radioTimes = el.querySelector('input[value="times"]');
    const radioInf = el.querySelector('input[value="infinite"]');
    const inpTimes = el.querySelector('#inp-loop-times');

    radioTimes.addEventListener('change', () => {
      inpTimes.disabled = false;
      inpTimes.focus();
    });

    radioInf.addEventListener('change', () => {
      inpTimes.disabled = true;
    });

    inpTimes.disabled = this.config.loopType === 'infinite';
  }

  collectFormData() {
    const mode = this.modalEl.querySelector('input[name="loop-mode"]:checked')?.value || 'times';
    const times = Math.max(1, Number(this.modalEl.querySelector('#inp-loop-times').value) || 1);

    return {
      loopType: mode,
      times: mode === 'infinite' ? 0 : times,
      _counter: 0
    };
  }
}
