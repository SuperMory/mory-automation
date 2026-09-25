// modal-stop.js - Modal dialog for Terminate / Stop Workflow configuration

import { ModalBase } from './modal-base.js';

export class ModalStop extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '结束流程',
      width: 440,
      onSave,
      onCancel
    });
    this.config = Object.assign({
      message: '自动化流程顺利执行完成'
    }, config);
    this.context = context;
  }

  show() {
    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>流程执行到此步骤时，将终止后续所有步骤并给出完成提示</span>
      </div>

      <div class="mory-form-row mory-flex-align" style="margin-top: 14px;">
        <label class="mory-label-inline" style="width: 90px;">完成提示信息</label>
        <input type="text" class="mory-input" id="inp-stop-msg" value="${this.config.message || '自动化流程顺利执行完成'}" style="flex: 1;">
      </div>
    `;

    const el = this.createContainer(html);
    return el;
  }

  collectFormData() {
    const message = (this.modalEl.querySelector('#inp-stop-msg')?.value || '').trim();
    return {
      message: message || '自动化流程顺利执行完成'
    };
  }
}
