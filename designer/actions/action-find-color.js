// action-find-color.js - Find Color Action Definition with Branching

import { ModalFindColor } from '../modals/modal-find-color.js';
import { ImageMatcher } from '../image_matcher.js';

export const ActionFindColor = {
  type: 'find_color',
  category: 'image',
  name: '找色',
  description: '在指定区域查找特定颜色像素值并执行动作',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
    </svg>
  `,
  color: '#ec4899',
  hasBranchOut: true,
  outputPorts: [
    { id: 'success', name: '成功', color: '#10b981' },
    { id: 'failure', name: '失败', color: '#f59e0b' }
  ],
  defaultConfig: {
    color: '#10B981',
    region: {
      x1: 0,
      y1: 0,
      x2: 1920,
      y2: 1080
    },
    tolerance: 10,
    repeatMode: 'times',
    repeatTimes: 1,
    intervalMs: 200,
    onSuccess: {
      enabled: true,
      mouseAction: 'move',
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
  },
  formatSummary(config) {
    const modeDesc = config.repeatMode === 'loop' ? '循环找色' : `找${config.repeatTimes}次`;
    return `颜色: ${config.color} | 容差: ${config.tolerance} | ${modeDesc}`;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalFindColor(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    const maxAttempts = config.repeatMode === 'loop' ? 50 : Math.max(1, config.repeatTimes || 1);
    const interval = Math.max(20, config.intervalMs || 200);

    context.logger.info(`[找色] 开始查找颜色: ${config.color}，容差: ${config.tolerance}，模式: ${config.repeatMode === 'loop' ? '循环直到找到' : '共' + maxAttempts + '次'}`);

    let matchResult = null;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      if (context.isCancelled && context.isCancelled()) {
        context.logger.warn('[找色] 流程已取消');
        return { success: false, nextPort: 'failure', error: '流程已取消' };
      }

      try {
        const screenshotUrl = await context.tabBridge.captureTab();
        if (!screenshotUrl) throw new Error('截取网页画面失败');

        const metrics = await context.tabBridge.callTabMethod('GET_VIEWPORT_METRICS');
        const dpr = metrics?.dpr || 1;

        matchResult = await this.searchColorInScreenshot(screenshotUrl, config.color, config.region, config.tolerance, dpr, metrics);

        if (matchResult && matchResult.found) {
          context.logger.success(`[找色] 第${attempt}次识别成功！命中坐标: (${matchResult.x}, ${matchResult.y})，实测颜色: ${matchResult.actualColor}`);
          break;
        } else {
          context.logger.info(`[找色] 第${attempt}次未找到符合颜色`);
        }
      } catch (err) {
        context.logger.warn(`[找色] 第${attempt}次异常: ${err.message}`);
      }

      if (attempt < maxAttempts) {
        if (context.sleep) {
          const res = await context.sleep(interval, '找色重试等待');
          if (res.cancelled) break;
        } else {
          await new Promise(r => setTimeout(r, interval));
        }
      }
    }

    // Branch: SUCCESS
    if (matchResult && matchResult.found) {
      await context.tabBridge.callTabMethod('HIGHLIGHT_MATCH', {
        rect: {
          x: matchResult.x - 12,
          y: matchResult.y - 12,
          width: 24,
          height: 24
        },
        label: `找色命中: ${matchResult.actualColor}`
      });

      const succConfig = config.onSuccess || {};
      if (succConfig.enabled) {
        if (succConfig.mouseAction === 'move') {
          context.logger.info(`[找色成功] 移动鼠标到目标 (${matchResult.x}, ${matchResult.y})`);
          await context.tabBridge.callTabMethod('EXECUTE_MOVE_MOUSE', { x: matchResult.x, y: matchResult.y });
        } else if (succConfig.mouseAction === 'click') {
          context.logger.info(`[找色成功] 移动并单击目标 (${matchResult.x}, ${matchResult.y})`);
          await context.tabBridge.callTabMethod('EXECUTE_MOVE_MOUSE', { x: matchResult.x, y: matchResult.y });
          await context.tabBridge.callTabMethod('EXECUTE_MOUSE_CLICK', { x: matchResult.x, y: matchResult.y, button: 'left', actionType: 'click' });
        } else if (succConfig.mouseAction === 'dblclick') {
          context.logger.info(`[找色成功] 移动并双击目标 (${matchResult.x}, ${matchResult.y})`);
          await context.tabBridge.callTabMethod('EXECUTE_MOVE_MOUSE', { x: matchResult.x, y: matchResult.y });
          await context.tabBridge.callTabMethod('EXECUTE_MOUSE_CLICK', { x: matchResult.x, y: matchResult.y, button: 'left', actionType: 'dblclick' });
        }
      }

      if (succConfig.nextAction === 'stop') {
        context.logger.info('[找色成功] 设定为终止流程');
        return { success: true, stopWorkflow: true };
      }

      if (succConfig.nextAction === 'jump' && succConfig.jumpStepId) {
        context.logger.info(`[找色成功] 跳转到指定步骤: ${succConfig.jumpStepId}`);
        return { success: true, jumpToNodeId: succConfig.jumpStepId };
      }

      return { success: true, nextPort: 'success', data: matchResult };
    }

    // Branch: FAILURE
    const failConfig = config.onFailure || {};
    context.logger.warn(`[找色] 未能在区域内找到颜色: ${config.color}`);

    if (failConfig.enabled && failConfig.waitTime > 0) {
      context.logger.info(`[找色失败] 等待 ${failConfig.waitTime} 毫秒...`);
      if (context.sleep) {
        await context.sleep(failConfig.waitTime, '找色失败等待');
      } else {
        await new Promise(r => setTimeout(r, failConfig.waitTime));
      }
    }

    if (failConfig.nextAction === 'stop') {
      context.logger.error('[找色失败] 设定为终止流程');
      return { success: false, stopWorkflow: true, error: '未找到目标颜色，流程终止' };
    }

    if (failConfig.nextAction === 'jump' && failConfig.jumpStepId) {
      context.logger.info(`[找色失败] 跳转到指定步骤: ${failConfig.jumpStepId}`);
      return { success: false, jumpToNodeId: failConfig.jumpStepId };
    }

    return { success: false, nextPort: 'failure', data: matchResult };
  },

  // Color Search Engine
  async searchColorInScreenshot(screenshotUrl, hexColor, region = {}, tolerance = 10, dpr = 1, metrics = null) {
    const tStart = performance.now();
    const img = await ImageMatcher.loadImage(screenshotUrl);

    let safeDpr = (metrics?.innerWidth && img.width)
      ? (img.width / metrics.innerWidth)
      : (Number(dpr) > 0 ? Number(dpr) : (metrics?.dpr || 1));

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const rx1 = Math.max(0, Math.min(img.width - 1, Math.round((Number(region.x1) || 0) * safeDpr)));
    const ry1 = Math.max(0, Math.min(img.height - 1, Math.round((Number(region.y1) || 0) * safeDpr)));
    const rx2 = Math.max(rx1 + 1, Math.min(img.width, Math.round((Number(region.x2) || (img.width / safeDpr)) * safeDpr)));
    const ry2 = Math.max(ry1 + 1, Math.min(img.height, Math.round((Number(region.y2) || (img.height / safeDpr)) * safeDpr)));

    const roiW = rx2 - rx1;
    const roiH = ry2 - ry1;

    const imgData = ctx.getImageData(rx1, ry1, roiW, roiH).data;

    // Parse target hex
    let hex = hexColor.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const tr = parseInt(hex.substring(0, 2), 16) || 0;
    const tg = parseInt(hex.substring(2, 4), 16) || 0;
    const tb = parseInt(hex.substring(4, 6), 16) || 0;
    const tol = Math.max(0, Number(tolerance) || 10);

    let bestX = -1;
    let bestY = -1;
    let minDiff = 999999;
    let bestHex = hexColor;

    // Scan ROI for the best matching pixel with minimum color diff
    for (let y = 0; y < roiH; y++) {
      const rowOffset = y * roiW * 4;
      for (let x = 0; x < roiW; x++) {
        const idx = rowOffset + x * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];

        const diffR = Math.abs(r - tr);
        const diffG = Math.abs(g - tg);
        const diffB = Math.abs(b - tb);
        const maxDiff = Math.max(diffR, diffG, diffB);

        if (maxDiff <= tol && maxDiff < minDiff) {
          minDiff = maxDiff;
          bestX = x;
          bestY = y;
          bestHex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

          // Exact color match found
          if (minDiff === 0) break;
        }
      }
      if (minDiff === 0) break;
    }

    if (bestX === -1) {
      return { found: false, costMs: Math.round(performance.now() - tStart) };
    }

    // Exact physical coordinates
    const physX = rx1 + bestX;
    const physY = ry1 + bestY;

    // Convert from physical screenshot pixels to CSS pixels accurately
    const cssX = Math.round(physX / safeDpr);
    const cssY = Math.round(physY / safeDpr);

    return {
      found: true,
      x: cssX,
      y: cssY,
      physX,
      physY,
      actualColor: bestHex,
      diff: minDiff,
      dpr: safeDpr,
      costMs: Math.round(performance.now() - tStart)
    };
  }
};
