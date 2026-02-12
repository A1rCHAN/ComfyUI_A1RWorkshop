// ========== NodeCollector - 新版前端 (适配 ComfyUI Nodes 2.0) ==========

import { ComfyThemeAdapter } from "../adapter.js";
import { custom, ui } from "../style.js";
import { app } from "/scripts/app.js";

// ========== 全局状态 ==========

let activeNodeCollector = null;

window.A1rNodeCollectorBlacklist = window.A1rNodeCollectorBlacklist || [];

function isNodeBlacklisted(node) {
  const list = window.A1rNodeCollectorBlacklist;
  if (!Array.isArray(list) || list.length === 0) return false;
  const names = [node.type, node.title, node.comfyClass].filter(Boolean);
  return names.some((n) => list.includes(n));
}

// ========== 辅助函数 ==========

function setReadOnly(node, readOnly) {
  if (!node.collectedNodes) return;
  let needsUpdate = false;

  node.collectedNodes.forEach((collection) => {
    const toggleWidget = collection.toggleWidget;
    if (!toggleWidget) return;

    // 标记+禁用
    toggleWidget.disabled = !!readOnly;
    toggleWidget._isReadOnly = !!readOnly;
    // Vue响应式
    toggleWidget.options = JSON.parse(JSON.stringify({
      ...(toggleWidget.options || {}),
      disabled: !!readOnly
    }));
    needsUpdate = true;

    // DOM禁用（针对DOM widget）
    if (toggleWidget.element) {
      toggleWidget.element.dataset.readonly = readOnly ? "true" : "false";
      toggleWidget.element.querySelectorAll("input, select, textarea, button, [role='button'], .combo-box").forEach((ctrl) => {
        ctrl.disabled = readOnly;
        ctrl.style.opacity = readOnly ? "0.55" : "1";
      });
      toggleWidget.element.style.opacity = readOnly ? "0.55" : "1";
      toggleWidget.element.style.pointerEvents = readOnly ? "none" : "auto";
    }

    // 回调触发Vue更新
    if (toggleWidget.callback) {
      toggleWidget.callback(toggleWidget.value);
    }
  });

  // 响应式触发（适配Nodes 2.0）
  if (needsUpdate && node.widgets) {
    node.widgets.splice(0, 0);
    node.widgets.splice(0, 0);

    if (node.onResize) node.onResize();
    if (node.update && typeof node.update === "function") node.update();
  }
  app.graph.setDirtyCanvas(true);
}

/**
 * 激活收集模式, 只读并禁止交互
 */
function activate(node) {
  if (activeNodeCollector && activeNodeCollector !== node) {
    deactivate(activeNodeCollector);
  }
  activeNodeCollector = node;
  node.isActive = true;
  node.properties = node.properties || {};
  node.properties._isActive = true;
  setReadOnly(node, true);
  app.graph.setDirtyCanvas(true);
}

/**
 * 停用收集模式, 恢复交互
 */
function deactivate(node) {
  if (activeNodeCollector === node) {
    activeNodeCollector = null;
  }
  node.isActive = false;
  node.properties = node.properties || {};
  node.properties._isActive = false;
  setReadOnly(node, false);
  app.graph.setDirtyCanvas(true);
}

function updateButtonState(node) {
  const state = {
    contentText: node.contentText,
    buttonVisible: node.buttonVisible !== false, // 按钮是否显示
    menuText: node.menuText,
  };
  node.widgetState = state;
  node.properties = node.properties || {};
  node.properties._widgetState = state;
  if (node.graph) {
    node.graph.setDirtyCanvas(true);
  }
}

/**
 * 更新收集容器的高度和显示状态
 */
function updateCollectorContainer(node) {
  if (!node.collectorContainer) return;
  
  const hasWidgets = node.collectedNodes && node.collectedNodes.size > 0;
  
  if (hasWidgets) {
    node.collectorContainer.style.display = "block";
    // 高度由内容撑开，不设置固定高度
    node.collectorContainer.style.height = "auto";
  } else {
    // 没有部件时隐藏容器，不占高度
    node.collectorContainer.style.display = "none";
    node.collectorContainer.style.height = "0px";
  }
  
  app.graph.setDirtyCanvas(true);
}

