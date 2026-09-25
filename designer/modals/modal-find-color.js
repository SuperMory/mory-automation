// modal-find-color.js - Modal dialog for "找色" (Matching Image 4 & Image 5)

import { ModalBase } from './modal-base.js';

export class ModalFindColor extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '找色',
      width: 520,
      onSave,
      onCancel
    });
    this.config = Object.assign({
      color: '#10B981',
      region: {
        x1: 0,
        y1: 0,
        x2: 1920,
        y2: 1080
      },
      tolerance: 10,
      // 次数与间隔
      repeatMode: 'times',
      repeatTimes: 1,
      intervalMs: 200,
      // 后续动作
      onSuccess: {
        enabled: true,
        mouseAction: 'move', // 'move' | 'click' | 'dblclick'
        targetPosition: 'found_pos',
        nextAction: 'continue',
        jumpStepId: ''
      },
      onFailure: {
        enabled: true,
        waitTime: 200,
        waitUnit: 'ms',
        nextAction: 'continue',
        jumpStepId: ''
      }
    }, config);
    this.context = context;
  }

  show() {
    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>查找指定区域内特定颜色值，以此判断目标是否出现</span>
      </div>

      <!-- 查找颜色 -->
      <div class="mory-form-row mory-flex-align" style="margin-top: 14px;">
        <label class="mory-label-inline">查找颜色</label>
        <div class="mory-flex-align" style="gap: 10px;">
          <input type="color" id="inp-color-picker-native" value="${this.config.color || '#10B981'}" style="width: 32px; height: 32px; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; padding: 0;">
          <input type="text" class="mory-input" id="inp-color-hex" value="${this.config.color || '#10B981'}" style="width: 110px; font-weight: 600; text-transform: uppercase;">
          <button type="button" class="mory-btn-outline" id="btn-pick-color" style="display: flex; align-items: center; gap: 4px;">
            <span>✎</span> 选取颜色
          </button>
        </div>
      </div>

      <!-- 指定区域 -->
      <div class="mory-form-row" style="align-items: flex-start; margin-top: 16px;">
        <label class="mory-label-inline" style="padding-top: 6px;">指定区域</label>
        <div class="mory-flex-col" style="gap: 10px; flex: 1;">
          <div class="mory-flex-align">
            <span class="mory-coord-axis">X1</span>
            <input type="number" class="mory-input mory-input-number" id="inp-fc-x1" value="${this.config.region.x1}" min="0">
            <span class="mory-coord-axis" style="margin-left: 12px;">Y1</span>
            <input type="number" class="mory-input mory-input-number" id="inp-fc-y1" value="${this.config.region.y1}" min="0">
            <button type="button" class="mory-btn-outline" id="btn-fc-pick-region" style="margin-left: 14px;">选取区域</button>
            <span class="mory-help-bubble" title="指定在屏幕或网页视口内的矩形搜索区域">?</span>
          </div>

          <div class="mory-flex-align">
            <span class="mory-coord-axis">X2</span>
            <input type="number" class="mory-input mory-input-number" id="inp-fc-x2" value="${this.config.region.x2}" min="0">
            <span class="mory-coord-axis" style="margin-left: 12px;">Y2</span>
            <input type="number" class="mory-input mory-input-number" id="inp-fc-y2" value="${this.config.region.y2}" min="0">
          </div>
        </div>
      </div>

      <!-- 颜色误差允许范围 -->
      <div class="mory-form-row mory-flex-align" style="margin-top: 16px;">
        <label class="mory-label-inline" style="width: 140px;">颜色误差允许范围</label>
        <input type="number" class="mory-input mory-input-number" id="inp-fc-tolerance" value="${this.config.tolerance}" min="0" max="255">
        <span class="mory-help-bubble" style="margin-left: 8px;" title="RGB三通道颜色允许的最大差值范围，0表示完全一致，一般设为5~25">?</span>
      </div>

      <!-- 测试找色长条大按钮 -->
      <div style="margin-top: 18px; margin-bottom: 18px;">
        <button type="button" class="mory-btn-hero-green" id="btn-test-find-color">测试找色</button>
        <div id="test-fc-result" class="mory-test-result-box" style="display: none;"></div>
      </div>

      <!-- 分隔线：次数与间隔 -->
      <div class="mory-divider-section">
        <div class="mory-divider-title">次数与间隔</div>
      </div>

      <div class="mory-form-row" style="align-items: flex-start; margin-top: 14px;">
        <label class="mory-label-inline" style="padding-top: 2px;">找色次数</label>
        <div class="mory-flex-col" style="gap: 10px;">
          <div class="mory-flex-align">
            <label class="mory-radio-label">
              <input type="radio" name="fc-repeat-mode" value="times" ${this.config.repeatMode === 'times' ? 'checked' : ''}>
              <span>找色</span>
            </label>
            <input type="number" class="mory-input mory-input-number-sm" id="inp-fc-times" value="${this.config.repeatTimes}" min="1" style="margin: 0 6px;">
            <span class="mory-unit-text">次</span>
            <span class="mory-help-bubble" style="margin-left: 6px;" title="尝试匹配颜色的总次数">?</span>
          </div>

          <label class="mory-radio-label">
            <input type="radio" name="fc-repeat-mode" value="loop" ${this.config.repeatMode === 'loop' ? 'checked' : ''}>
            <span>循环识别，直到找到为止</span>
          </label>
        </div>
      </div>

      <div class="mory-form-row mory-flex-align" style="margin-top: 14px;">
        <label class="mory-label-inline">时间间隔</label>
        <span style="font-size: 13px; color: #475569; margin-right: 6px;">每隔</span>
        <input type="number" class="mory-input mory-input-number" id="inp-fc-interval" value="${this.config.intervalMs}" min="50" step="50">
        <span class="mory-suffix-text" style="margin-left: 6px;">毫秒 进行一次识别</span>
      </div>

      <!-- 分隔线：后续动作 -->
      <div class="mory-divider-section" style="margin-top: 20px;">
        <div class="mory-divider-title">后续动作</div>
      </div>

      <!-- 若查找成功 -->
      <div class="mory-form-row" style="align-items: flex-start; margin-top: 14px;">
        <label class="mory-label-inline" style="padding-top: 4px; width: 80px;">若查找成功</label>
        <div class="mory-flex-col" style="gap: 10px; flex: 1;">
          <div class="mory-flex-align" style="flex-wrap: wrap; gap: 8px;">
            <label class="mory-checkbox-label">
              <input type="checkbox" id="chk-fc-succ-mouse" ${this.config.onSuccess?.enabled ? 'checked' : ''}>
              <span>鼠标动作</span>
            </label>
            <select class="mory-select" id="sel-fc-succ-action" style="width: 90px;">
              <option value="move" ${this.config.onSuccess?.mouseAction === 'move' ? 'selected' : ''}>移动到</option>
              <option value="click" ${this.config.onSuccess?.mouseAction === 'click' ? 'selected' : ''}>点击</option>
              <option value="dblclick" ${this.config.onSuccess?.mouseAction === 'dblclick' ? 'selected' : ''}>双击</option>
            </select>
            <select class="mory-select" id="sel-fc-succ-pos" style="width: 140px;">
              <option value="found_pos" selected>查找到的颜色位置</option>
            </select>
          </div>

          <div class="mory-flex-align">
            <span class="mory-sub-label" style="width: 50px;">然后</span>
            <select class="mory-select" id="sel-fc-succ-next" style="width: 160px;">
              <option value="continue" ${this.config.onSuccess?.nextAction === 'continue' ? 'selected' : ''}>继续下一个动作</option>
              <option value="jump" ${this.config.onSuccess?.nextAction === 'jump' ? 'selected' : ''}>跳转到指定步骤</option>
              <option value="stop" ${this.config.onSuccess?.nextAction === 'stop' ? 'selected' : ''}>终止流程</option>
            </select>
            <input type="text" class="mory-input" id="inp-fc-succ-jump" value="${this.config.onSuccess?.jumpStepId || ''}" placeholder="步骤ID/名称" style="display: ${this.config.onSuccess?.nextAction === 'jump' ? 'inline-block' : 'none'}; width: 100px; margin-left: 8px;">
          </div>
        </div>
      </div>

      <!-- 若查找失败 -->
      <div class="mory-form-row" style="align-items: flex-start; margin-top: 14px;">
        <label class="mory-label-inline" style="padding-top: 4px; width: 80px;">若查找失败</label>
        <div class="mory-flex-col" style="gap: 10px; flex: 1;">
          <div class="mory-flex-align">
            <label class="mory-checkbox-label">
              <input type="checkbox" id="chk-fc-fail-wait" ${this.config.onFailure?.enabled ? 'checked' : ''}>
              <span>等待时长</span>
            </label>
            <input type="number" class="mory-input mory-input-number" id="inp-fc-fail-wait" value="${this.config.onFailure?.waitTime || 200}" min="0" step="50" style="margin: 0 8px;">
            <select class="mory-select" id="sel-fc-fail-unit" style="width: 80px;">
              <option value="ms" selected>毫秒</option>
              <option value="s">秒</option>
            </select>
          </div>

          <div class="mory-flex-align">
            <span class="mory-sub-label" style="width: 50px;">然后</span>
            <select class="mory-select" id="sel-fc-fail-next" style="width: 160px;">
              <option value="continue" ${this.config.onFailure?.nextAction === 'continue' ? 'selected' : ''}>继续下一个动作</option>
              <option value="jump" ${this.config.onFailure?.nextAction === 'jump' ? 'selected' : ''}>跳转到指定步骤</option>
              <option value="retry" ${this.config.onFailure?.nextAction === 'retry' ? 'selected' : ''}>重新尝试</option>
              <option value="stop" ${this.config.onFailure?.nextAction === 'stop' ? 'selected' : ''}>终止流程</option>
            </select>
            <input type="text" class="mory-input" id="inp-fc-fail-jump" value="${this.config.onFailure?.jumpStepId || ''}" placeholder="步骤ID/名称" style="display: ${this.config.onFailure?.nextAction === 'jump' ? 'inline-block' : 'none'}; width: 100px; margin-left: 8px;">
          </div>
        </div>
      </div>
    `;

    const el = this.createContainer(html);
    this.bindEvents(el);
    return el;
  }

  bindEvents(el) {
    const colorPickerNative = el.querySelector('#inp-color-picker-native');
    const colorHex = el.querySelector('#inp-color-hex');
    const pickColorBtn = el.querySelector('#btn-pick-color');
    const pickRegionBtn = el.querySelector('#btn-fc-pick-region');
    const testFindColorBtn = el.querySelector('#btn-test-find-color');
    const selSuccNext = el.querySelector('#sel-fc-succ-next');
    const inpSuccJump = el.querySelector('#inp-fc-succ-jump');
    const selFailNext = el.querySelector('#sel-fc-fail-next');
    const inpFailJump = el.querySelector('#inp-fc-fail-jump');

    colorPickerNative.addEventListener('input', (e) => {
      colorHex.value = e.target.value.toUpperCase();
    });

    colorHex.addEventListener('input', (e) => {
      if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
        colorPickerNative.value = e.target.value;
      }
    });

    // Jump step input toggles
    selSuccNext.addEventListener('change', (e) => {
      inpSuccJump.style.display = e.target.value === 'jump' ? 'inline-block' : 'none';
    });
    selFailNext.addEventListener('change', (e) => {
      inpFailJump.style.display = e.target.value === 'jump' ? 'inline-block' : 'none';
    });

    // Pick color from webpage with magnifier
    pickColorBtn.addEventListener('click', () => {
      pickColorBtn.disabled = true;
      pickColorBtn.textContent = '请在网页点击取色...';
      if (this.context && this.context.startPickColor) {
        this.context.startPickColor((res) => {
          pickColorBtn.disabled = false;
          pickColorBtn.innerHTML = '<span>✎</span> 选取颜色';
          if (res && res.color) {
            colorHex.value = res.color.toUpperCase();
            colorPickerNative.value = res.color;
          }
        });
      } else {
        setTimeout(() => {
          pickColorBtn.disabled = false;
          pickColorBtn.innerHTML = '<span>✎</span> 选取颜色';
          const testCol = prompt('输入拾取的颜色HEX代码:', '#FF5722');
          if (testCol) {
            colorHex.value = testCol.toUpperCase();
            colorPickerNative.value = testCol;
          }
        }, 300);
      }
    });

    // Pick region
    pickRegionBtn.addEventListener('click', () => {
      pickRegionBtn.disabled = true;
      pickRegionBtn.textContent = '请在网页拉框...';
      if (this.context && this.context.startPickRegion) {
        this.context.startPickRegion((res) => {
          pickRegionBtn.disabled = false;
          pickRegionBtn.textContent = '选取区域';
          if (res && !res.canceled) {
            el.querySelector('#inp-fc-x1').value = res.x1;
            el.querySelector('#inp-fc-y1').value = res.y1;
            el.querySelector('#inp-fc-x2').value = res.x2;
            el.querySelector('#inp-fc-y2').value = res.y2;
          }
        });
      }
    });

    // Test find color
    testFindColorBtn.addEventListener('click', () => this.runTestFindColor());
  }

  async runTestFindColor() {
    const hex = this.modalEl.querySelector('#inp-color-hex').value.trim();
    const resultBox = this.modalEl.querySelector('#test-fc-result');
    const testBtn = this.modalEl.querySelector('#btn-test-find-color');

    testBtn.disabled = true;
    testBtn.textContent = '正在全图比对颜色中...';
    resultBox.style.display = 'block';
    resultBox.className = 'mory-test-result-box loading';
    resultBox.innerHTML = `正在检索颜色: <span style="display: inline-block; width: 12px; height: 12px; background: ${hex}; border-radius: 2px; vertical-align: middle;"></span> ${hex}...`;

    const x1 = Number(this.modalEl.querySelector('#inp-fc-x1').value) || 0;
    const y1 = Number(this.modalEl.querySelector('#inp-fc-y1').value) || 0;
    const x2 = Number(this.modalEl.querySelector('#inp-fc-x2').value) || 1920;
    const y2 = Number(this.modalEl.querySelector('#inp-fc-y2').value) || 1080;
    const tolerance = Number(this.modalEl.querySelector('#inp-fc-tolerance').value) || 10;

    try {
      let res = null;
      if (this.context && this.context.findColor) {
        res = await this.context.findColor({
          color: hex,
          region: { x1, y1, x2, y2 },
          tolerance
        });
      }

      if (res && res.found) {
        resultBox.className = 'mory-test-result-box success';
        resultBox.innerHTML = `
          <div style="font-weight: 600; color: #059669; font-size: 14px;">✔ 成功找到目标颜色！</div>
          <div style="margin-top: 4px; font-size: 13px; color: #334155; line-height: 1.6;">
            命中坐标: <strong>(${res.x}, ${res.y})</strong> | 实测颜色: <strong>${res.actualColor}</strong><br/>
            颜色色差: <strong>${res.diff}</strong> (容差 ≤ ${tolerance}) | 耗时: ${res.costMs || 10}ms<br/>
            <span style="font-size: 12px; color: #64748b;">(已在目标网页标记高亮指示准星)</span>
          </div>
        `;
      } else {
        resultBox.className = 'mory-test-result-box warning';
        resultBox.innerHTML = `
          <div style="font-weight: 600; color: #d97706; font-size: 14px;">⚠ 未在指定区域内找到符合该容差的颜色</div>
          <div style="margin-top: 4px; font-size: 13px; color: #475569;">
            建议：<br/>
            1. 点击【选取颜色】使用内置放大镜重新精准吸取该像素；<br/>
            2. 适当增大“颜色误差允许范围”（如调至 15~30）。
          </div>
        `;
      }
    } catch (err) {
      resultBox.className = 'mory-test-result-box error';
      resultBox.innerHTML = `❌ 测试发生错误: ${err.message}`;
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '测试找色';
    }
  }

  collectFormData() {
    const color = this.modalEl.querySelector('#inp-color-hex').value;
    const x1 = Number(this.modalEl.querySelector('#inp-fc-x1').value) || 0;
    const y1 = Number(this.modalEl.querySelector('#inp-fc-y1').value) || 0;
    const x2 = Number(this.modalEl.querySelector('#inp-fc-x2').value) || 1920;
    const y2 = Number(this.modalEl.querySelector('#inp-fc-y2').value) || 1080;
    const tolerance = Number(this.modalEl.querySelector('#inp-fc-tolerance').value) || 10;

    const repeatMode = this.modalEl.querySelector('input[name="fc-repeat-mode"]:checked')?.value || 'times';
    const repeatTimes = Math.max(1, Number(this.modalEl.querySelector('#inp-fc-times').value) || 1);
    const intervalMs = Math.max(20, Number(this.modalEl.querySelector('#inp-fc-interval').value) || 200);

    const succEnabled = this.modalEl.querySelector('#chk-fc-succ-mouse').checked;
    const succAction = this.modalEl.querySelector('#sel-fc-succ-action').value;
    const succPos = this.modalEl.querySelector('#sel-fc-succ-pos').value;
    const succNext = this.modalEl.querySelector('#sel-fc-succ-next').value;
    const succJump = this.modalEl.querySelector('#inp-fc-succ-jump').value;

    const failWaitEnabled = this.modalEl.querySelector('#chk-fc-fail-wait').checked;
    const failRawWait = Number(this.modalEl.querySelector('#inp-fc-fail-wait').value) || 200;
    const failUnit = this.modalEl.querySelector('#sel-fc-fail-unit').value;
    const failWaitMs = failUnit === 's' ? failRawWait * 1000 : failRawWait;
    const failNext = this.modalEl.querySelector('#sel-fc-fail-next').value;
    const failJump = this.modalEl.querySelector('#inp-fc-fail-jump').value;

    return {
      color,
      region: { x1, y1, x2, y2 },
      tolerance,
      repeatMode,
      repeatTimes,
      intervalMs,
      onSuccess: {
        enabled: succEnabled,
        mouseAction: succAction,
        targetPosition: succPos,
        nextAction: succNext,
        jumpStepId: succJump
      },
      onFailure: {
        enabled: failWaitEnabled,
        waitTime: failWaitMs,
        waitUnit: failUnit,
        nextAction: failNext,
        jumpStepId: failJump
      }
    };
  }
}
