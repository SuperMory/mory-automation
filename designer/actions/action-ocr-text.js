// action-ocr-text.js - OCR Text Recognition Action Definition

import { ModalOcrText } from '../modals/modal-ocr-text.js';

export const ActionOcrText = {
  type: 'ocr_text',
  category: 'image',
  name: '文字识别',
  description: '在指定区域内识别特定文字并执行后续动作',
  icon: `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 7 4 4 20 4 20 7"></polyline>
      <line x1="9" y1="20" x2="15" y2="20"></line>
      <line x1="12" y1="4" x2="12" y2="20"></line>
    </svg>
  `,
  color: '#06b6d4',
  hasBranchOut: true, // Supports success and failure branches
  outputPorts: [
    { id: 'success', name: '成功', color: '#10b981' },
    { id: 'failure', name: '失败', color: '#f59e0b' }
  ],
  defaultConfig: {
    targetText: '',
    region: {
      x1: 0,
      y1: 0,
      x2: 1920,
      y2: 1080
    },
    minSimilarity: 90,
    repeatMode: 'times',
    repeatTimes: 1,
    intervalMs: 200,
    onSuccess: {
      enabled: true,
      mouseAction: 'move',
      targetPosition: 'center',
      copyToClipboard: false,
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
    if (!config.targetText) {
      return '未设置识别文本 | 匹配度: ' + config.minSimilarity + '%';
    }
    const modeDesc = config.repeatMode === 'loop' ? '循环识别' : `识${config.repeatTimes}次`;
    return `"${config.targetText.slice(0, 10)}" | 匹配≥${config.minSimilarity}% | ${modeDesc}`;
  },
  openConfigModal(config, onSave, onCancel, context) {
    const modal = new ModalOcrText(config, onSave, onCancel, context);
    modal.show();
    return modal;
  },
  async execute(context, config) {
    if (!config.targetText) {
      context.logger.error('[文字识别] 错误：未设置需要识别的文字！');
      return { success: false, nextPort: 'failure', error: '未输入识别文本' };
    }

    const maxAttempts = config.repeatMode === 'loop' ? 50 : Math.max(1, config.repeatTimes || 1);
    const interval = Math.max(20, config.intervalMs || 200);

    context.logger.info(`[文字识别] 开始查找文字: "${config.targetText}"，模式: ${config.repeatMode === 'loop' ? '循环直到找到' : '共' + maxAttempts + '次'}，阈值: ${config.minSimilarity}%`);

    let matchResult = null;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      if (context.isCancelled && context.isCancelled()) {
        context.logger.warn('[文字识别] 流程已取消');
        return { success: false, nextPort: 'failure', error: '流程已取消' };
      }

      try {
        const res = await context.tabBridge.callTabMethod('FIND_TEXT_IN_REGION', {
          text: config.targetText,
          region: config.region,
          minSimilarity: config.minSimilarity
        });

        if (res && res.found) {
          matchResult = res;
          context.logger.success(`[文字识别] 第${attempt}次识别成功！匹配文字: "${res.text}" (${res.similarity}%)，中心坐标: (${res.centerX}, ${res.centerY})`);
          break;
        } else {
          context.logger.info(`[文字识别] 第${attempt}次未检索到匹配文字`);
        }
      } catch (err) {
        context.logger.warn(`[文字识别] 第${attempt}次异常: ${err.message}`);
      }

      if (attempt < maxAttempts) {
        if (context.sleep) {
          const res = await context.sleep(interval, 'OCR重试等待');
          if (res.cancelled) break;
        } else {
          await new Promise(r => setTimeout(r, interval));
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
        label: `文字命中: ${matchResult.similarity}%`
      });

      const succConfig = config.onSuccess || {};
      if (succConfig.enabled) {
        const targetX = succConfig.targetPosition === 'top_left' ? matchResult.x : matchResult.centerX;
        const targetY = succConfig.targetPosition === 'top_left' ? matchResult.y : matchResult.centerY;

        if (succConfig.mouseAction === 'move') {
          context.logger.info(`[文字识别成功] 自动移动鼠标至文字坐标 (${targetX}, ${targetY})`);
          await context.tabBridge.callTabMethod('EXECUTE_MOVE_MOUSE', { x: targetX, y: targetY });
        } else if (succConfig.mouseAction === 'click') {
          context.logger.info(`[文字识别成功] 移动并单击文字 (${targetX}, ${targetY})`);
          await context.tabBridge.callTabMethod('EXECUTE_MOVE_MOUSE', { x: targetX, y: targetY });
          await context.tabBridge.callTabMethod('EXECUTE_MOUSE_CLICK', { x: targetX, y: targetY, button: 'left', actionType: 'click' });
        } else if (succConfig.mouseAction === 'dblclick') {
          context.logger.info(`[文字识别成功] 移动并双击文字 (${targetX}, ${targetY})`);
          await context.tabBridge.callTabMethod('EXECUTE_MOVE_MOUSE', { x: targetX, y: targetY });
          await context.tabBridge.callTabMethod('EXECUTE_MOUSE_CLICK', { x: targetX, y: targetY, button: 'left', actionType: 'dblclick' });
        }
      }

      if (succConfig.copyToClipboard) {
        context.logger.info(`[文字识别] 已将识别文字 "${matchResult.text}" 存入剪贴板`);
        await context.tabBridge.callTabMethod('COPY_TO_CLIPBOARD', { text: matchResult.text });
      }

      if (succConfig.nextAction === 'stop') {
        context.logger.info('[文字识别成功] 设定为终止流程');
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
    context.logger.warn(`[文字识别] 未能在区域内识别到文字 "${config.targetText}"`);

    if (failConfig.enabled && failConfig.waitTime > 0) {
      context.logger.info(`[识别失败] 等待 ${failConfig.waitTime} 毫秒...`);
      if (context.sleep) {
        await context.sleep(failConfig.waitTime, 'OCR失败等待');
      } else {
        await new Promise(r => setTimeout(r, failConfig.waitTime));
      }
    }

    if (failConfig.nextAction === 'stop') {
      context.logger.error('[识别失败] 设定为终止流程');
      return { success: false, stopWorkflow: true, error: '文字识别失败，流程终止' };
    }

    return {
      success: false,
      nextPort: 'failure',
      data: matchResult
    };
  }
};