/**
 * 快照当前收集器状态到 node.properties（供序列化持久化）
 */
function snapshotCollectorProperties(node) {
  node.properties = node.properties || {};

  // 按 widgets 顺序保存，以保留排序
  const collectedData = [];
  if (node.widgets && node.collectedNodes) {
    node.widgets.forEach((widget) => {
      node.collectedNodes.forEach((collection) => {
        if (collection.toggleWidget === widget) {
          collectedData.push({
            targetNodeId: collection.targetNode.id,
            value: widget.value,
            disabledMode: collection.disabledMode || node.defaultDisabledMode || 4
          });
        }
      });
    });
  }
  node.properties._collected_nodes = collectedData;
  node.properties._isActive = !!node.isActive;
  node.properties._defaultDisabledMode = node.defaultDisabledMode || 4;
}

/**
 * 从持久化数据恢复收集器的完整状态
 */
function restoreCollectorState(node, data) {
  if (!data) return;
  if (node._isRestoring) return;
  node._isRestoring = true;

  // 恢复按钮状态
  const savedState = data._widgetState;
  if (savedState) {
    node.widgetState = savedState;
    node.contentText = savedState.contentText || "Open Collector";
    node.buttonVisible = savedState.buttonVisible !== false;
    node.menuText = savedState.menuText || "Hide Switch";

    setTimeout(() => {
      if (node.controlBtn) {
        const themeAdapter = new ComfyThemeAdapter();
        const t = themeAdapter.theme;
        node.controlBtn.textContent = node.contentText;
        node.controlBtn.style.outline =
          node.contentText === "Done Collecting" ? `1px solid ${t.prompt}` : "none";
        themeAdapter.destroy();
      }
      // 恢复按钮显示状态
      if (node.buttonContainer) {
        node.buttonContainer.style.display = node.buttonVisible !== false ? "flex" : "none";
      }
      updateCollectorContainer(node);
      if (node.graph) {
        node.graph.setDirtyCanvas(true);
      }
    }, 100);
  }

  // 恢复默认禁用模式
  if (data._defaultDisabledMode !== undefined) {
    node.defaultDisabledMode = data._defaultDisabledMode;
  }

  // 恢复激活状态
  if (data._isActive) {
    node.isActive = true;
    activeNodeCollector = node;
  }

  // 恢复已收集节点
  const collectedData = data._collected_nodes;
  if (collectedData && collectedData.length > 0) {
    clearAllNodes(node);

    setTimeout(() => {
      collectedData.forEach((saved) => {
        const targetNode = app.graph.getNodeById(saved.targetNodeId);
        if (!targetNode) return;

        addNodeToPanel(node, targetNode, saved.value, saved.disabledMode);

        // 恢复保存的值
        node.collectedNodes.forEach((collection) => {
          if (collection.targetNode === targetNode) {
            if (saved.value !== undefined) {
              collection.toggleWidget.value = saved.value;
              // 触发 Vue reactive trigger 以刷新 Nodes 2.0 UI
              if (collection.toggleWidget.callback) {
                collection.toggleWidget.callback(saved.value);
              }
              // 应用节点模式
              if (!node.isActive) {
                updateNodeMode(node, collection);
              }
            }
          }
        });
      });

      // 更新容器显示状态
      updateCollectorContainer(node);

      // 所有镜像创建完毕后，延迟应用只读状态（确保 DOM 已挂载）
      if (data._isActive) {
        setTimeout(() => setReadOnly(node, true), 200);
      }
      node._isRestoring = false;
    }, 300);
  } else {
    setTimeout(() => { node._isRestoring = false; }, 200);
  }
}

// ========== 节点模式控制 ==========

function updateNodeMode(node, collection) {
  if (!collection || !collection.targetNode) return;

  const isEnabled = Boolean(collection.toggleWidget?.value);

  if (isEnabled) {
    collection.targetNode.mode = 0; // 正常模式
  } else {
    const disabledMode = collection.disabledMode || node.defaultDisabledMode || 4;
    collection.targetNode.mode = disabledMode; // 2=Mute, 4=Bypass
  }

  app.graph.setDirtyCanvas(true);
}

