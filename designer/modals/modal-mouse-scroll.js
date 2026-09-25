// modal-mouse-scroll.js - Modal dialog for "滚动滚轮" (Matching Image 3)

import { ModalBase } from './modal-base.js';

export class ModalMouseScroll extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '滚动滚轮',
      width: 480,
      onSave,
      onCancel
    });
    this.config = Object.assign({
      scrollType: 'vertical', // vertical | horizontal
      direction: 'down', // down | up | left | right
      steps: 1,
      delay: 0,
      delayUnit: 'ms'
    }, config);
    this.context = context;
  }

  show() {
    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>滚动鼠标滚轮，支持垂直或水平方向滚动</span>
      </div>

      <div class="mory-form-row mory-flex-align" style="gap: 16px;">
        <div class="mory-flex-align">
          <label class="mory-label-inline">滚动类型</label>
          <select class="mory-select" id="sel-scroll-type" style="width: 100px;">
            <option value="vertical" ${this.config.scrollType === 'vertical' ? 'selected' : ''}>垂直</option>
            <option value="horizontal" ${this.config.scrollType === 'horizontal' ? 'selected' : ''}>水平</option>
          </select>
        </div>

        <div class="mory-flex-align">
          <label class="mory-label-inline">滚动方向</label>
          <select class="mory-select" id="sel-scroll-direction" style="width: 100px;">
            <!-- Options dynamically populated based on scrollType -->
          </select>
        </div>
      </div>

      <div class="mory-form-row mory-flex-align" style="margin-top: 16px;">
        <label class="mory-label-inline">滚动步数</label>
        <input type="number" class="mory-input mory-input-number" id="inp-steps" value="${this.config.steps}" min="1" step="1">
        <span class="mory-unit-text" style="margin-left: 8px;">步</span>
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

    const typeSelect = el.querySelector('#sel-scroll-type');
    const dirSelect = el.querySelector('#sel-scroll-direction');

    const updateDirections = (type, currentVal) => {
      dirSelect.innerHTML = '';
      if (type === 'vertical') {
        const optDown = new Option('向下', 'down', false, currentVal === 'down');
        const optUp = new Option('向上', 'up', false, currentVal === 'up');
        dirSelect.add(optDown);
        dirSelect.add(optUp);
      } else {
        const optRight = new Option('向右', 'right', false, currentVal === 'right');
        const optLeft = new Option('向左', 'left', false, currentVal === 'left');
        dirSelect.add(optRight);
        dirSelect.add(optLeft);
      }
    };

    updateDirections(this.config.scrollType, this.config.direction);

    typeSelect.addEventListener('change', (e) => {
      const newType = e.target.value;
      updateDirections(newType, newType === 'vertical' ? 'down' : 'right');
    });

    return el;
  }

  collectFormData() {
    const scrollType = this.modalEl.querySelector('#sel-scroll-type').value;
    const direction = this.modalEl.querySelector('#sel-scroll-direction').value;
    const steps = Math.max(1, Number(this.modalEl.querySelector('#inp-steps').value) || 1);
    const rawDelay = Number(this.modalEl.querySelector('#inp-delay').value) || 0;
    const unit = this.modalEl.querySelector('#sel-delay-unit').value;
    const delay = unit === 's' ? rawDelay * 1000 : rawDelay;

    return {
      scrollType,
      direction,
      steps,
      delay,
      delayUnit: unit
    };
  }
}
