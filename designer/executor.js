// executor.js - RPA Flow Workflow Execution Engine

import { ActionRegistry } from './actions/action-registry.js';

export class FlowExecutor {
  constructor(options = {}) {
    this.tabBridge = options.tabBridge;
    this.logger = options.logger || console;
    this.onNodeStateChange = options.onNodeStateChange || (() => {});
    this.onFinish = options.onFinish || (() => {});

    this.isRunning = false;
    this.isPaused = false;
    this.isStopRequested = false;
    this.currentNodeId = null;
  }

  stop() {
    this.isStopRequested = true;
    this.isRunning = false;
    this.isPaused = false;
    this.logger.warn('[执行器] 用户终止了流程执行');
  }

  pause() {
    this.isPaused = true;
    this.logger.info('[执行器] 流程已暂停');
  }

  resume() {
    this.isPaused = false;
    this.logger.info('[执行器] 流程继续执行');
  }

  /**
   * Execute single node (for debugging)
   */
  async executeSingleNode(node) {
    const actionDef = ActionRegistry.get(node.type);
    if (!actionDef) {
      this.logger.error(`找不到动作类型定义: ${node.type}`);
      return;
    }

    this.logger.info(`[单步调试] 开始执行节点: 【${actionDef.name}】(${node.id})`);
    this.onNodeStateChange(node.id, 'active');

    const context = {
      tabBridge: this.tabBridge,
      logger: this.logger,
      isCancelled: () => this.isStopRequested
    };

    try {
      const res = await actionDef.execute(context, node.config);
      if (res && res.success) {
        this.onNodeStateChange(node.id, 'success');
        this.logger.success(`[单步调试] 节点执行完成 ✔`);
      } else {
        this.onNodeStateChange(node.id, 'error');
        this.logger.error(`[单步调试] 节点执行失败 ❌: ${res?.error || ''}`);
      }
      return res;
    } catch (err) {
      this.onNodeStateChange(node.id, 'error');
      this.logger.error(`[单步调试] 发生未捕获异常: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Run entire flow based on graph topology or sequence
   */
  async runFlow(graphData) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.isStopRequested = false;

    const { nodes = [], edges = [] } = graphData;
    if (nodes.length === 0) {
      this.logger.warn('[执行器] 画布中没有节点，无法执行');
      this.isRunning = false;
      this.onFinish(false);
      return;
    }

    this.logger.info(`================ 开始执行自动化流程 (共 ${nodes.length} 个步骤) ================`);

    // Build node map
    const nodeMap = new Map();
    nodes.forEach(n => nodeMap.set(n.id, n));

    // Find starting node
    let startNode = null;
    const explicitStart = nodes.find(n => n.type === 'flow_start');
    if (explicitStart) {
      startNode = explicitStart;
    } else if (edges.length > 0) {
      // Find node with no incoming edges
      const hasIncoming = new Set(edges.map(e => e.toNode));
      startNode = nodes.find(n => !hasIncoming.has(n.id));
    }
    // Fallback: leftmost node
    if (!startNode) {
      startNode = [...nodes].sort((a, b) => a.x - b.x)[0];
    }

    let curNode = startNode;
    let stepCount = 0;
    const maxSteps = 10000000; // Allows 24/7 continuous infinite loops with manual stop capability

    while (curNode && stepCount < maxSteps) {
      if (this.isStopRequested) {
        this.logger.warn('[执行器] 执行被终止');
        break;
      }

      // Handle pause
      while (this.isPaused && !this.isStopRequested) {
        await new Promise(r => setTimeout(r, 200));
      }
      if (this.isStopRequested) break;

      stepCount++;
      const actionDef = ActionRegistry.get(curNode.type);
      if (!actionDef) {
        this.logger.error(`未知动作类型: ${curNode.type}`);
        break;
      }

      this.currentNodeId = curNode.id;
      this.onNodeStateChange(curNode.id, 'active');
      this.logger.info(`[步骤 ${stepCount}] 正在执行: 【${curNode.name || actionDef.name}】(${curNode.id})...`);

      const context = {
        tabBridge: this.tabBridge,
        logger: this.logger,
        isCancelled: () => this.isStopRequested
      };

      let result = null;
      try {
        result = await actionDef.execute(context, curNode.config);
      } catch (e) {
        result = { success: false, error: e.message };
      }

      if (result && result.success) {
        this.onNodeStateChange(curNode.id, 'success');
      } else {
        this.onNodeStateChange(curNode.id, 'error');
      }

      if (result && result.stopWorkflow) {
        this.logger.info('[执行器] 流程按配置指示正常结束');
        break;
      }

      // Check if jumpToNodeId is specified (Goto step)
      if (result && result.jumpToNodeId) {
        const target = nodeMap.get(result.jumpToNodeId) || nodes.find(n => n.id.includes(result.jumpToNodeId));
        if (target) {
          this.logger.info(`[执行器] 流程跳转至步骤: 【${target.name || ActionRegistry.get(target.type)?.name || ''}】(${target.id})`);
          curNode = target;
          await new Promise(r => setTimeout(r, 150));
          continue;
        } else {
          this.logger.warn(`[执行器] 未找到跳转目标步骤: "${result.jumpToNodeId}"，按原路线继续`);
        }
      }

      // Find next node
      const nextPort = result?.nextPort || 'default';
      let nextEdge = edges.find(e => e.fromNode === curNode.id && (e.fromPort === nextPort || e.fromPort === 'default'));

      // If no explicit edges exist, fallback to sequential order by X coordinate
      if (!nextEdge && edges.length === 0) {
        const sorted = [...nodes].sort((a, b) => a.x - b.x);
        const curIdx = sorted.findIndex(n => n.id === curNode.id);
        if (curIdx >= 0 && curIdx < sorted.length - 1) {
          curNode = sorted[curIdx + 1];
          await new Promise(r => setTimeout(r, 150));
          continue;
        } else {
          curNode = null;
          break;
        }
      }

      if (nextEdge) {
        curNode = nodeMap.get(nextEdge.toNode);
      } else {
        curNode = null; // End of path
      }

      // Short breathing room between steps
      await new Promise(r => setTimeout(r, 150));
    }

    this.isRunning = false;
    this.logger.info(`================ 流程执行完成 (共执行 ${stepCount} 步) ================`);
    this.onFinish(true);
  }
}
