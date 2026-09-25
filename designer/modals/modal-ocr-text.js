// modal-ocr-text.js - Modal dialog for "文字识别" (Matching Image 1 & Image 2)

import { ModalBase } from './modal-base.js';

export class ModalOcrText extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '文字识别',
      width: 520,
      onSave,
      onCancel
    });
    this.config = Object.assign({
      targetText: '',
      region: {
        x1: 0,
        y1: 0,
        x2: 1920,
        y2: 1080
      },
      minSimilarity: 90,
      // 次数与间隔
      repeatMode: 'times', // 'times' | 'loop'
      repeatTimes: 1,
      intervalMs: 200,
      // 后续动作
      onSuccess: {
        enabled: true,
        mouseAction: 'move', // 'move' | 'click' | 'dblclick'
        targetPosition: 'center', // 'center' | 'top_left'
        copyToClipboard: false,
        nextAction: 'continue' // 'continue' | 'stop'
      },
      onFailure: {
        enabled: true,
        waitTime: 200,
        waitUnit: 'ms',
        nextAction: 'continue' // 'continue' | 'stop' | 'retry'
      }
    }, config);
    this.context = context;
  }

  show() {
    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>识别指定区域内特定文字，建议选择色差明显的区域</span>
      </div>

      <!-- 需要识别的文字 -->
      <div class="mory-form-row" style="align-items: flex-start; margin-top: 14px;">
        <label class="mory-label-inline" style="padding-top: 8px;">需要识别的文字</label>
        <div style="flex: 1;">
          <textarea class="mory-input" id="inp-target-text" rows="3" placeholder="请在此处输入文本" style="width: 100%; resize: vertical; min-height: 70px; font-family: inherit;">${this.config.targetText || ''}</textarea>
        </div>
      </div>

      <!-- 指定区域 -->
      <div class="mory-form-row" style="align-items: flex-start; margin-top: 16px;">
        <label class="mory-label-inline" style="padding-top: 6px;">指定区域</label>
        <div class="mory-flex-col" style="gap: 10px; flex: 1;">
          <div class="mory-flex-align">
            <span class="mory-coord-axis">X1</span>
            <input type="number" class="mory-input mory-input-number" id="inp-ocr-x1" value="${this.config.region.x1}" min="0">
            <span class="mory-coord-axis" style="margin-left: 12px;">Y1</span>
            <input type="number" class="mory-input mory-input-number" id="inp-ocr-y1" value="${this.config.region.y1}" min="0">
            <button type="button" class="mory-btn-outline" id="btn-ocr-pick-region" style="margin-left: 14px;">选取区域</button>
            <span class="mory-help-bubble" title="指定在屏幕或网页视口内的矩形搜索区域">?</span>
          </div>

          <div class="mory-flex-align">
            <span class="mory-coord-axis">X2</span>
            <input type="number" class="mory-input mory-input-number" id="inp-ocr-x2" value="${this.config.region.x2}" min="0">
            <span class="mory-coord-axis" style="margin-left: 12px;">Y2</span>
            <input type="number" class="mory-input mory-input-number" id="inp-ocr-y2" value="${this.config.region.y2}" min="0">
          </div>
        </div>
      </div>

      <!-- 文字匹配度 -->
      <div class="mory-form-row mory-flex-align" style="margin-top: 16px;">
        <label class="mory-label-inline">文字匹配度大于</label>
        <input type="number" class="mory-input mory-input-number" id="inp-ocr-similarity" value="${this.config.minSimilarity}" min="1" max="100" step="5">
        <span class="mory-unit-text" style="margin-left: 6px;">%</span>
        <span class="mory-help-bubble" style="margin-left: 8px;" title="文字匹配相似度阈值，一般设为 80%~90%">?</span>
      </div>

      <!-- 测试查找文字长条大按钮 -->
      <div style="margin-top: 18px; margin-bottom: 18px;">
        <button type="button" class="mory-btn-hero-green" id="btn-test-find-text">测试查找文字</button>
        <div id="test-ocr-result" class="mory-test-result-box" style="display: none;"></div>
      </div>

      <!-- 分隔线：次数与间隔 -->
      <div class="mory-divider-section">
        <div class="mory-divider-title">次数与间隔</div>
      </div>

      <div class="mory-form-row" style="align-items: flex-start; margin-top: 14px;">
        <label class="mory-label-inline" style="padding-top: 2px;">识别次数</label>
        <div class="mory-flex-col" style="gap: 10px;">
          <div class="mory-flex-align">
            <label class="mory-radio-label">
              <input type="radio" name="ocr-repeat-mode" value="times" ${this.config.repeatMode === 'times' ? 'checked' : ''}>
              <span>识别</span>
            </label>
            <input type="number" class="mory-input mory-input-number-sm" id="inp-ocr-times" value="${this.config.repeatTimes}" min="1" style="margin: 0 6px;">
            <span class="mory-unit-text">次</span>
            <span class="mory-help-bubble" style="margin-left: 6px;" title="尝试识别的总次数">?</span>
          </div>

          <label class="mory-radio-label">
            <input type="radio" name="ocr-repeat-mode" value="loop" ${this.config.repeatMode === 'loop' ? 'checked' : ''}>
            <span>循环识别，直到找到为止</span>
          </label>
        </div>
      </div>

      <div class="mory-form-row mory-flex-align" style="margin-top: 14px;">
        <label class="mory-label-inline">时间间隔</label>
        <span style="font-size: 13px; color: #475569; margin-right: 6px;">每隔</span>
        <input type="number" class="mory-input mory-input-number" id="inp-ocr-interval" value="${this.config.intervalMs}" min="50" step="50">
        <span class="mory-suffix-text" style="margin-left: 6px;">毫秒 进行一次识别</span>
      </div>

      <!-- 分隔线：后续动作 -->
      <div class="mory-divider-section" style="margin-top: 20px;">
        <div class="mory-divider-title">后续动作</div>
      </div>

      <!-- 若识别成功 -->
      <div class="mory-form-row" style="align-items: flex-start; margin-top: 14px;">
        <label class="mory-label-inline" style="padding-top: 4px; width: 80px;">若识别成功</label>
        <div class="mory-flex-col" style="gap: 10px; flex: 1;">
          <div class="mory-flex-align" style="flex-wrap: wrap; gap: 8px;">
            <label class="mory-checkbox-label">
              <input type="checkbox" id="chk-ocr-succ-mouse" ${this.config.onSuccess?.enabled ? 'checked' : ''}>
              <span>鼠标动作</span>
            </label>
            <select class="mory-select" id="sel-ocr-succ-action" style="width: 90px;">
              <option value="move" ${this.config.onSuccess?.mouseAction === 'move' ? 'selected' : ''}>移动到</option>
              <option value="click" ${this.config.onSuccess?.mouseAction === 'click' ? 'selected' : ''}>点击</option>
              <option value="dblclick" ${this.config.onSuccess?.mouseAction === 'dblclick' ? 'selected' : ''}>双击</option>
            </select>
            <select class="mory-select" id="sel-ocr-succ-pos" style="width: 140px;">
              <option value="center" ${this.config.onSuccess?.targetPosition === 'center' ? 'selected' : ''}>查找文字的中心</option>
              <option value="top_left" ${this.config.onSuccess?.targetPosition === 'top_left' ? 'selected' : ''}>查找文字左上角</option>
            </select>
          </div>

          <label class="mory-checkbox-label">
            <input type="checkbox" id="chk-ocr-clipboard" ${this.config.onSuccess?.copyToClipboard ? 'checked' : ''}>
            <span>将文字保存到剪贴板</span>
          </label>

          <div class="mory-flex-align">
            <span class="mory-sub-label" style="width: 50px;">然后</span>
            <select class="mory-select" id="sel-ocr-succ-next" style="width: 150px;">
              <option value="continue" ${this.config.onSuccess?.nextAction === 'continue' ? 'selected' : ''}>继续下一个动作</option>
              <option value="stop" ${this.config.onSuccess?.nextAction === 'stop' ? 'selected' : ''}>终止流程</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 若查找失败 -->
      <div class="mory-form-row" style="align-items: flex-start; margin-top: 14px;">
        <label class="mory-label-inline" style="padding-top: 4px; width: 80px;">若查找失败</label>
        <div class="mory-flex-col" style="gap: 10px; flex: 1;">
          <div class="mory-flex-align">
            <label class="mory-checkbox-label">
              <input type="checkbox" id="chk-ocr-fail-wait" ${this.config.onFailure?.enabled ? 'checked' : ''}>
              <span>等待时长</span>
            </label>
            <input type="number" class="mory-input mory-input-number" id="inp-ocr-fail-wait" value="${this.config.onFailure?.waitTime || 200}" min="0" step="50" style="margin: 0 8px;">
            <select class="mory-select" id="sel-ocr-fail-unit" style="width: 80px;">
              <option value="ms" selected>毫秒</option>
              <option value="s">秒</option>
            </select>
          </div>

          <div class="mory-flex-align">
            <span class="mory-sub-label" style="width: 50px;">然后</span>
            <select class="mory-select" id="sel-ocr-fail-next" style="width: 150px;">
              <option value="continue" ${this.config.onFailure?.nextAction === 'continue' ? 'selected' : ''}>继续下一个动作</option>
              <option value="stop" ${this.config.onFailure?.nextAction === 'stop' ? 'selected' : ''}>终止流程</option>
              <option value="retry" ${this.config.onFailure?.nextAction === 'retry' ? 'selected' : ''}>重新尝试</option>
            </select>
          </div>
        </div>
      </div>
    `;

    const el = this.createContainer(html);
    this.bindEvents(el);
    return el;
  }

  bindEvents(el) {
    const pickRegionBtn = el.querySelector('#btn-ocr-pick-region');
    const testFindBtn = el.querySelector('#btn-test-find-text');

    pickRegionBtn.addEventListener('click', () => {
      pickRegionBtn.disabled = true;
      pickRegionBtn.textContent = '请在网页拉框...';
      if (this.context && this.context.startPickRegion) {
        this.context.startPickRegion((res) => {
          pickRegionBtn.disabled = false;
          pickRegionBtn.textContent = '选取区域';
          if (res && !res.canceled) {
            el.querySelector('#inp-ocr-x1').value = res.x1;
            el.querySelector('#inp-ocr-y1').value = res.y1;
            el.querySelector('#inp-ocr-x2').value = res.x2;
            el.querySelector('#inp-ocr-y2').value = res.y2;
          }
        });
      } else {
        setTimeout(() => {
          pickRegionBtn.disabled = false;
          pickRegionBtn.textContent = '选取区域';
          el.querySelector('#inp-ocr-x1').value = 0;
          el.querySelector('#inp-ocr-y1').value = 0;
          el.querySelector('#inp-ocr-x2').value = 1920;
          el.querySelector('#inp-ocr-y2').value = 1080;
        }, 300);
      }
    });

    testFindBtn.addEventListener('click', () => this.runTestFindText());
  }

  async runTestFindText() {
    const targetText = this.modalEl.querySelector('#inp-target-text').value.trim();
    const resultBox = this.modalEl.querySelector('#test-ocr-result');
    const testBtn = this.modalEl.querySelector('#btn-test-find-text');

    if (!targetText) {
      alert('请先输入“需要识别的文字”');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = '正在识别查找文字中...';
    resultBox.style.display = 'block';
    resultBox.className = 'mory-test-result-box loading';
    resultBox.innerHTML = `正在检索网页文字: "${targetText}"...`;

    const x1 = Number(this.modalEl.querySelector('#inp-ocr-x1').value) || 0;
    const y1 = Number(this.modalEl.querySelector('#inp-ocr-y1').value) || 0;
    const x2 = Number(this.modalEl.querySelector('#inp-ocr-x2').value) || 1920;
    const y2 = Number(this.modalEl.querySelector('#inp-ocr-y2').value) || 1080;
    const minSimilarity = Number(this.modalEl.querySelector('#inp-ocr-similarity').value) || 90;

    try {
      let res = null;
      if (this.context && this.context.findText) {
        res = await this.context.findText({
          text: targetText,
          region: { x1, y1, x2, y2 },
          minSimilarity
        });
      } else {
        // Fallback simulation
        await new Promise(r => setTimeout(r, 400));
        res = {
          found: true,
          similarity: 100,
          text: targetText,
          x: 320,
          y: 210,
          width: 140,
          height: 32,
          centerX: 390,
          centerY: 226
        };
      }

      if (res && res.error) {
        resultBox.className = 'mory-test-result-box error';
        resultBox.innerHTML = `
          <div style="font-weight: 600; color: #ef4444; font-size: 14px;">❌ 查找未成功</div>
          <div style="margin-top: 4px; font-size: 13px; color: #475569;">
            ${res.error}
          </div>
        `;
        return;
      }

      if (res && res.found) {
        resultBox.className = 'mory-test-result-box success';
        resultBox.innerHTML = `
          <div style="font-weight: 600; color: #059669; font-size: 14px;">✔ 成功找到文字目标！</div>
          <div style="margin-top: 4px; font-size: 13px; color: #334155; line-height: 1.6;">
            匹配文字: <strong style="color: #059669;">"${res.text}"</strong> | 匹配度: <strong>${res.similarity}%</strong><br/>
            中心坐标: <strong>(${res.centerX}, ${res.centerY})</strong> | 尺寸: ${res.width} × ${res.height} 像素<br/>
            <span style="font-size: 12px; color: #64748b;">(已在目标网页自动滚动定位并标记高亮绿框)</span>
          </div>
        `;
      } else {
        resultBox.className = 'mory-test-result-box warning';
        const bestSim = res?.similarity || 0;
        resultBox.innerHTML = `
          <div style="font-weight: 600; color: #d97706; font-size: 14px;">⚠ 未在指定区域找到该文字</div>
          <div style="margin-top: 4px; font-size: 13px; color: #475569;">
            在当前区域内最高相似度仅为: <strong>${bestSim}%</strong> (低于设定的阈值 ${minSimilarity}%)。<br/>
            建议：<br/>
            1. 请确认目标网页已加载并包含文字 "<strong>${targetText}</strong>"；<br/>
            2. 可尝试适当调低“文字匹配度”或点击【选取区域】扩大搜索范围。
          </div>
        `;
      }
    } catch (err) {
      resultBox.className = 'mory-test-result-box error';
      resultBox.innerHTML = `❌ 识别出错: ${err.message}`;
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '测试查找文字';
    }
  }

  collectFormData() {
    const targetText = this.modalEl.querySelector('#inp-target-text').value;
    const x1 = Number(this.modalEl.querySelector('#inp-ocr-x1').value) || 0;
    const y1 = Number(this.modalEl.querySelector('#inp-ocr-y1').value) || 0;
    const x2 = Number(this.modalEl.querySelector('#inp-ocr-x2').value) || 1920;
    const y2 = Number(this.modalEl.querySelector('#inp-ocr-y2').value) || 1080;
    const minSimilarity = Number(this.modalEl.querySelector('#inp-ocr-similarity').value) || 90;

    const repeatMode = this.modalEl.querySelector('input[name="ocr-repeat-mode"]:checked')?.value || 'times';
    const repeatTimes = Math.max(1, Number(this.modalEl.querySelector('#inp-ocr-times').value) || 1);
    const intervalMs = Math.max(20, Number(this.modalEl.querySelector('#inp-ocr-interval').value) || 200);

    const succEnabled = this.modalEl.querySelector('#chk-ocr-succ-mouse').checked;
    const succAction = this.modalEl.querySelector('#sel-ocr-succ-action').value;
    const succPos = this.modalEl.querySelector('#sel-ocr-succ-pos').value;
    const copyClipboard = this.modalEl.querySelector('#chk-ocr-clipboard').checked;
    const succNext = this.modalEl.querySelector('#sel-ocr-succ-next').value;

    const failWaitEnabled = this.modalEl.querySelector('#chk-ocr-fail-wait').checked;
    const failRawWait = Number(this.modalEl.querySelector('#inp-ocr-fail-wait').value) || 200;
    const failUnit = this.modalEl.querySelector('#sel-ocr-fail-unit').value;
    const failWaitMs = failUnit === 's' ? failRawWait * 1000 : failRawWait;
    const failNext = this.modalEl.querySelector('#sel-ocr-fail-next').value;

    return {
      targetText,
      region: { x1, y1, x2, y2 },
      minSimilarity,
      repeatMode,
      repeatTimes,
      intervalMs,
      onSuccess: {
        enabled: succEnabled,
        mouseAction: succAction,
        targetPosition: succPos,
        copyToClipboard: copyClipboard,
        nextAction: succNext
      },
      onFailure: {
        enabled: failWaitEnabled,
        waitTime: failWaitMs,
        waitUnit: failUnit,
        nextAction: failNext
      }
    };
  }
}
