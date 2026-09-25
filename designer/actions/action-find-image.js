// action-find-image.js - Find Image Action Definition with Branching

import { ModalFindImage } from '../modals/modal-find-image.js';
import { ImageMatcher } from '../image_matcher.js';

export const ActionFindImage = {
  type: 'find_image',
  category: 'image',
  name: '找图',
  description: '在指定区域根据相似度查找图片，并支持成功/失败分支动作',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  `,
  color: '#059669',
  hasBranchOut: true, // Supports success and failure output branches
  outputPorts: [
    { id: 'success', name: '成功', color: '#10b981' },
    { id: 'failure', name: '失败', color: '#f59e0b' }
  ],
  defaultConfig: {
    templateImage: '',
    region: {
      x1: 0,
      y1: 0,
      x2: 1920,
      y2: 1080
    },
    minSimilarity: 60,
    repeatMode: 'times',
    repeatTimes: 1,
    intervalMs: 200,
    onSuccess: {
      enabled: true,
      mouseAction: 'move',
      targetPosition: 'center',
      nextAction: 'continue'
    },
    onFailure: {
      enabled: true,
      waitTime: 200,
      waitUnit: 'ms',
      nextAction: 'continue'
    }
  },
  formatSummary(config) {
    if (!config.templateImage) {
      return '未设置模板图 | 阈值: ' + config.minSimilarity + '%';
    }
    const modeDesc = config.repeatMode === 'loop' ? '循环找图' : `找${config.repeatTimes}次`;
    return `相似度≥${config.minSimilarity}% | ${modeDesc} | [${config.region.x1},${config.region.y1}-${config.region.x2},${config.region.y2}]`;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalFindImage(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    if (!config.templateImage) {
      context.logger.error('[找图] 错误：未设置待查找的模板图片！');
      return { success: false, nextPort: 'failure', error: '未设置模板图片' };
    }

    const maxAttempts = config.repeatMode === 'loop' ? 50 : Math.max(1, config.repeatTimes || 1);
    const interval = Math.max(20, config.intervalMs || 200);

    context.logger.info(`[找图] 开始识别，模式: ${config.repeatMode === 'loop' ? '循环识别直到找到' : '共' + maxAttempts + '次'}，阈值: ${config.minSimilarity}%`);

    let matchResult = null;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      if (context.isCancelled && context.isCancelled()) {
        context.logger.warn('[找图] 流程已取消');
        return { success: false, nextPort: 'failure', error: '流程已取消' };
      }

      try {
        const screenshotUrl = await context.tabBridge.captureTab();
        if (!screenshotUrl) {
          throw new Error('截取网页画面失败');
        }

        const metrics = await context.tabBridge.callTabMethod('GET_VIEWPORT_METRICS');
        const dpr = metrics?.dpr || 1;

        matchResult = await ImageMatcher.match(screenshotUrl, config.templateImage, {
          region: config.region,
          minSimilarity: config.minSimilarity,
          dpr,
          metrics
        });

        if (matchResult && matchResult.found) {
          context.logger.success(`[找图] 第${attempt}次识别成功！相似度: ${matchResult.similarityPct}%，坐标: (${matchResult.centerX}, ${matchResult.centerY})，耗时: ${matchResult.costMs}ms`);
          break;
        } else {
          context.logger.info(`[找图] 第${attempt}次未匹配 (最高相似度: ${matchResult?.similarityPct || 0}%)`);
        }
      } catch (err) {
        context.logger.warn(`[找图] 第${attempt}次异常: ${err.message}`);
      }

      if (attempt < maxAttempts) {
        const step = 50;
        let elapsed = 0;
        while (elapsed < interval) {
          if (context.isCancelled && context.isCancelled()) break;
          const wait = Math.min(step, interval - elapsed);
          await new Promise(r => setTimeout(r, wait));
          elapsed += wait;
        }
      }
    }

    // Branch: SUCCESS
    if (matchResult && matchResult.found) {
      // Highlight on target page
      await context.tabBridge.callTabMethod('HIGHLIGHT_MATCH', {
        rect: {
          x: matchResult.x,
          y: matchResult.y,
          width: matchResult.width,
          height: matchResult.height
        },
        label: `找图命中: ${matchResult.similarityPct}%`
      });

      // Post-action on success
      const succConfig = config.onSuccess || {};
      if (succConfig.enabled) {
        const targetX = succConfig.targetPosition === 'top_left' ? matchResult.x : matchResult.centerX;
        const targetY = succConfig.targetPosition === 'top_left' ? matchResult.y : matchResult.centerY;

        if (succConfig.mouseAction === 'move') {
          context.logger.info(`[找图成功] 自动移动鼠标至目标 (${targetX}, ${targetY})`);
          await context.tabBridge.callTabMethod('EXECUTE_MOVE_MOUSE', { x: targetX, y: targetY });
        } else if (succConfig.mouseAction === 'click') {
          context.logger.info(`[找图成功] 移动并单击目标 (${targetX}, ${targetY})`);
          await context.tabBridge.callTabMethod('EXECUTE_MOVE_MOUSE', { x: targetX, y: targetY });
          await context.tabBridge.callTabMethod('EXECUTE_MOUSE_CLICK', { x: targetX, y: targetY, button: 'left', actionType: 'click' });
        } else if (succConfig.mouseAction === 'dblclick') {
          context.logger.info(`[找图成功] 移动并双击目标 (${targetX}, ${targetY})`);
          await context.tabBridge.callTabMethod('EXECUTE_MOVE_MOUSE', { x: targetX, y: targetY });
          await context.tabBridge.callTabMethod('EXECUTE_MOUSE_CLICK', { x: targetX, y: targetY, button: 'left', actionType: 'dblclick' });
        }
      }

      if (succConfig.nextAction === 'stop') {
        context.logger.info('[找图成功] 设定为终止流程');
        return { success: true, stopWorkflow: true };
      }

      return {
        success: true,
        nextPort: 'success',
        data: matchResult
      };
    }

    // Branch: FAILURE
    const failConfig = config.onFailure || {};
    context.logger.warn('[找图] 最终未能在规定次数内找到目标图片');

    if (failConfig.enabled && failConfig.waitTime > 0) {
      context.logger.info(`[找图失败] 等待 ${failConfig.waitTime} 毫秒...`);
      const step = 100;
      let elapsed = 0;
      while (elapsed < failConfig.waitTime) {
        if (context.isCancelled && context.isCancelled()) break;
        const wait = Math.min(step, failConfig.waitTime - elapsed);
        await new Promise(r => setTimeout(r, wait));
        elapsed += wait;
      }
    }

    if (failConfig.nextAction === 'stop') {
      context.logger.error('[找图失败] 设定为终止流程');
      return { success: false, stopWorkflow: true, error: '未找到目标图片，流程终止' };
    }

    return {
      success: false,
      nextPort: 'failure',
      data: matchResult
    };
  }
};
