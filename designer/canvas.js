// canvas.js - Visual Node Graph Canvas with Drag & Drop and Port Wiring

import { ActionRegistry } from './actions/action-registry.js';

export class FlowCanvas {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.options = options;
    this.onNodeEdit = options.onNodeEdit || (() => {});
    this.onNodeTest = options.onNodeTest || (() => {});
    this.onLog = options.onLog || (() => {});
    this.onChange = options.onChange || (() => {});

    this.nodes = new Map(); // id -> nodeData
    this.edges = []; // array of { id, fromNode, fromPort, toNode, toPort }

    this.scale = 1;
    this.panX = 40;
    this.panY = 40;
    this.isPanning = false;
    this.startPan = { x: 0, y: 0 };

    this.lineStyle = localStorage.getItem('mory_line_style') || 'bezier'; // 'bezier' | 'orthogonal' | 'straight'
    this.connectingFrom = null; // { nodeId, portId, startX, startY }
    this.selectedEdgeId = null;
    this.draggingEdgeHandle = null; // { edgeId }

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="mory-canvas-viewport" id="canvas-viewport">
        <svg class="mory-canvas-svg" id="canvas-svg">
          <defs>
            <marker id="arrow-default" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
            </marker>
            <marker id="arrow-success" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
            </marker>
            <marker id="arrow-failure" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
            </marker>
            <marker id="arrow-done" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
            </marker>
            <marker id="arrow-selected" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#2563eb" />
            </marker>
          </defs>
          <g id="edges-layer"></g>
          <g id="temp-edge-layer">
            <path id="temp-edge" class="mory-temp-edge" d="" marker-end="url(#arrow-success)" style="display: none;"></path>
          </g>
        </svg>
        <div class="mory-nodes-layer" id="nodes-layer"></div>
      </div>