function updateAllNodeModes(node) {
  node.collectedNodes.forEach((collection) => {
    updateNodeMode(node, collection);
  });
}

function restoreAllNodeModes(node) {
  node.collectedNodes.forEach((collection) => {
    if (collection.targetNode) {
      collection.targetNode.mode = 0;
    }
  });
}

// ========== 镜像部件（通过 ui 封装调用官方 addWidget API）==========

function createToggleWidget(node, targetNode, widgetId, initialValue = true, disabledMode = 4) {
  const nodeName = targetNode.title || targetNode.type;
  const fullName = `${nodeName}`;

  let _syncing = false;
  let widget;

  // 同步回调：toggle → 节点模式
  const syncToTarget = (value) => {
    if (_syncing) return;

    // 只读模式拦截
    if (node.isActive || node.properties?._isActive || widget?._isReadOnly) {
      if (widget) {
        _syncing = true;
        const currentCollection = node.collectedNodes.get(String(targetNode.id));
        const lastValue = currentCollection?.lastValidValue !== undefined ? currentCollection.lastValidValue : initialValue;
        widget.value = lastValue;
        _syncing = false;
      }
      return;
    }

    _syncing = true;
    try {
      // 从 node.collectedNodes 获取当前 collection
      const currentCollection = node.collectedNodes.get(String(targetNode.id));
      if (currentCollection) {
        currentCollection.lastValidValue = value; // 保存有效值
        updateNodeMode(node, currentCollection);
        snapshotCollectorProperties(node);
      }
      app.graph.setDirtyCanvas(true);
    } finally {
      _syncing = false;
    }
  };

  // 使用 ui.addAuto 创建 toggle widget（Nodes 2.0 boolean开关）
  const widgetInfo = {
    name: fullName,
    type: "toggle",
    value: initialValue,
    options: {
      component: "WidgetToggle",
      widget_type: "toggle"
    }
  };

  widget = ui.addAuto(node, widgetId, widgetInfo, syncToTarget);
  widget.label = fullName;
  widget._fullName = fullName;

  // 初始禁用状态
  const isActive = !!node.isActive || !!node.properties?._isActive;
  if (isActive) {
    if (!node.isActive) {
      node.isActive = true;
      activeNodeCollector = node;
    }
    widget._isReadOnly = true;
  }

  // 监听目标节点名称变化
  setupNodeNameWatcher(node, targetNode, widget);

  return widget;
}

function setupNodeNameWatcher(node, targetNode, toggleWidget) {
  const originalOnPropertyChanged = targetNode.onPropertyChanged;

  targetNode.onPropertyChanged = function(property, value) {
    if (originalOnPropertyChanged) {
      originalOnPropertyChanged.call(this, property, value);
    }

    if (property === "title" && toggleWidget) {
      const newName = `${value || targetNode.type}`;
      toggleWidget._fullName = newName;
      // 在 Nodes 2.0 中，widget.name 通常是内部标识，显示文本由 label 或 _fullName 控制
      if (toggleWidget.label !== undefined) {
        toggleWidget.label = newName;
      }
      app.graph.setDirtyCanvas(true);
    }
  };
}

// ========== 面板操作 ==========

