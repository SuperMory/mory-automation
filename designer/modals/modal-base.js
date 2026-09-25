// modal-base.js - Base modal popup manager matching user's UI style

export class ModalBase {
  constructor(options = {}) {
    this.title = options.title || '配置';
    this.width = options.width || 460;
    this.onSave = options.onSave || (() => {});
    this.onCancel = options.onCancel || (() => {});
    this.context = options.context || {};
    this.nodeId = options.nodeId || options.context?.nodeId || '';
    this.nodeName = options.nodeName || options.context?.nodeName || '';
    this.modalEl = null;
    this.overlayEl = null;
  }

  createContainer(contentHtml) {
    // Remove existing if any
    const existing = document.getElementById('mory-active-modal');
    if (existing) existing.remove();

    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'mory-active-modal';
    this.overlayEl.className = 'mory-modal-backdrop';

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'mory-modal-window';
    this.modalEl.style.width = typeof this.width === 'number' ? `${this.width}px` : this.width;

    const activeNodeId = this.nodeId || this.context?.nodeId;
    const activeNodeName = this.nodeName || this.context?.nodeName || '';
    let metaBarHtml = '';
    if (activeNodeId) {
      metaBarHtml = `
        <div class="mory-modal-step-info-bar">
          <div class="mory-step-id-box">
            <span class="mory-step-meta-label">步骤 ID:</span>
            <span class="mory-step-id-tag" id="lbl-modal-step-id" title="步骤节点唯一标识">${activeNodeId}</span>
            <button type="button" class="mory-modal-btn-copy" id="btn-modal-copy-id" title="点击复制步骤ID">📋 复制</button>
          </div>
          <div class="mory-step-name-box">
            <span class="mory-step-meta-label">步骤名称:</span>
            <input type="text" class="mory-input mory-input-node-name" id="inp-modal-node-name" value="${activeNodeName}" placeholder="自定义步骤别名" maxlength="30" />
          </div>
        </div>
      `;
    }

    this.modalEl.innerHTML = `
      <div class="mory-modal-header">
        <h3 class="mory-modal-title">${this.title}</h3>
        <button type="button" class="mory-modal-close" title="关闭">&times;</button>
      </div>
      <div class="mory-modal-body">
        ${metaBarHtml}
        ${contentHtml}
      </div>
      <div class="mory-modal-footer">
        <button type="button" class="mory-btn mory-btn-cancel">取消</button>
        <button type="button" class="mory-btn mory-btn-confirm">确定</button>
      </div>
    `;

    this.overlayEl.appendChild(this.modalEl);
    document.body.appendChild(this.overlayEl);

    // Close handlers
    const closeBtn = this.modalEl.querySelector('.mory-modal-close');
    const cancelBtn = this.modalEl.querySelector('.mory-btn-cancel');
    const confirmBtn = this.modalEl.querySelector('.mory-btn-confirm');
    const copyBtn = this.modalEl.querySelector('#btn-modal-copy-id');

    if (copyBtn && activeNodeId) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(activeNodeId);
        copyBtn.textContent = '✔ 已复制';
        setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 1200);
      });
    }

    const doClose = () => {
      this.close();
      this.onCancel();
    };

    closeBtn.addEventListener('click', doClose);
    cancelBtn.addEventListener('click', doClose);

    confirmBtn.addEventListener('click', () => {
      const data = this.collectFormData();
      if (data !== false) {
        const inpName = this.modalEl.querySelector('#inp-modal-node-name');
        const customName = inpName ? inpName.value.trim() : '';
        this.close();
        this.onSave(data, customName);
      }
    });

    // Make modal draggable by header
    this.enableHeaderDrag();

    return this.modalEl;
  }

  enableHeaderDrag() {
    const header = this.modalEl.querySelector('.mory-modal-header');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.style.cursor = 'move';
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.mory-modal-close')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.modalEl.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        this.modalEl.style.position = 'fixed';
        this.modalEl.style.margin = '0';
        this.modalEl.style.left = `${Math.max(10, Math.min(window.innerWidth - rect.width - 10, initialLeft + dx))}px`;
        this.modalEl.style.top = `${Math.max(10, Math.min(window.innerHeight - rect.height - 10, initialTop + dy))}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  collectFormData() {
    // Override in subclasses
    return {};
  }

  close() {
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
      this.modalEl = null;
    }
  }
}