      <!-- Canvas zoom/pan & line style controls -->
      <div class="mory-canvas-controls">
        <button type="button" class="mory-ctrl-btn" id="btn-toggle-line-style" title="切换连线排线风格: 折线排线 / 平滑曲线 / 直线" style="font-size: 11px; padding: 0 8px; width: auto; font-weight: 500;">
          <span id="lbl-line-style-icon">☵</span> <span id="lbl-line-style-text">排线</span>
        </button>
        <div style="width: 1px; height: 16px; background: #e2e8f0; margin: 0 2px;"></div>
        <button type="button" class="mory-ctrl-btn" id="btn-zoom-in" title="放大">+</button>
        <span class="mory-ctrl-zoom-text" id="lbl-zoom">100%</span>
        <button type="button" class="mory-ctrl-btn" id="btn-zoom-out" title="缩小">-</button>
        <button type="button" class="mory-ctrl-btn" id="btn-zoom-reset" title="重置视角">⟲</button>
        <button type="button" class="mory-ctrl-btn" id="btn-auto-layout" title="自动排版">⚡</button>
      </div>
    `;

    this.viewportEl = this.container.querySelector('#canvas-viewport');
    this.svgEl = this.container.querySelector('#canvas-svg');
    this.edgesLayerEl = this.container.querySelector('#edges-layer');
    this.tempEdgeLayerEl = this.container.querySelector('#temp-edge-layer');
    this.nodesLayerEl = this.container.querySelector('#nodes-layer');
    this.tempEdgeEl = this.container.querySelector('#temp-edge');

    this.updateLineStyleButton();
    this.applyTransform();
  }

  applyTransform() {
    this.nodesLayerEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    this.nodesLayerEl.style.transformOrigin = '0 0';
    this.edgesLayerEl.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.scale})`);
    if (this.tempEdgeLayerEl) {
      this.tempEdgeLayerEl.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.scale})`);
    }
    this.container.querySelector('#lbl-zoom').textContent = `${Math.round(this.scale * 100)}%`;
  }

  bindEvents() {
    // Zoom & Pan
    this.viewportEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(2.5, Math.max(0.4, this.scale * zoomFactor));

      const rect = this.viewportEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
      this.scale = newScale;

      this.applyTransform();
      this.renderEdges();
    }, { passive: false });

    // Drag Canvas background to pan
    this.viewportEl.addEventListener('mousedown', (e) => {
      if (e.target === this.viewportEl || e.target === this.svgEl || e.target.id === 'edges-layer') {
        this.isPanning = true;
        this.startPan = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.viewportEl.style.cursor = 'grabbing';
      }
    });

    // Click Canvas background to deselect edge
    this.viewportEl.addEventListener('click', (e) => {
      if (e.target === this.viewportEl || e.target === this.svgEl || e.target.id === 'edges-layer') {
        if (this.selectedEdgeId) {
          this.selectedEdgeId = null;
          this.renderEdges();
        }
      }
    });

    // Keyboard Delete / Backspace to remove selected edge
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedEdgeId) {
        e.preventDefault();
        this.removeEdge(this.selectedEdgeId);
        this.selectedEdgeId = null;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.startPan.x;
        this.panY = e.clientY - this.startPan.y;
        this.applyTransform();
        return;
      }

      if (this.draggingEdgeHandle) {
        const rect = this.viewportEl.getBoundingClientRect();
        const curX = (e.clientX - rect.left - this.panX) / this.scale;
        const curY = (e.clientY - rect.top - this.panY) / this.scale;
        const edge = this.edges.find(ed => ed.id === this.draggingEdgeHandle.edgeId);
        if (edge) {
          edge.customMidX = Math.round(curX);
          edge.customMidY = Math.round(curY);
          this.renderEdges();
        }
        return;
      }

      if (this.connectingFrom) {
        const rect = this.viewportEl.getBoundingClientRect();
        const curX = (e.clientX - rect.left - this.panX) / this.scale;
        const curY = (e.clientY - rect.top - this.panY) / this.scale;

        const pathD = this.calculatePath(
          this.connectingFrom.startX,
          this.connectingFrom.startY,
          curX,
          curY
        );
        this.tempEdgeEl.setAttribute('d', pathD);
        this.tempEdgeEl.style.display = 'block';
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewportEl.style.cursor = 'default';
      }
      if (this.draggingEdgeHandle) {
        this.draggingEdgeHandle = null;
        this.onChange();
      }
      if (this.connectingFrom) {
        this.connectingFrom = null;
        this.tempEdgeEl.style.display = 'none';
      }
    });

    // Line Style Toggle Button
    const toggleLineBtn = this.container.querySelector('#btn-toggle-line-style');
    if (toggleLineBtn) {
      toggleLineBtn.addEventListener('click', () => {
        this.toggleLineStyle();
      });
    }

    // Zoom Buttons
    this.container.querySelector('#btn-zoom-in').addEventListener('click', () => {
      this.scale = Math.min(2.5, this.scale * 1.15);
      this.applyTransform();
      this.renderEdges();
    });

    this.container.querySelector('#btn-zoom-out').addEventListener('click', () => {
      this.scale = Math.max(0.4, this.scale / 1.15);
      this.applyTransform();
      this.renderEdges();
    });

    this.container.querySelector('#btn-zoom-reset').addEventListener('click', () => {
      this.scale = 1;
      this.panX = 40;
      this.panY = 40;
      this.applyTransform();
      this.renderEdges();
    });

    this.container.querySelector('#btn-auto-layout').addEventListener('click', () => {
      this.autoLayout();
    });

    // Drag and Drop from left library
    this.viewportEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    this.viewportEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const actionType = e.dataTransfer.getData('application/mory-action');
      if (!actionType) return;

      const rect = this.viewportEl.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left - this.panX) / this.scale);
      const y = Math.round((e.clientY - rect.top - this.panY) / this.scale);

      this.addNode(actionType, x - 100, y - 40);
    });
  }

  /**
   * Add a new node to canvas
   */
  addNode(actionType, x = 100, y = 100, customConfig = null, customId = null, customName = null) {
    const actionDef = ActionRegistry.get(actionType);
    if (!actionDef) {
      console.error('未知动作类型:', actionType);
      return null;
    }

    let id = customId;
    if (!id) {
      if (actionType === 'flow_start') {
        id = 'start';
      } else {
        let seq = 1;
        while (this.nodes.has(`step_${seq}`)) {
          seq++;
        }
        id = `step_${seq}`;
      }
    }

    const config = customConfig ? JSON.parse(JSON.stringify(customConfig)) : JSON.parse(JSON.stringify(actionDef.defaultConfig));
    const name = customName || actionDef.name;

    const nodeData = {
      id,
      name,
      type: actionType,
      x: Math.max(20, Math.round(x)),
      y: Math.max(20, Math.round(y)),
      config
    };

    this.nodes.set(id, nodeData);
    this.renderNodeDOM(nodeData);
    this.renderEdges();
    this.onChange();

    return nodeData;
  }

  renderNodeDOM(nodeData) {
    const actionDef = ActionRegistry.get(nodeData.type);
    const existing = document.getElementById(nodeData.id);
    if (existing) existing.remove();

    const nodeEl = document.createElement('div');
    nodeEl.id = nodeData.id;
    nodeEl.className = `mory-canvas-node ${nodeData.type}`;
    nodeEl.style.left = `${nodeData.x}px`;
    nodeEl.style.top = `${nodeData.y}px`;

    // Ports html
    let outPortsHtml = '';
    if (actionDef.hasBranchOut && actionDef.outputPorts) {
      outPortsHtml = `
        <div class="mory-ports-branch">
          ${actionDef.outputPorts.map(p => `
            <div class="mory-port-branch-item">
              <span class="mory-branch-label" style="color: ${p.color};">${p.name}</span>
              <div class="mory-node-port port-out" data-port="${p.id}" style="background: ${p.color};" title="${p.name}分支"></div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      outPortsHtml = `
        <div class="mory-node-port port-out" data-port="default" title="输出"></div>
      `;
    }

    const summaryText = actionDef.formatSummary ? actionDef.formatSummary(nodeData.config) : '';
    const displayName = nodeData.name || actionDef.name;

    let previewExtraHtml = '';
    if (nodeData.type === 'find_image' && nodeData.config.templateImage) {
      previewExtraHtml = `
        <div class="mory-node-preview-img-wrap" style="margin-top: 6px; padding: 4px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; display: inline-flex; align-items: center; max-width: 100%;">
          <img src="${nodeData.config.templateImage}" style="max-height: 42px; max-width: 100%; object-fit: contain; border-radius: 2px;" alt="待找图预览" />
        </div>
      `;
    } else if (nodeData.type === 'find_color' && nodeData.config.color) {
      previewExtraHtml = `
        <div style="margin-top: 5px; display: flex; align-items: center; gap: 6px; font-size: 11px;">
          <span style="display: inline-block; width: 14px; height: 14px; background: ${nodeData.config.color}; border: 1px solid #94a3b8; border-radius: 3px;"></span>
          <span style="font-weight: 600; color: #1e293b;">${nodeData.config.color}</span>
        </div>
      `;
    }

    const isStartNode = nodeData.type === 'flow_start';
    const inPortHtml = isStartNode 
      ? '' 
      : '<div class="mory-node-port port-in" data-port="in" title="输入"></div>';

    nodeEl.innerHTML = `
      ${inPortHtml}
      <div class="mory-node-header" style="border-left-color: ${actionDef.color};">
        <div class="mory-node-header-top">
          <span class="mory-node-badge-id" title="点击复制步骤ID: ${nodeData.id}">
            <span class="mory-badge-hash">#</span><span class="mory-badge-text">${nodeData.id}</span>
          </span>
          <div class="mory-node-actions">
            <button type="button" class="mory-node-btn btn-rename" title="修改步骤名称">✏️</button>
            <button type="button" class="mory-node-btn btn-step" title="单步测试">▶</button>
            <button type="button" class="mory-node-btn btn-settings" title="配置参数">⚙</button>
            <button type="button" class="mory-node-btn btn-del" title="删除">&times;</button>
          </div>
        </div>
        <div class="mory-node-header-main">
          <span class="mory-node-icon" style="color: ${actionDef.color};">${actionDef.icon}</span>
          <span class="mory-node-title" title="${displayName} (双击可修改名称)">${displayName}</span>
        </div>
      </div>
      <div class="mory-node-body">
        <div class="mory-node-summary">${summaryText}</div>
        ${previewExtraHtml}
      </div>
      ${outPortsHtml}
    `;

    this.nodesLayerEl.appendChild(nodeEl);

    // Copy ID on badge click
    const badgeEl = nodeEl.querySelector('.mory-node-badge-id');
    badgeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(nodeData.id);
      const textEl = badgeEl.querySelector('.mory-badge-text') || badgeEl;
      const prev = textEl.textContent;
      textEl.textContent = '已复制';
      badgeEl.classList.add('copied');
      setTimeout(() => {
        textEl.textContent = prev;
        badgeEl.classList.remove('copied');
      }, 1000);
    });

    // Inline Rename Handlers
    const titleEl = nodeEl.querySelector('.mory-node-title');
    const renameBtn = nodeEl.querySelector('.btn-rename');

    const startInlineRename = (e) => {
      if (e) e.stopPropagation();
      if (nodeEl.querySelector('.mory-node-title-input')) return;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'mory-node-title-input';
      input.value = nodeData.name || actionDef.name;
      input.maxLength = 30;

      const commitRename = () => {
        const val = input.value.trim();
        nodeData.name = val || actionDef.name;
        titleEl.textContent = nodeData.name;
        titleEl.title = `${nodeData.name} (双击可修改名称)`;
        if (input.parentNode) {
          input.replaceWith(titleEl);
        }
        this.onChange();
      };

      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          ke.preventDefault();
          commitRename();
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          if (input.parentNode) {
            input.replaceWith(titleEl);
          }
        }
      });
      input.addEventListener('blur', commitRename);

      titleEl.replaceWith(input);
      input.focus();
      input.select();
    };

    renameBtn.addEventListener('click', startInlineRename);
    titleEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startInlineRename(e);
    });

    // Make node draggable
    this.makeNodeDraggable(nodeEl, nodeData);

    // Bind Port Connecting
    const outPorts = nodeEl.querySelectorAll('.port-out');
    outPorts.forEach(port => {
      port.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const portId = port.getAttribute('data-port');
        const portRect = port.getBoundingClientRect();
        const vpRect = this.viewportEl.getBoundingClientRect();

        const startX = (portRect.left + portRect.width / 2 - vpRect.left - this.panX) / this.scale;
        const startY = (portRect.top + portRect.height / 2 - vpRect.top - this.panY) / this.scale;

        this.connectingFrom = {
          nodeId: nodeData.id,
          portId,
          startX,
          startY
        };
      });
    });

    // In Port connection receiver (if port exists)
    const inPort = nodeEl.querySelector('.port-in');
    if (inPort) {
      inPort.addEventListener('mouseup', (e) => {
        if (this.connectingFrom && this.connectingFrom.nodeId !== nodeData.id) {
          e.stopPropagation();
          this.addEdge(
            this.connectingFrom.nodeId,
            this.connectingFrom.portId,
            nodeData.id,
            'in'
          );
          this.connectingFrom = null;
          this.tempEdgeEl.style.display = 'none';
        }
      });
    }

    // Also allow dropping connection line onto node body to connect to in-port
    if (!isStartNode) {
      nodeEl.addEventListener('mouseup', (e) => {
        if (this.connectingFrom && this.connectingFrom.nodeId !== nodeData.id) {
          if (!e.target.closest('.port-out') && !e.target.closest('.mory-node-btn')) {
            e.stopPropagation();
            this.addEdge(
              this.connectingFrom.nodeId,
              this.connectingFrom.portId,
              nodeData.id,
              'in'
            );
            this.connectingFrom = null;
            this.tempEdgeEl.style.display = 'none';
          }
        }
      });
    }

    // Node Action Buttons
    nodeEl.querySelector('.btn-settings').addEventListener('click', (e) => {
      e.stopPropagation();
      this.onNodeEdit(nodeData);
    });

    nodeEl.querySelector('.btn-step').addEventListener('click', (e) => {
      e.stopPropagation();
      this.onNodeTest(nodeData);
    });

    nodeEl.querySelector('.btn-del').addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeNode(nodeData.id);
    });

    // Double click to open config
    nodeEl.addEventListener('dblclick', (e) => {
      if (!e.target.closest('.mory-node-btn') && !e.target.closest('.mory-node-port') && !e.target.closest('.mory-node-title-input')) {
        this.onNodeEdit(nodeData);
      }
    });
  }

  makeNodeDraggable(nodeEl, nodeData) {
    const header = nodeEl.querySelector('.mory-node-header');
    let isMoving = false;
    let startX = 0;
    let startY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.mory-node-btn') || e.target.closest('.mory-node-port') || e.target.closest('.mory-node-badge-id') || e.target.closest('.mory-node-title-input')) return;
      isMoving = true;
      startX = e.clientX;
      startY = e.clientY;

      const initX = nodeData.x;
      const initY = nodeData.y;

      const onMouseMove = (moveEvent) => {
        if (!isMoving) return;
        const dx = (moveEvent.clientX - startX) / this.scale;
        const dy = (moveEvent.clientY - startY) / this.scale;

        nodeData.x = Math.max(0, Math.round(initX + dx));
        nodeData.y = Math.max(0, Math.round(initY + dy));

        nodeEl.style.left = `${nodeData.x}px`;
        nodeEl.style.top = `${nodeData.y}px`;

        this.renderEdges();
      };

      const onMouseUp = () => {
        if (isMoving) {
          isMoving = false;
          this.onChange();
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  updateNodeConfig(nodeId, newConfig, newName) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.config = newConfig;
    if (newName !== undefined && newName.trim()) {
      node.name = newName.trim();
    }

    this.renderNodeDOM(node);
    this.renderEdges();
    this.onChange();
  }

  updateNodeName(nodeId, newName) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    const actionDef = ActionRegistry.get(node.type);
    node.name = (newName || '').trim() || actionDef?.name || node.type;
    const nodeEl = document.getElementById(nodeId);
    if (nodeEl) {
      const titleEl = nodeEl.querySelector('.mory-node-title');
      if (titleEl) titleEl.textContent = node.name;
    }
    this.onChange();
  }

  removeNode(nodeId) {
    const nodeEl = document.getElementById(nodeId);
    if (nodeEl) nodeEl.remove();

    this.nodes.delete(nodeId);
    this.edges = this.edges.filter(e => e.fromNode !== nodeId && e.toNode !== nodeId);

    this.renderEdges();
    this.onChange();
  }

  addEdge(fromNode, fromPort, toNode, toPort) {
    // Avoid duplicates
    const exists = this.edges.some(e =>
      e.fromNode === fromNode &&
      e.fromPort === fromPort &&
      e.toNode === toNode &&
      e.toPort === toPort
    );
    if (exists) return;

    // Single connection from port rule: if already connected from this port, replace it
    this.edges = this.edges.filter(e => !(e.fromNode === fromNode && e.fromPort === fromPort));

    const edgeId = `edge_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.edges.push({ id: edgeId, fromNode, fromPort, toNode, toPort });

    this.renderEdges();
    this.onChange();
  }

  removeEdge(edgeId) {
    this.edges = this.edges.filter(e => e.id !== edgeId);
    this.renderEdges();
    this.onChange();
  }

  renderEdges() {
    this.edgesLayerEl.innerHTML = '';

    for (const edge of this.edges) {
      const fromEl = document.getElementById(edge.fromNode);
      const toEl = document.getElementById(edge.toNode);
      if (!fromEl || !toEl) continue;

      const fromPortEl = fromEl.querySelector(`.port-out[data-port="${edge.fromPort}"]`) || fromEl.querySelector('.port-out');
      const toPortEl = toEl.querySelector('.port-in');
      if (!fromPortEl || !toPortEl) continue;

      const vpRect = this.viewportEl.getBoundingClientRect();
      const fRect = fromPortEl.getBoundingClientRect();
      const tRect = toPortEl.getBoundingClientRect();

      const fx = (fRect.left + fRect.width / 2 - vpRect.left - this.panX) / this.scale;
      const fy = (fRect.top + fRect.height / 2 - vpRect.top - this.panY) / this.scale;
      const tx = (tRect.left + tRect.width / 2 - vpRect.left - this.panX) / this.scale;
      const ty = (tRect.top + tRect.height / 2 - vpRect.top - this.panY) / this.scale;

      const isSelected = this.selectedEdgeId === edge.id;
      const pathD = this.calculatePath(fx, fy, tx, ty, edge);

      // Edge container group
      const groupEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      groupEl.setAttribute('class', `mory-edge-group ${isSelected ? 'selected' : ''}`);
      groupEl.setAttribute('data-edge-id', edge.id);

      // Visible styled path
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', pathD);
      pathEl.setAttribute('class', `mory-canvas-edge branch-${edge.fromPort} ${isSelected ? 'selected' : ''}`);

      let marker = 'arrow-default';
      if (isSelected) {
        marker = 'arrow-selected';
      } else if (edge.fromPort === 'success' || edge.fromPort === 'body') {
        marker = 'arrow-success';
      } else if (edge.fromPort === 'failure') {
        marker = 'arrow-failure';
      } else if (edge.fromPort === 'done') {
        marker = 'arrow-done';
      }
      pathEl.setAttribute('marker-end', `url(#${marker})`);

      // Wide invisible hit area for easy click & hover
      const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitArea.setAttribute('d', pathD);
      hitArea.setAttribute('class', 'mory-edge-hit-area');
      hitArea.setAttribute('stroke', 'transparent');
      hitArea.setAttribute('stroke-width', '24');
      hitArea.setAttribute('fill', 'none');

      // Click hit area to select
      hitArea.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedEdgeId = edge.id;
        this.renderEdges();
      });

      // Double click to reset custom waypoint
      hitArea.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        edge.customMidX = undefined;
        edge.customMidY = undefined;
        this.renderEdges();
        this.onChange();
      });

      // Calculate midpoint for the control pill
      const mid = this.getEdgeMidpoint(fx, fy, tx, ty, edge);

      // Floating modern control pill (appears on hover or when selected)
      const pillGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      pillGroup.setAttribute('class', 'mory-edge-ctrl-pill');
      pillGroup.setAttribute('transform', `translate(${Math.round(mid.x)}, ${Math.round(mid.y)})`);

      pillGroup.innerHTML = `
        <rect x="-24" y="-12" width="48" height="24" rx="12" class="mory-pill-bg" />
        <circle cx="-10" cy="0" r="4.5" class="mory-pill-handle" title="按住拖拽拐点 / 双击重置" />
        <line x1="1" y1="-6" x2="1" y2="6" stroke="#e2e8f0" stroke-width="1" />
        <g class="mory-pill-del" transform="translate(12, 0)" title="删除此连线 (Delete键)">
          <circle r="7.5" fill="transparent" class="mory-pill-del-hover" />
          <path d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" />
        </g>
      `;

      // Handle dragging
      const handleEl = pillGroup.querySelector('.mory-pill-handle');
      handleEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.selectedEdgeId = edge.id;
        this.draggingEdgeHandle = { edgeId: edge.id };
        handleEl.classList.add('dragging');
      });

      // Double-click pill to reset
      pillGroup.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        edge.customMidX = undefined;
        edge.customMidY = undefined;
        this.renderEdges();
        this.onChange();
      });

      // Delete action
      const delEl = pillGroup.querySelector('.mory-pill-del');
      delEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeEdge(edge.id);
        if (this.selectedEdgeId === edge.id) {
          this.selectedEdgeId = null;
        }
      });

      groupEl.appendChild(pathEl);
      groupEl.appendChild(hitArea);
      groupEl.appendChild(pillGroup);

      this.edgesLayerEl.appendChild(groupEl);
    }
  }

  updateLineStyleButton() {
    const btn = this.container.querySelector('#btn-toggle-line-style');
    if (!btn) return;
    const iconEl = btn.querySelector('#lbl-line-style-icon');
    const textEl = btn.querySelector('#lbl-line-style-text');

    if (this.lineStyle === 'straight') {
      if (iconEl) iconEl.textContent = '╱';
      if (textEl) textEl.textContent = '直线';
      btn.title = '当前连线风格: 直线 (点击切换为: 平滑曲线)';
    } else if (this.lineStyle === 'orthogonal') {
      if (iconEl) iconEl.textContent = '☵';
      if (textEl) textEl.textContent = '排线';
      btn.title = '当前连线风格: 折线排线 (点击切换为: 直线)';
    } else {
      if (iconEl) iconEl.textContent = '〰';
      if (textEl) textEl.textContent = '曲线';
      btn.title = '当前连线风格: 平滑曲线 (点击切换为: 折线排线)';
    }
  }

  toggleLineStyle() {
    if (this.lineStyle === 'bezier') {
      this.lineStyle = 'orthogonal';
    } else if (this.lineStyle === 'orthogonal') {
      this.lineStyle = 'straight';
    } else {
      this.lineStyle = 'bezier';
    }
    localStorage.setItem('mory_line_style', this.lineStyle);
    this.updateLineStyleButton();
    this.renderEdges();
  }

  getEdgeMidpoint(fx, fy, tx, ty, edge) {
    if (edge && typeof edge.customMidX === 'number' && typeof edge.customMidY === 'number') {
      return { x: edge.customMidX, y: edge.customMidY };
    }
    const endX = tx - 4;
    const endY = ty;
    const dx = endX - fx;
    const dy = endY - fy;

    if (this.lineStyle === 'orthogonal') {
      if (endX >= fx + 24) {
        const midX = (edge && typeof edge.customMidX === 'number') ? edge.customMidX : (fx + dx * 0.5);
        return { x: midX, y: fy + dy * 0.5 };
      } else {
        const midY = (edge && typeof edge.customMidY === 'number')
          ? edge.customMidY
          : (Math.abs(dy) < 80 ? (endY >= fy ? Math.max(fy, endY) + 70 : Math.min(fy, endY) - 70) : (fy + endY) * 0.5);
        return { x: (fx + endX) * 0.5, y: midY };
      }
    }

    return { x: (fx + endX) * 0.5, y: (fy + endY) * 0.5 };
  }

  calculatePath(x1, y1, x2, y2, edge = null) {
    if (this.lineStyle === 'straight') {
      return this.calculateStraightPath(x1, y1, x2, y2, edge);
    }
    if (this.lineStyle === 'orthogonal') {
      return this.calculateOrthogonalPath(x1, y1, x2, y2, edge);
    }
    return this.calculateBezierPath(x1, y1, x2, y2, edge);
  }

  calculateStraightPath(x1, y1, x2, y2, edge = null) {
    const endX = x2 - 4;
    const endY = y2;
    if (edge && typeof edge.customMidX === 'number' && typeof edge.customMidY === 'number') {
      return `M ${x1} ${y1} L ${edge.customMidX} ${edge.customMidY} L ${endX} ${endY}`;
    }
    return `M ${x1} ${y1} L ${endX} ${endY}`;
  }

  calculateBezierPath(x1, y1, x2, y2, edge = null) {
    const endX = x2 - 4;
    const endY = y2;

    // Custom waypoint dragged by user
    if (edge && typeof edge.customMidX === 'number' && typeof edge.customMidY === 'number') {
      const mx = edge.customMidX;
      const my = edge.customMidY;
      const cp1x = x1 + (mx - x1) * 0.55;
      const cp2x = mx - (mx - x1) * 0.25;
      const cp3x = mx + (endX - mx) * 0.25;
      const cp4x = endX - (endX - mx) * 0.55;
      return `M ${x1} ${y1} ` +
             `C ${cp1x} ${y1}, ${cp2x} ${my}, ${mx} ${my} ` +
             `C ${cp3x} ${my}, ${cp4x} ${endY}, ${endX} ${endY}`;
    }

    const dx = endX - x1;
    const dy = endY - y1;

    // Forward routing (target is to the right of source)
    if (endX >= x1) {
      const cp = Math.max(35, Math.min(dx * 0.55, 180));
      return `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${endX - cp} ${endY}, ${endX} ${endY}`;
    }

    // Backward routing (target is behind source or loopback)
    const loopDist = Math.max(50, Math.min(100, Math.abs(x1 - endX) * 0.3 + 35));
    let midY;
    if (Math.abs(dy) < 80) {
      midY = endY >= y1 ? (Math.max(y1, endY) + 70) : (Math.min(y1, endY) - 70);
    } else {
      midY = (y1 + endY) * 0.5;
    }

    return `M ${x1} ${y1} ` +
           `C ${x1 + loopDist} ${y1}, ${x1 + loopDist} ${midY}, ${(x1 + endX) * 0.5} ${midY} ` +
           `C ${endX - loopDist} ${midY}, ${endX - loopDist} ${endY}, ${endX} ${endY}`;
  }

  calculateOrthogonalPath(x1, y1, x2, y2, edge = null) {
    const endX = x2 - 4;
    const endY = y2;
    const dx = endX - x1;
    const dy = endY - y1;

    // Forward routing (target is to the right)
    if (endX >= x1 + 24) {
      if (Math.abs(dy) < 2) {
        return `M ${x1} ${y1} L ${endX} ${endY}`;
      }

      let midX = (edge && typeof edge.customMidX === 'number') ? edge.customMidX : (x1 + dx * 0.5);
      midX = Math.max(x1 + 10, Math.min(endX - 10, midX));

      const r = Math.min(10, Math.abs(midX - x1) * 0.5, Math.abs(endX - midX) * 0.5, Math.abs(dy) * 0.5);
      const dirY = dy > 0 ? 1 : -1;
      const sweep1 = dy > 0 ? 1 : 0;
      const sweep2 = dy > 0 ? 0 : 1;

      return `M ${x1} ${y1} ` +
             `L ${midX - r} ${y1} ` +
             `A ${r} ${r} 0 0 ${sweep1} ${midX} ${y1 + r * dirY} ` +
             `L ${midX} ${endY - r * dirY} ` +
             `A ${r} ${r} 0 0 ${sweep2} ${midX + r} ${endY} ` +
             `L ${endX} ${endY}`;
    }

    // Backward routing (target is to the left or overlapping)
    const p1x = x1 + 30;
    const p2x = endX - 30;
    let midY;
    if (edge && typeof edge.customMidY === 'number') {
      midY = edge.customMidY;
    } else if (Math.abs(dy) < 80) {
      midY = endY >= y1 ? (Math.max(y1, endY) + 70) : (Math.min(y1, endY) - 70);
    } else {
      midY = (y1 + endY) * 0.5;
    }

    const r = 8;
    const s1 = midY > y1 ? 1 : 0;
    const s2 = midY > y1 ? 1 : 0;
    const s3 = endY > midY ? 0 : 1;
    const s4 = endY > midY ? 0 : 1;

    return `M ${x1} ${y1} ` +
           `L ${p1x - r} ${y1} ` +
           `A ${r} ${r} 0 0 ${s1} ${p1x} ${y1 + (midY > y1 ? r : -r)} ` +
           `L ${p1x} ${midY - (midY > y1 ? r : -r)} ` +
           `A ${r} ${r} 0 0 ${s2} ${p1x - r} ${midY} ` +
           `L ${p2x + r} ${midY} ` +
           `A ${r} ${r} 0 0 ${s3} ${p2x} ${midY + (endY > midY ? r : -r)} ` +
           `L ${p2x} ${endY - (endY > midY ? r : -r)} ` +
           `A ${r} ${r} 0 0 ${s4} ${p2x + r} ${endY} ` +
           `L ${endX} ${endY}`;
  }

  setNodeHighlight(nodeId, state = 'active') {
    // state: 'active' | 'success' | 'error' | 'clear'
    const el = document.getElementById(nodeId);
    if (!el) return;

    el.classList.remove('state-running', 'state-success', 'state-error');
    if (state === 'active') el.classList.add('state-running');
    if (state === 'success') el.classList.add('state-success');
    if (state === 'error') el.classList.add('state-error');
  }

  clearHighlights() {
    this.nodesLayerEl.querySelectorAll('.mory-canvas-node').forEach(el => {
      el.classList.remove('state-running', 'state-success', 'state-error');
    });
  }

  autoLayout() {
    // Organize nodes sequentially from left to right
    let startX = 60;
    let startY = 80;
    const spacingX = 300;
    const spacingY = 160;

    let index = 0;
    for (const [id, node] of this.nodes) {
      node.x = startX + (index % 4) * spacingX;
      node.y = startY + Math.floor(index / 4) * spacingY;
      const el = document.getElementById(id);
      if (el) {
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
      }
      index++;
    }
    this.renderEdges();
  }

  clear() {
    this.nodes.clear();
    this.edges = [];
    this.nodesLayerEl.innerHTML = '';
    this.edgesLayerEl.innerHTML = '';
    this.onChange();
  }

  exportData() {
    return {
      version: '1.0.0',
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }

  importData(data) {
    this.clear();
    if (!data || !Array.isArray(data.nodes)) return;

    for (const n of data.nodes) {
      this.addNode(n.type, n.x, n.y, n.config, n.id, n.name);
    }

    if (Array.isArray(data.edges)) {
      this.edges = [...data.edges];
      this.renderEdges();
    }

    this.onChange();
  }
}