function addNodeToPanel(node, targetNode, initialValue = true, disabledMode = null) {
  const nodeId = String(targetNode.id);
  const widgetId = `node_${targetNode.id}_${Date.now()}`;

  cleanupInvalidNodes(node);

  // 防止重复添加
  if (node.collectedNodes.has(nodeId)) {
    return;
  }

  const toggleWidget = createToggleWidget(
    node, 
    targetNode, 
    widgetId, 
    initialValue, 
    disabledMode || node.defaultDisabledMode || 4
  );

  if (toggleWidget) {
    const collection = {
      targetNode: targetNode,
      toggleWidget: toggleWidget,
      disabledMode: disabledMode || node.defaultDisabledMode || 4,
      nodeId: nodeId,
      widgetId: widgetId,
      lastValidValue: initialValue
    };
    
    node.collectedNodes.set(nodeId, collection);

    // 将 widget 的 DOM 元素移动到收集容器中（如果是 DOM widget）
    if (toggleWidget.element && node.collectorContainer) {
      // 注意：ui.addAuto 创建的 widget 可能已经被添加到节点的 dom 中
      // 我们需要将其移动到 collectorContainer
      setTimeout(() => {
        if (toggleWidget.element && toggleWidget.element.parentNode !== node.collectorContainer) {
          node.collectorContainer.appendChild(toggleWidget.element);
        }
      }, 0);
    }

    if (node.isActive) {
      setReadOnly(node, true);
    }

    // 初始应用节点模式
    if (!node.isActive) {
      updateNodeMode(node, collection);
    }

    // 更新容器显示状态
    updateCollectorContainer(node);

    snapshotCollectorProperties(node);
    app.graph.setDirtyCanvas(true);
  }
}

function removeNodeFromPanel(node, nodeId) {
  const collection = node.collectedNodes.get(nodeId);
  if (!collection) return;

  // 恢复节点为正常模式
  if (collection.targetNode) {
    collection.targetNode.mode = 0;
  }

  // 移除 widget
  if (collection.toggleWidget) {
    // 如果是 DOM widget，从容器中移除
    if (collection.toggleWidget.element && collection.toggleWidget.element.parentNode) {
      collection.toggleWidget.element.parentNode.removeChild(collection.toggleWidget.element);
    }
    
    const idx = node.widgets.indexOf(collection.toggleWidget);
    if (idx !== -1) {
      node.widgets.splice(idx, 1);
    }
  }

  node.collectedNodes.delete(nodeId);
  
  // 更新容器显示状态
  updateCollectorContainer(node);
  
  snapshotCollectorProperties(node);
  app.graph.setDirtyCanvas(true);
}

function clearAllNodes(node) {
  const ids = Array.from(node.collectedNodes.keys());
  ids.forEach((id) => removeNodeFromPanel(node, id));
  snapshotCollectorProperties(node);
}

function cleanupInvalidNodes(node) {
  if (!node.collectedNodes) return;
  const invalidIds = [];
  const existingNodes = new Set(app.graph._nodes || []);

  node.collectedNodes.forEach((collection, nodeId) => {
    if (!existingNodes.has(collection.targetNode)) {
      invalidIds.push(nodeId);
    }
  });

  invalidIds.forEach((id) => removeNodeFromPanel(node, id));
}

// ========== 按钮部件 ==========

function createButtonWidget(node) {
  const adapter = new ComfyThemeAdapter();
  let theme = adapter.theme;

  // 创建按钮容器（独立容器）
  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.flexDirection = "column";
  buttonContainer.style.width = "100%";
  buttonContainer.style.marginBottom = "4px"; // 按钮和收集容器之间的间距
  
  node.contentText = node.widgetState?.contentText || "Open Collector";
  node.buttonVisible = node.widgetState?.buttonVisible !== false;
  node.menuText = node.widgetState?.menuText || "Hide Switch";

  const controlBtn = custom.button(node.contentText, theme);
  custom.buttonHover(controlBtn, theme);
  buttonContainer.appendChild(controlBtn);
  node.controlBtn = controlBtn;

  if (node.contentText === "Done Collecting") {
    controlBtn.style.outline = `1px solid ${theme.prompt}`;
  } else {
    controlBtn.style.outline = "none";
  }

  controlBtn.addEventListener("click", () => {
    node.contentText =
      node.contentText === "Open Collector" ? "Done Collecting" : "Open Collector";
    controlBtn.textContent = node.contentText;
    if (node.contentText === "Done Collecting") {
      controlBtn.style.outline = `1px solid ${theme.prompt}`;
      activate(node);
    } else {
      controlBtn.style.outline = "none";
      deactivate(node);
    }
    updateButtonState(node);
  });

  adapter.bindElement(controlBtn, { background: "background", color: "text" });
  adapter.onThemeChange((newTheme) => {
    theme = newTheme;
    node.controlBtn.style.background = theme.background;
    node.controlBtn.style.color = theme.text;
    if (node.contentText === "Done Collecting") {
      controlBtn.style.outline = `1px solid ${theme.prompt}`;
    }
  });

  // 按钮作为独立 widget
  const buttonWidget = node.addDOMWidget("switch_button", "SWITCH_BUTTON", buttonContainer, {
    serialize: false,
    hideOnZoom: false,
  });

  buttonWidget.computeSize = function (width) {
    return [width, 34];
  };

  buttonWidget.onRemove = function () {
    adapter.destroy();
  };

  node.buttonContainer = buttonContainer;
  node.buttonWidget = buttonWidget;

  return buttonWidget;
}

