// modal-find-image.js - Modal dialog for "找图" (Matching Image 4 & Image 5)

import { ModalBase } from './modal-base.js';
import { ImageMatcher } from '../image_matcher.js';

export class ModalFindImage extends ModalBase {
  constructor(config = {}, onSave, onCancel, context = {}) {
    super({
      title: '找图',
      width: 520,
      onSave,
      onCancel
    });
    this.config = Object.assign({
      templateImage: '', // base64 dataUrl
      region: {
        x1: 0,
        y1: 0,
        x2: 1920,
        y2: 1080
      },
      minSimilarity: 60,
      // 次数与间隔
      repeatMode: 'times', // 'times' | 'loop'
      repeatTimes: 1,
      intervalMs: 200,
      // 后续动作
      onSuccess: {
        enabled: true,
        mouseAction: 'move', // 'move' | 'click' | 'dblclick'
        targetPosition: 'center', // 'center' | 'top_left'
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
    const hasImage = !!this.config.templateImage;
    const html = `
      <div class="mory-info-tip">
        <span class="mory-info-icon">ⓘ</span>
        <span>在指定区域找到符合相似度的图片</span>
      </div>

      <!-- 待查找的图 -->
      <div class="mory-form-row" style="align-items: flex-start; margin-top: 14px;">
        <label class="mory-label-inline" style="padding-top: 10px;">待查找的图</label>
        <div class="mory-flex-align" style="gap: 16px;">
          <!-- 缩略图/截图卡片 -->
          <div class="mory-tpl-box ${hasImage ? 'has-image' : ''}" id="tpl-preview-box">
            ${hasImage
              ? `<img src="${this.config.templateImage}" class="mory-tpl-img" id="img-preview" alt="模板图" />
                 <span class="mory-tpl-dim-tag" id="img-dim-tag"></span>`
              : `<div class="mory-tpl-empty" id="tpl-empty-prompt">
                   <span class="mory-plus-icon">+</span>
                   <span class="mory-tpl-tip">点击开始屏幕截图</span>
                 </div>`
            }
          </div>

          <!-- 操作按钮 -->
          <div class="mory-flex-col" style="gap: 8px;">
            <button type="button" class="mory-btn-light" id="btn-snip-screen">
              <span class="mory-icon-symbol">⛶</span> 屏幕截图
            </button>
            <button type="button" class="mory-btn-light" id="btn-import-img">
              <span class="mory-icon-symbol">🖼</span> 导入图片
            </button>
            <input type="file" id="inp-hidden-file" accept="image/png,image/jpeg,image/webp" style="display: none;">
            ${hasImage ? `<button type="button" class="mory-btn-text-danger" id="btn-clear-img">清除图片</button>` : ''}
          </div>
        </div>
      </div>

      <!-- 指定区域 -->
      <div class="mory-form-row" style="align-items: flex-start; margin-top: 16px;">
        <label class="mory-label-inline" style="padding-top: 6px;">指定区域</label>
        <div class="mory-flex-col" style="gap: 10px; flex: 1;">
          <div class="mory-flex-align">
            <span class="mory-coord-axis">X1</span>
            <input type="number" class="mory-input mory-input-number" id="inp-x1" value="${this.config.region.x1}" min="0">
            <span class="mory-coord-axis" style="margin-left: 12px;">Y1</span>
            <input type="number" class="mory-input mory-input-number" id="inp-y1" value="${this.config.region.y1}" min="0">
            <button type="button" class="mory-btn-outline" id="btn-pick-region" style="margin-left: 14px;">选取区域</button>
            <span class="mory-help-bubble" title="指定找图在屏幕视口中的矩形搜索范围">?</span>
          </div>

          <div class="mory-flex-align">
            <span class="mory-coord-axis">X2</span>
            <input type="number" class="mory-input mory-input-number" id="inp-x2" value="${this.config.region.x2}" min="0">
            <span class="mory-coord-axis" style="margin-left: 12px;">Y2</span>
            <input type="number" class="mory-input mory-input-number" id="inp-y2" value="${this.config.region.y2}" min="0">
          </div>
        </div>
      </div>

      <!-- 图片相似度 -->
      <div class="mory-form-row mory-flex-align" style="margin-top: 16px;">
        <label class="mory-label-inline">图片相似度大于</label>
        <input type="number" class="mory-input mory-input-number" id="inp-similarity" value="${this.config.minSimilarity}" min="1" max="100" step="5">
        <span class="mory-unit-text" style="margin-left: 6px;">%</span>
        <span class="mory-help-bubble" style="margin-left: 8px;" title="匹配度阈值，一般设为 60%~85% 为宜">?</span>
      </div>

      <!-- 测试找图大按钮 -->
      <div style="margin-top: 18px; margin-bottom: 18px;">
        <button type="button" class="mory-btn-hero-green" id="btn-test-match">测试找图</button>
        <div id="test-match-result" class="mory-test-result-box" style="display: none;"></div>
      </div>

      <!-- 分隔线：次数与间隔 -->
      <div class="mory-divider-section">
        <div class="mory-divider-title">次数与间隔</div>
      </div>

      <div class="mory-form-row" style="align-items: flex-start; margin-top: 14px;">
        <label class="mory-label-inline" style="padding-top: 2px;">找图次数</label>
        <div class="mory-flex-col" style="gap: 10px;">
          <div class="mory-flex-align">
            <label class="mory-radio-label">
              <input type="radio" name="repeat-mode" value="times" ${this.config.repeatMode === 'times' ? 'checked' : ''}>
              <span>共找图</span>
            </label>
            <input type="number" class="mory-input mory-input-number-sm" id="inp-repeat-times" value="${this.config.repeatTimes}" min="1" style="margin: 0 6px;">
            <span class="mory-unit-text">次</span>
            <span class="mory-help-bubble" style="margin-left: 6px;" title="尝试匹配的总次数">?</span>
          </div>

          <label class="mory-radio-label">
            <input type="radio" name="repeat-mode" value="loop" ${this.config.repeatMode === 'loop' ? 'checked' : ''}>
            <span>循环识别，直到找到为止</span>
          </label>
        </div>
      </div>

      <div class="mory-form-row mory-flex-align" style="margin-top: 14px;">
        <label class="mory-label-inline">时间间隔</label>
        <span style="font-size: 13px; color: #475569; margin-right: 6px;">每隔</span>
        <input type="number" class="mory-input mory-input-number" id="inp-interval" value="${this.config.intervalMs}" min="50" step="50">
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
              <input type="checkbox" id="chk-succ-mouse" ${this.config.onSuccess?.enabled ? 'checked' : ''}>
              <span>鼠标动作</span>
            </label>
            <select class="mory-select" id="sel-succ-action" style="width: 90px;">
              <option value="move" ${this.config.onSuccess?.mouseAction === 'move' ? 'selected' : ''}>移动到</option>
              <option value="click" ${this.config.onSuccess?.mouseAction === 'click' ? 'selected' : ''}>点击</option>
              <option value="dblclick" ${this.config.onSuccess?.mouseAction === 'dblclick' ? 'selected' : ''}>双击</option>
            </select>
            <select class="mory-select" id="sel-succ-pos" style="width: 140px;">
              <option value="center" ${this.config.onSuccess?.targetPosition === 'center' ? 'selected' : ''}>查找图片的中心</option>
              <option value="top_left" ${this.config.onSuccess?.targetPosition === 'top_left' ? 'selected' : ''}>查找图片左上角</option>
            </select>
          </div>

          <div class="mory-flex-align">
            <span class="mory-sub-label" style="width: 50px;">然后</span>
            <select class="mory-select" id="sel-succ-next" style="width: 150px;">
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
              <input type="checkbox" id="chk-fail-wait" ${this.config.onFailure?.enabled ? 'checked' : ''}>
              <span>等待时长</span>
            </label>
            <input type="number" class="mory-input mory-input-number" id="inp-fail-wait" value="${this.config.onFailure?.waitTime || 200}" min="0" step="50" style="margin: 0 8px;">
            <select class="mory-select" id="sel-fail-unit" style="width: 80px;">
              <option value="ms" selected>毫秒</option>
              <option value="s">秒</option>
            </select>
          </div>

          <div class="mory-flex-align">
            <span class="mory-sub-label" style="width: 50px;">然后</span>
            <select class="mory-select" id="sel-fail-next" style="width: 150px;">
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
    const tplBox = el.querySelector('#tpl-preview-box');
    const snipBtn = el.querySelector('#btn-snip-screen');
    const importBtn = el.querySelector('#btn-import-img');
    const fileInput = el.querySelector('#inp-hidden-file');
    const pickRegionBtn = el.querySelector('#btn-pick-region');
    const testMatchBtn = el.querySelector('#btn-test-match');

    // Snip screen on box or button click
    const doSnip = () => this.triggerScreenSnip();
    tplBox.addEventListener('click', () => {
      if (!this.config.templateImage) doSnip();
    });
    snipBtn.addEventListener('click', doSnip);

    // Import file
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        this.updateTemplateImage(event.target.result);
      };
      reader.readAsDataURL(file);
    });

    // Clear Image if present
    const clearBtn = el.querySelector('#btn-clear-img');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.updateTemplateImage('');
      });
    }

    // Pick Region
    pickRegionBtn.addEventListener('click', () => this.triggerPickRegion());

    // Test Match
    testMatchBtn.addEventListener('click', () => this.runTestMatch());

    // Load initial image dimensions if present
    if (this.config.templateImage) {
      const tmp = new Image();
      tmp.onload = () => {
        const tag = el.querySelector('#img-dim-tag');
        if (tag) tag.textContent = `${tmp.naturalWidth}×${tmp.naturalHeight}`;
      };
      tmp.src = this.config.templateImage;
    }
  }

  updateTemplateImage(dataUrl) {
    this.config.templateImage = dataUrl || '';
    const box = this.modalEl ? this.modalEl.querySelector('#tpl-preview-box') : null;
    if (box) {
      if (dataUrl) {
        box.classList.add('has-image');
        box.innerHTML = `
          <img src="${dataUrl}" class="mory-tpl-img" id="img-preview" alt="模板图" />
          <span class="mory-tpl-dim-tag" id="img-dim-tag"></span>
        `;
        const tmp = new Image();
        tmp.onload = () => {
          const tag = box.querySelector('#img-dim-tag');
          if (tag) tag.textContent = `${tmp.naturalWidth}×${tmp.naturalHeight}`;
        };
        tmp.src = dataUrl;

        let clearBtn = this.modalEl.querySelector('#btn-clear-img');
        if (!clearBtn) {
          const btnCol = this.modalEl.querySelector('#btn-import-img')?.parentElement;
          if (btnCol) {
            clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'mory-btn-text-danger';
            clearBtn.id = 'btn-clear-img';
            clearBtn.textContent = '清除图片';
            clearBtn.addEventListener('click', () => this.updateTemplateImage(''));
            btnCol.appendChild(clearBtn);
          }
        }
      } else {
        box.classList.remove('has-image');
        box.innerHTML = `
          <div class="mory-tpl-empty" id="tpl-empty-prompt">
            <span class="mory-plus-icon">+</span>
            <span class="mory-tpl-tip">点击开始屏幕截图</span>
          </div>
        `;
        const clearBtn = this.modalEl.querySelector('#btn-clear-img');
        if (clearBtn) clearBtn.remove();
      }
    }
  }

  triggerScreenSnip() {
    if (this.context && this.context.startScreenSnip) {
      this.context.startScreenSnip((res) => {
        if (res && res.croppedDataUrl) {
          this.updateTemplateImage(res.croppedDataUrl);
        }
      });
    } else {
      // Fallback: generate a dummy sample template
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = 80;
      dummyCanvas.height = 36;
      const ctx = dummyCanvas.getContext('2d');
      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, 0, 80, 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('示例按钮', 14, 23);
      this.updateTemplateImage(dummyCanvas.toDataURL());
    }
  }

  triggerPickRegion() {
    const btn = this.modalEl.querySelector('#btn-pick-region');
    btn.disabled = true;
    btn.textContent = '请在网页拉框...';

    if (this.context && this.context.startPickRegion) {
      this.context.startPickRegion((res) => {
        btn.disabled = false;
        btn.textContent = '选取区域';
        if (res && !res.canceled) {
          this.modalEl.querySelector('#inp-x1').value = res.x1;
          this.modalEl.querySelector('#inp-y1').value = res.y1;
          this.modalEl.querySelector('#inp-x2').value = res.x2;
          this.modalEl.querySelector('#inp-y2').value = res.y2;
        }
      });
    } else {
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '选取区域';
        this.modalEl.querySelector('#inp-x1').value = 50;
        this.modalEl.querySelector('#inp-y1').value = 50;
        this.modalEl.querySelector('#inp-x2').value = 1200;
        this.modalEl.querySelector('#inp-y2').value = 800;
      }, 300);
    }
  }

  async runTestMatch() {
    const testResultBox = this.modalEl.querySelector('#test-match-result');
    const testBtn = this.modalEl.querySelector('#btn-test-match');

    if (!this.config.templateImage) {
      alert('请先添加“待查找的图”（通过屏幕截图或导入图片）');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = '正在截屏识别中...';
    testResultBox.style.display = 'block';
    testResultBox.className = 'mory-test-result-box loading';
    testResultBox.innerHTML = '正在截取目标屏幕并进行模板匹配...';

    try {
      let screenshotUrl = null;
      if (this.context && this.context.captureTab) {
        screenshotUrl = await this.context.captureTab();
      }

      if (!screenshotUrl) {
        // Fallback test with sample image if standalone preview
        screenshotUrl = this.config.templateImage;
      }

      const metrics = this.context && this.context.getViewportMetrics ? await this.context.getViewportMetrics() : null;
      const dpr = metrics?.dpr || 1;

      const x1 = Number(this.modalEl.querySelector('#inp-x1').value) || 0;
      const y1 = Number(this.modalEl.querySelector('#inp-y1').value) || 0;
      const x2 = Number(this.modalEl.querySelector('#inp-x2').value) || 1920;
      const y2 = Number(this.modalEl.querySelector('#inp-y2').value) || 1080;
      const minSimilarity = Number(this.modalEl.querySelector('#inp-similarity').value) || 60;

      const result = await ImageMatcher.match(screenshotUrl, this.config.templateImage, {
        region: { x1, y1, x2, y2 },
        minSimilarity,
        dpr,
        metrics
      });

      if (result.found) {
        testResultBox.className = 'mory-test-result-box success';
        testResultBox.innerHTML = `
          <div style="font-weight: 600; color: #059669; font-size: 14px;">✔ 测试找图成功！</div>
          <div style="margin-top: 4px; font-size: 13px; color: #334155;">
            匹配相似度: <strong>${result.similarityPct}%</strong> (阈值 ≥ ${minSimilarity}%)<br/>
            中心坐标: <strong>(${result.centerX}, ${result.centerY})</strong> | 范围: [${result.x}, ${result.y}, ${result.width}x${result.height}]<br/>
            耗时: ${result.costMs} 毫秒
          </div>
        `;
        // Highlighting on target tab if connected
        if (this.context && this.context.highlightTarget) {
          this.context.highlightTarget(result, `找图命中: ${result.similarityPct}%`);
        }
      } else {
        testResultBox.className = 'mory-test-result-box warning';
        testResultBox.innerHTML = `
          <div style="font-weight: 600; color: #d97706; font-size: 14px;">⚠ 未找到匹配目标</div>
          <div style="margin-top: 4px; font-size: 13px; color: #475569;">
            最高相似度仅为: <strong>${result.similarityPct}%</strong> (低于设定的阈值 ${minSimilarity}%)<br/>
            耗时: ${result.costMs} 毫秒。建议调低相似度阈值或重新框选更清晰的特征图。
          </div>
        `;
      }
    } catch (err) {
      testResultBox.className = 'mory-test-result-box error';
      testResultBox.innerHTML = `❌ 测试发生错误: ${err.message}`;
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '测试找图';
    }
  }

  collectFormData() {
    const x1 = Number(this.modalEl.querySelector('#inp-x1').value) || 0;
    const y1 = Number(this.modalEl.querySelector('#inp-y1').value) || 0;
    const x2 = Number(this.modalEl.querySelector('#inp-x2').value) || 1920;
    const y2 = Number(this.modalEl.querySelector('#inp-y2').value) || 1080;
    const minSimilarity = Number(this.modalEl.querySelector('#inp-similarity').value) || 60;

    const repeatMode = this.modalEl.querySelector('input[name="repeat-mode"]:checked')?.value || 'times';
    const repeatTimes = Math.max(1, Number(this.modalEl.querySelector('#inp-repeat-times').value) || 1);
    const intervalMs = Math.max(20, Number(this.modalEl.querySelector('#inp-interval').value) || 200);

    const succEnabled = this.modalEl.querySelector('#chk-succ-mouse').checked;
    const succAction = this.modalEl.querySelector('#sel-succ-action').value;
    const succPos = this.modalEl.querySelector('#sel-succ-pos').value;
    const succNext = this.modalEl.querySelector('#sel-succ-next').value;

    const failWaitEnabled = this.modalEl.querySelector('#chk-fail-wait').checked;
    const failRawWait = Number(this.modalEl.querySelector('#inp-fail-wait').value) || 200;
    const failUnit = this.modalEl.querySelector('#sel-fail-unit').value;
    const failWaitMs = failUnit === 's' ? failRawWait * 1000 : failRawWait;
    const failNext = this.modalEl.querySelector('#sel-fail-next').value;

    return {
      templateImage: this.config.templateImage,
      region: { x1, y1, x2, y2 },
      minSimilarity,
      repeatMode,
      repeatTimes,
      intervalMs,
      onSuccess: {
        enabled: succEnabled,
        mouseAction: succAction,
        targetPosition: succPos,
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
