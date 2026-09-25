// modal-hotkey.js - Modal dialog for Keyboard Actions with Custom Hotkey and Text Typing

import { ModalBase } from './modal-base.js';

export class ModalHotkey extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '键盘操作',
      width: 490,
      onSave,
      onCancel
    });
    this.config = Object.assign({
      mode: 'hotkey', // 'hotkey' | 'type_text'
      hotkey: 'Ctrl+C',
      customKey: '',
      typeText: '',
      charDelay: 20, // ms per character
      delay: 0,
      delayUnit: 'ms'
    }, config);
    this.context = context;
  }

  show() {
    const hotkeys = [
      { key: 'Ctrl+C', label: 'Ctrl+C (复制)' },
      { key: 'Ctrl+V', label: 'Ctrl+V (粘贴)' },
      { key: 'Ctrl+A', label: 'Ctrl+A (全选)' },
      { key: 'Ctrl+X', label: 'Ctrl+X (剪切)' },
      { key: 'Ctrl+Z', label: 'Ctrl+Z (撤销)' },
      { key: 'Ctrl+S', label: 'Ctrl+S (保存)' },
      { key: 'Enter', label: 'Enter (回车键)' },
      { key: 'Tab', label: 'Tab (制表键)' },
      { key: 'Escape', label: 'Esc (退出键)' },
      { key: 'Backspace', label: 'Backspace (退格键)' },
      { key: 'Delete', label: 'Delete (删除键)' },
      { key: 'Space', label: 'Space (空格键)' },
      { key: 'F5', label: 'F5 (刷新)' }
    ];

    const isPreset = hotkeys.some(h => h.key === this.config.hotkey);
    const activeKey = this.config.hotkey || 'Ctrl+C';

    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>执行键盘按键输入，支持预设快捷键、自定义按键录制及文本批量输入</span>
      </div>

      <!-- 模式单选 -->
      <div class="mory-form-row mory-flex-align" style="gap: 16px; margin-bottom: 16px;">
        <label class="mory-radio-label">
          <input type="radio" name="kb-mode" value="hotkey" ${this.config.mode === 'hotkey' ? 'checked' : ''}>
          <span>按键 / 快捷键</span>
        </label>
        <label class="mory-radio-label">
          <input type="radio" name="kb-mode" value="type_text" ${this.config.mode === 'type_text' ? 'checked' : ''}>
          <span>输入文本内容</span>
        </label>
      </div>

      <!-- 按键模式面板 -->
      <div id="panel-hotkey" style="display: ${this.config.mode === 'hotkey' ? 'block' : 'none'};">
        <div class="mory-form-row mory-flex-align" style="margin-top: 12px;">
          <label class="mory-label-inline" style="width: 140px;">预设快捷按键</label>
          <select class="mory-select" id="sel-hotkey" style="flex: 1; max-width: 220px;">
            ${hotkeys.map(h => `
              <option value="${h.key}" ${isPreset && activeKey === h.key ? 'selected' : ''}>${h.label}</option>
            `).join('')}
            <option value="custom" ${!isPreset ? 'selected' : ''}>-- 自定义按键 --</option>
          </select>
        </div>

        <div class="mory-form-row mory-flex-align" id="row-custom-key" style="margin-top: 12px; display: ${!isPreset ? 'flex' : 'none'};">
          <label class="mory-label-inline" style="width: 140px;">自定义键盘按键</label>
          <input type="text" class="mory-input" id="inp-custom-key" value="${this.config.customKey || (!isPreset ? activeKey : '')}" placeholder="点击此处，直接按下键盘按键录制" style="flex: 1; font-weight: 600; color: #10b981;">
          <span class="mory-help-bubble" title="聚焦后直接在键盘上敲击目标按键，将自动捕获并填入，如 F12、Ctrl+Shift+I 等">?</span>
        </div>
      </div>

      <!-- 文本输入模式面板 -->
      <div id="panel-text" style="display: ${this.config.mode === 'type_text' ? 'block' : 'none'};">
        <div class="mory-form-row" style="align-items: flex-start; margin-top: 12px;">
          <label class="mory-label-inline" style="width: 140px; padding-top: 6px;">输入自定义文本</label>
          <textarea class="mory-input" id="inp-type-text" rows="3" placeholder="请输入要自动打字输入的文字内容..." style="flex: 1; resize: vertical; min-height: 60px;">${this.config.typeText || ''}</textarea>
        </div>
        <div class="mory-form-row mory-flex-align" style="margin-top: 12px;">
          <label class="mory-label-inline" style="width: 140px;">字符输入间隔</label>
          <input type="number" class="mory-input mory-input-number" id="inp-char-delay" value="${this.config.charDelay || 20}" min="0" step="5">
          <span class="mory-unit-text">毫秒 / 字 (模拟真人打字速度)</span>
        </div>
      </div>

      <!-- 延迟 -->
      <div class="mory-form-row mory-flex-align" style="margin-top: 18px;">
        <label class="mory-label-inline" style="width: 50px;">延迟</label>
        <input type="number" class="mory-input mory-input-number" id="inp-hotkey-delay" value="${this.config.delay}" min="0" step="10">
        <select class="mory-select" id="sel-hotkey-unit" style="margin-left: 6px; width: 80px;">
          <option value="ms" selected>毫秒</option>
          <option value="s">秒</option>
        </select>
        <span class="mory-suffix-text">后执行下一个动作</span>
      </div>
    `;

    const el = this.createContainer(html);
    this.bindEvents(el);
    return el;
  }

  bindEvents(el) {
    const radioHot = el.querySelector('input[value="hotkey"]');
    const radioText = el.querySelector('input[value="type_text"]');
    const panelHot = el.querySelector('#panel-hotkey');
    const panelText = el.querySelector('#panel-text');
    const selHotkey = el.querySelector('#sel-hotkey');
    const rowCustom = el.querySelector('#row-custom-key');
    const inpCustom = el.querySelector('#inp-custom-key');

    radioHot.addEventListener('change', () => {
      panelHot.style.display = 'block';
      panelText.style.display = 'none';
    });

    radioText.addEventListener('change', () => {
      panelHot.style.display = 'none';
      panelText.style.display = 'block';
    });

    selHotkey.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        rowCustom.style.display = 'flex';
        inpCustom.focus();
      } else {
        rowCustom.style.display = 'none';
      }
    });

    // Capture custom key combinations live
    inpCustom.addEventListener('keydown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Win');

      const k = e.key;
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(k)) {
        parts.push(k.length === 1 ? k.toUpperCase() : k);
      }

      const combo = parts.join('+');
      if (combo) {
        inpCustom.value = combo;
      }
    });
  }

  collectFormData() {
    const mode = this.modalEl.querySelector('input[name="kb-mode"]:checked')?.value || 'hotkey';
    const selVal = this.modalEl.querySelector('#sel-hotkey').value;
    const customKey = this.modalEl.querySelector('#inp-custom-key').value.trim();

    let finalHotkey = selVal;
    if (selVal === 'custom') {
      finalHotkey = customKey || 'Enter';
    }

    const typeText = this.modalEl.querySelector('#inp-type-text').value;
    const charDelay = Math.max(0, Number(this.modalEl.querySelector('#inp-char-delay').value) || 20);

    const rawDelay = Number(this.modalEl.querySelector('#inp-hotkey-delay').value) || 0;
    const unit = this.modalEl.querySelector('#sel-hotkey-unit').value;
    const delay = unit === 's' ? rawDelay * 1000 : rawDelay;

    return {
      mode,
      hotkey: finalHotkey,
      customKey,
      typeText,
      charDelay,
      delay,
      delayUnit: unit
    };
  }
}