// ========== 收集容器部件 ==========

function createCollectorContainerWidget(node) {
  // 创建收集容器（独立容器，初始不占高度）
  const collectorContainer = document.createElement("div");
  collectorContainer.style.display = "none"; // 初始隐藏
  collectorContainer.style.height = "0px";
  collectorContainer.style.width = "100%";
  collectorContainer.style.overflow = "visible";
  collectorContainer.style.display = "flex";
  collectorContainer.style.flexDirection = "column";
  collectorContainer.style.gap = "2px"; // 部件之间的固定间距，避免动态变化
  
  // 收集容器作为独立 widget
  const containerWidget = node.addDOMWidget("collector_container", "COLLECTOR_CONTAINER", collectorContainer, {
    serialize: false,
    hideOnZoom: false,
  });

  // 动态计算大小：高度由内容撑开
  containerWidget.computeSize = function (width) {
    // 如果没有子元素，高度为0
    if (collectorContainer.children.length === 0 || collectorContainer.style.display === "none") {
      return [width, 0];
    }
    // 否则让容器自然撑开，返回一个基础高度，实际高度由DOM决定
    const totalHeight = Array.from(collectorContainer.children).reduce((sum, child) => {
      return sum + (child.offsetHeight || 24) + 2; // 2px gap
    }, 0);
    return [width, Math.max(totalHeight, 0)];
  };

  containerWidget.onRemove = function () {
    // 清理时恢复所有节点模式
    restoreAllNodeModes(node);
  };

  node.collectorContainer = collectorContainer;
  node.collectorContainerWidget = containerWidget;

  return containerWidget;
}

// ========== 注册扩展 ==========

