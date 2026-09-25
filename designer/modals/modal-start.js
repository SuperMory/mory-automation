// modal-start.js - Modal dialog for "开始" (Flow Start)

import { ModalBase } from './modal-base.js';

export class ModalStart extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '开始流程配置',
      width: 480,
      onSave,
      onCancel,
      context
    });
    this.config = Object.assign({
      startDelay: 0,
      remark: '流程起始点'
    }, config);
    this.context = context;
  }

  show() {
    const html = `
      <div class="mory-info-tip" style="background: #ecfdf5; border-color: #a7f3d0; color: #065f46;">
        <span class="mory-info-icon">🚀</span>
        <span>流程执行的总起点，点击运行后将从此节点开始顺着连线顺序往下执行</span>
      </div>

      <div class="mory-form-row mory-flex-align" style="margin-top: 14px;">
        <label class="mory-label-inline" style="width: 100px;">启动前等待</label>
        <input type="number" class="mory-input mory-input-number" id="inp-start-delay" value="${this.config.startDelay || 0}" min="0" max="60" step="1" style="width: 80px;">
        <span class="mory-unit-text" style="margin-left: 8px;">秒</span>
        <span class="mory-help-bubble" style="margin-left: 8px;" title="在流程开始前留出准备缓冲时间，例如给用户切换窗口或准备界面">?</span>
      </div>

      <div class="mory-form-row" style="margin-top: 14px; align-items: flex-start;">
        <label class="mory-label-inline" style="width: 100px; padding-top: 4px;">流程备注</label>
        <input type="text" class="mory-input" id="inp-start-remark" value="${this.config.remark || ''}" placeholder="例如: 网页自动签到与数据抓取流程" style="flex: 1;">
      </div>
    `;

    return this.createContainer(html);
  }

  collectFormData() {
    const startDelay = Math.max(0, Number(this.modalEl.querySelector('#inp-start-delay')?.value) || 0);
    const remark = (this.modalEl.querySelector('#inp-start-remark')?.value || '').trim();

    return {
      startDelay,
      remark
    };
  }
}
