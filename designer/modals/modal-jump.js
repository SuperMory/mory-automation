// modal-jump.js - Modal dialog for Jump / Goto Step configuration

import { ModalBase } from './modal-base.js';

export class ModalJump extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '跳转到指定步骤',
      width: 480,
      onSave,
      onCancel,
      context
    });
    this.config = Object.assign({
      targetNodeId: '',
      targetNodeName: ''
    }, config);
    this.context = context;
  }

  show() {
    // Get existing canvas nodes to populate quick selection dropdown if available
    const nodes = this.context?.getNodes ? this.context.getNodes() : [];
    const currentNodeId = this.nodeId || this.context?.nodeId || '';

    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>无条件跳转到流程中的指定步骤继续运行，可跨分支或跳出循环</span>
      </div>

      <div class="mory-form-row mory-flex-align" style="margin-top: 14px;">
        <label class="mory-label-inline" style="width: 100px;">目标步骤节点</label>
        ${nodes.length > 0 ? `
          <select class="mory-select" id="sel-jump-target" style="flex: 1;">
            <option value="">-- 请选择要跳转的目标步骤 --</option>
            ${nodes.map(n => {
              const isCurrent = n.id === currentNodeId;
              const currentTag = isCurrent ? ' (当前步骤 - 勿选以防死循环)' : '';
              return `
                <option value="${n.id}" ${this.config.targetNodeId === n.id ? 'selected' : ''}>
                  步骤 ${n.index || ''}：【${n.name || n.type}】 (ID: ${n.id})${currentTag}
                </option>
              `;
            }).join('')}
            <option value="custom" ${this.config.targetNodeId && !nodes.some(n => n.id === this.config.targetNodeId) ? 'selected' : ''}>-- 手动输入步骤ID --</option>
          </select>
        ` : ''}
      </div>

      <div class="mory-form-row mory-flex-align" id="row-custom-target" style="margin-top: 12px; display: ${nodes.length === 0 || (this.config.targetNodeId && !nodes.some(n => n.id === this.config.targetNodeId)) ? 'flex' : 'none'};">
        <label class="mory-label-inline" style="width: 100px;">步骤 ID / 标识</label>
        <input type="text" class="mory-input" id="inp-jump-target" value="${this.config.targetNodeId || ''}" placeholder="例如: step_1" style="flex: 1;">
      </div>
    `;

    const el = this.createContainer(html);
    this.bindEvents(el);
    return el;
  }

  bindEvents(el) {
    const sel = el.querySelector('#sel-jump-target');
    const rowCustom = el.querySelector('#row-custom-target');
    const inp = el.querySelector('#inp-jump-target');

    if (sel) {
      sel.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          rowCustom.style.display = 'flex';
          inp.focus();
        } else if (e.target.value) {
          rowCustom.style.display = 'none';
          inp.value = e.target.value;
        } else {
          rowCustom.style.display = 'flex';
        }
      });
    }
  }

  collectFormData() {
    const sel = this.modalEl.querySelector('#sel-jump-target');
    let target = sel && sel.value !== 'custom' && sel.value !== '' ? sel.value : '';
    if (!target) {
      target = (this.modalEl.querySelector('#inp-jump-target')?.value || '').trim();
    }

    const nodes = this.context?.getNodes ? this.context.getNodes() : [];
    const matchedNode = nodes.find(n => n.id === target);
    const targetNodeName = matchedNode ? (matchedNode.name || matchedNode.type) : (this.config.targetNodeName || '');

    return {
      targetNodeId: target,
      targetNodeName: targetNodeName
    };
  }
}