app.registerExtension({
  name: "a1rworkshop.nodecollector",

  async nodeCreated(node) {
    if (node.comfyClass !== "NodeCollector") return;

    node.properties = node.properties || {};
    node.collectedNodes = new Map();
    node.isActive = false;
    node._isRestoring = false;
    node.defaultDisabledMode = 4; // 默认 Bypass 模式 (4)，可选 Mute (2)

    // 创建两个独立容器：按钮容器 + 收集容器
    createButtonWidget(node);
    createCollectorContainerWidget(node);

    // ----- 序列化 -----
    const originalOnSerialize = node.onSerialize;
    node.onSerialize = function (o) {
      if (originalOnSerialize) {
        originalOnSerialize.apply(this, arguments);
      };

      // 快照当前状态到 properties
      updateButtonState(this);
      snapshotCollectorProperties(this);

      // LiteGraph 在调用 onSerialize 之前已浅拷贝 properties，
      // 必须直接写入 o.properties
      if (!o.properties) o.properties = {};
      if (this.properties) {
        o.properties._collected_nodes = this.properties._collected_nodes;
        o.properties._isActive = this.properties._isActive;
        o.properties._widgetState = this.properties._widgetState;
        o.properties._defaultDisabledMode = this.properties._defaultDisabledMode;
      }
    };

    // ----- 反序列化（用于 undo/redo 等后续 configure 调用）-----
    const originalOnConfigure = node.onConfigure;
    node.onConfigure = function (info) {
      if (originalOnConfigure) {
        originalOnConfigure.apply(this, arguments);
      };

      if (this.collectedNodes && this.properties) {
        restoreCollectorState(this, this.properties);
      }
    };

    // ----- 首次加载恢复 -----
    const props = node.properties;
    if (
      props &&
      ((props._collected_nodes && props._collected_nodes.length > 0) ||
        props._widgetState ||
        props._isActive !== undefined)
    ) {
      restoreCollectorState(node, props);
    }

    // ----- 节点级兜底：持续从 properties._isActive 自修复 node.isActive -----
    let _settleCount = 0;
    const _settleInterval = setInterval(() => {
      _settleCount++;
      if (_settleCount > 50) {
        clearInterval(_settleInterval);
        return;
      }

      // 从持久化属性同步 isActive 标志
      if (node.properties?._isActive && !node.isActive) {
        node.isActive = true;
        activeNodeCollector = node;
        setReadOnly(node, true);
      }

      // 如果有已收集节点但尚未恢复，触发恢复
      if (
        node.properties?._collected_nodes?.length > 0 &&
        node.collectedNodes?.size === 0 &&
        !node._isRestoring
      ) {
        restoreCollectorState(node, node.properties);
      }
    }, 200);
  },

  // ----- 右键菜单 -----
  getNodeMenuItems(node) {
    // === Node Collector 节点自身菜单 ===
    if (node.comfyClass === "NodeCollector") {
      cleanupInvalidNodes(node);

      const items = [];

      // 隐藏/显示开关按钮
      if (!node.menuText) node.menuText = "Hide Switch";
      items.push({
        content: node.menuText,
        callback: () => {
          const btn = node.controlBtn;
          const buttonContainer = node.buttonContainer;
          
          if (buttonContainer.style.display === "none") {
            buttonContainer.style.display = "flex";
            node.menuText = "Hide Switch";
            node.buttonVisible = true;
          } else {
            btn.textContent = "Open Collector";
            btn.style.outline = "none";
            node.contentText = "Open Collector";
            buttonContainer.style.display = "none";
            node.menuText = "Show Switch";
            node.buttonVisible = false;
            deactivate(node);
          }
          updateButtonState(node);
          if (node.onResize) node.onResize();
        },
      });

      // 默认禁用模式设置
      items.push(null);
      items.push({
        content: "Default Disabled Mode",
        has_submenu: true,
        submenu: {
          options: [
            {
              content: `${node.defaultDisabledMode === 2 ? "✓ " : "　"}Mute (Skip execution)`,
              callback: () => {
                node.defaultDisabledMode = 2;
                // 更新所有已收集节点的禁用模式
                node.collectedNodes.forEach((collection) => {
                  collection.disabledMode = 2;
                  if (!node.isActive && !collection.toggleWidget.value) {
                    updateNodeMode(node, collection);
                  }
                });
                app.graph.setDirtyCanvas(true);
              }
            },
            {
              content: `${node.defaultDisabledMode === 4 ? "✓ " : "　"}Bypass (Pass through)`,
              callback: () => {
                node.defaultDisabledMode = 4;
                node.collectedNodes.forEach((collection) => {
                  collection.disabledMode = 4;
                  if (!node.isActive && !collection.toggleWidget.value) {
                    updateNodeMode(node, collection);
                  }
                });
                app.graph.setDirtyCanvas(true);
              }
            },
            null,
            {
              content: "ℹ️ Mode Explanation",
              disabled: true
            },
            {
              content: "• Mute: Skip execution, no output",
              disabled: true
            },
            {
              content: "• Bypass: Direct input → output",
              disabled: true
            }
          ]
        }
      });

      // 重新排序
      if (node.collectedNodes && node.collectedNodes.size > 1) {
        const toggleWidgets = [];
        node.widgets.forEach((w, idx) => {
          node.collectedNodes.forEach((col) => {
            if (col.toggleWidget === w) {
              toggleWidgets.push({ widget: w, collection: col, index: idx });
            }
          });
        });

        if (toggleWidgets.length > 1) {
          const reorderOptions = toggleWidgets.map((item) => {
            const displayName = item.collection.toggleWidget._fullName || `${item.collection.targetNode.title || item.collection.targetNode.type}`;
            return {
              content: displayName,
              has_submenu: true,
              submenu: {
                options: [
                  {
                    content: "Move Up",
                    disabled: item.index === 0,
                    callback: () => {
                      const i = node.widgets.indexOf(item.widget);
                      if (i > 0) {
                        [node.widgets[i], node.widgets[i - 1]] = [
                          node.widgets[i - 1],
                          node.widgets[i],
                        ];
                        // 同时移动 DOM 元素
                        if (item.widget.element && item.widget.element.parentNode === node.collectorContainer) {
                          const prevWidget = node.widgets[i - 1];
                          if (prevWidget && prevWidget.element) {
                            node.collectorContainer.insertBefore(item.widget.element, prevWidget.element);
                          }
                        }
                        app.graph.setDirtyCanvas(true);
                      }
                    },
                  },
                  {
                    content: "Move Down",
                    disabled: item.index === node.widgets.length - 1,
                    callback: () => {
                      const i = node.widgets.indexOf(item.widget);
                      if (i < node.widgets.length - 1) {
                        [node.widgets[i], node.widgets[i + 1]] = [
                          node.widgets[i + 1],
                          node.widgets[i],
                        ];
                        // 同时移动 DOM 元素
                        if (item.widget.element && item.widget.element.parentNode === node.collectorContainer) {
                          const nextWidget = node.widgets[i + 1];
                          if (nextWidget && nextWidget.element) {
                            node.collectorContainer.insertBefore(nextWidget.element, item.widget.element);
                          }
                        }
                        app.graph.setDirtyCanvas(true);
                      }
                    },
                  },
                  {
                    content: "Move to Top",
                    disabled: item.index === 0,
                    callback: () => {
                      const i = node.widgets.indexOf(item.widget);
                      if (i > 0) {
                        node.widgets.splice(i, 1);
                        node.widgets.unshift(item.widget);
                        // 同时移动 DOM 元素到顶部
                        if (item.widget.element && item.widget.element.parentNode === node.collectorContainer) {
                          node.collectorContainer.insertBefore(item.widget.element, node.collectorContainer.firstChild);
                        }
                        app.graph.setDirtyCanvas(true);
                      }
                    },
                  },
                  {
                    content: "Move to Bottom",
                    disabled: item.index === node.widgets.length - 1,
                    callback: () => {
                      const i = node.widgets.indexOf(item.widget);
                      if (i < node.widgets.length - 1) {
                        node.widgets.splice(i, 1);
                        node.widgets.push(item.widget);
                        // 同时移动 DOM 元素到底部
                        if (item.widget.element && item.widget.element.parentNode === node.collectorContainer) {
                          node.collectorContainer.appendChild(item.widget.element);
                        }
                        app.graph.setDirtyCanvas(true);
                      }
                    },
                  },
                ],
              },
            };
          });

          items.push({
            content: "Reorder Nodes",
            has_submenu: true,
            submenu: { options: reorderOptions },
          });
        }
      }

      // 移除/清空已收集节点
      if (node.collectedNodes && node.collectedNodes.size > 0) {
        items.push(null);

        const removeOptions = [];
        node.collectedNodes.forEach((collection, nodeId) => {
          const displayName = collection.toggleWidget._fullName || `${collection.targetNode.title || collection.targetNode.type}`;
          removeOptions.push({
            content: displayName,
            callback: () => removeNodeFromPanel(node, nodeId),
          });
        });

        items.push({
          content: "Remove Node",
          has_submenu: true,
          submenu: { options: removeOptions },
        });

        items.push({
          content: "Clear All Nodes",
          callback: () => clearAllNodes(node),
        });
      }

      return items;
    }

    // === 其他节点："Add Node to Panel" 菜单 ===
    if (!activeNodeCollector) return [];
    if (node.comfyClass === "NodeCollector") return [];
    if (isNodeBlacklisted(node)) return [];

    const isAlreadyAdded = activeNodeCollector.collectedNodes.has(String(node.id));

    return [
      null,
      {
        content: isAlreadyAdded ? "✓ Added to Node Panel" : "Add Node to Panel",
        disabled: isAlreadyAdded,
        callback: () => {
          if (activeNodeCollector && !isAlreadyAdded) {
            addNodeToPanel(activeNodeCollector, node);
          }
        },
      },
    ];
  },
});