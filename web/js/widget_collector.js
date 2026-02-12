import { ComfyThemeAdapter } from "../adapter.js";
import { custom, ui } from "../style.js";
import { app } from "/scripts/app.js";

// ========== 全局状态 ==========

let activeCollector = null;

window.A1rWidgetCollectorBlacklist = window.A1rWidgetCollectorBlacklist || [];

function isNodeBlacklisted(node) {
  const list = window.A1rWidgetCollectorBlacklist;
  if (!Array.isArray(list) || list.length === 0) return false;
  const names = [node.type, node.title, node.comfyClass].filter(Boolean);
  return names.some((n) => list.includes(n));
}

// ========== 辅助函数 ==========

function setReadOnly(node, readOnly) {
  if (!node.collectedWidgets) return;
  let needsUpdate = false;

  node.collectedWidgets.forEach((collection) => {
    const mirrorWidget = collection.mirrorWidget;
    if (!mirrorWidget) return;

    // 标记+禁用
    mirrorWidget.disabled = !!readOnly;
    mirrorWidget._isReadOnly = !!readOnly;
    // Vue响应式
    mirrorWidget.options = JSON.parse(JSON.stringify({
      ...(mirrorWidget.options || {}),
      disabled: !!readOnly
    }));
    needsUpdate = true;

    // DOM禁用
    if (mirrorWidget.element) {
      mirrorWidget.element.dataset.readonly = readOnly ? "true" : "false";
      mirrorWidget.element.querySelectorAll("input, select, textarea, button, [role='button'], .combo-box").forEach((ctrl) => {
        ctrl.disabled = readOnly;
        ctrl.style.opacity = readOnly ? "0.55" : "1";
        
      });
      mirrorWidget.element.style.opacity = readOnly ? "0.55" : "1";
      mirrorWidget.element.style.pointerEvents = readOnly ? "none" : "auto"
    };

    // 回调
    if (mirrorWidget.callback) {
      mirrorWidget.callback(mirrorWidget.value)
    }
  });

  // 响应式触发（适配Nodes 2.0）
  if (needsUpdate && node.widgets) {
    node.widgets.splice(0, 0);
    node.widgets.splice(0, 0);

    if (node.onResize) node.onResize();
    if (node.update && typeof node.update === "function") node.update()
  };
  app.graph.setDirtyCanvas(true)
};

/**
 * 激活收集模式, 只读并禁止交互
 */
function activate(node) {
  if (activeCollector && activeCollector !== node) {
    deactivate(activeCollector);
  }
  activeCollector = node;
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
  if (activeCollector === node) {
    activeCollector = null;
  }
  node.isActive = false;
  node.properties = node.properties || {};
  node.properties._isActive = false;
  setReadOnly(node, false);
  app.graph.setDirtyCanvas(true);
}

function getWidgetInfo(widget) {
  const rawType = widget.type || "text";
  const node2Options = {
    ...widget.options,
    component: rawType === "slider" ? "WidgetInputSlider" : undefined,
    isSlider: rawType === "slider",
    widget_type: rawType === "slider" ? "slider" : "number"
  };
  
  return {
    name: widget.name,
    type: rawType,
    value: widget.value,
    options: node2Options,
    component: rawType === "slider" ? "WidgetInputSlider" : undefined
  };
}

function updateButtonState(node) {
  const state = {
    contentText: node.contentText,
    widgetDisplay: node.collectorWidget?.element?.style.display || "flex",
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
 * 快照当前收集器状态到 node.properties（供序列化持久化）
 */
function snapshotCollectorProperties(node) {
  node.properties = node.properties || {};

  // 按 widgets 顺序保存，以保留排序
  const collectedData = [];
  if (node.widgets && node.collectedWidgets) {
    node.widgets.forEach((widget) => {
      node.collectedWidgets.forEach((collection) => {
        if (collection.mirrorWidget === widget) {
          collectedData.push({
            targetNodeId: collection.targetNode.id,
            widgetName: collection.targetWidget.name,
            value: widget.value,
          });
        }
      });
    });
  }
  node.properties._collected_widgets = collectedData;
  node.properties._isActive = !!node.isActive;
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
    node.widgetDisplay = savedState.widgetDisplay || "flex";
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
      if (node.collectorWidget) {
        node.collectorWidget.element.style.display = node.widgetDisplay || "flex";
      }
      if (node.graph) {
        node.graph.setDirtyCanvas(true);
      }
    }, 100);
  }

  // 恢复激活状态
  // 只设标志位，不调用 activate()，因为此时镜像部件可能尚未创建。
  // setReadOnly 将在镜像部件全部创建后单独调用。
  if (data._isActive) {
    node.isActive = true;
    activeCollector = node;
  }

  // 恢复已收集部件
  const collectedData = data._collected_widgets;
  if (collectedData && collectedData.length > 0) {
    clearAllWidgets(node);

    setTimeout(() => {
      collectedData.forEach((saved) => {
        const targetNode = app.graph.getNodeById(saved.targetNodeId);
        if (!targetNode) return;
        const targetWidget = targetNode.widgets?.find(
          (w) => w.name === saved.widgetName
        );
        if (!targetWidget) return;

        addWidgetToPanel(node, targetNode, targetWidget);

        // 恢复保存的值
        for (const [, collection] of node.collectedWidgets.entries()) {
          if (
            collection.targetWidget === targetWidget &&
            collection.targetNode === targetNode
          ) {
            if (saved.value !== undefined) {
              collection.mirrorWidget.value = saved.value;
              // 触发 Vue reactive trigger 以刷新 Nodes 2.0 UI
              if (collection.mirrorWidget.callback) {
                collection.mirrorWidget.callback(saved.value);
              }
            }
            break;
          }
        }
      });

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

// ========== 镜像部件（通过 ui 封装调用官方 addWidget API）==========

function createMirrorWidget(node, targetNode, targetWidget, widgetInfo, widgetId) {
  const fullName = `${targetNode.title || targetNode.type}.${widgetInfo.name}`;

  let _syncing = false; // 防循环标志
  let widget;           // 提前声明，让 syncToTarget 闭包可引用

  // --- 同步回调：mirror → target ---
  // 只读模式下拦截用户交互，立即恢复为目标当前值。
  // Vue callback chain（useChainCallback）会在 syncToTarget 返回后
  // 继续执行 vueTrigger()，使 UI 重新读取已恢复的 widget.value。
  const syncToTarget = (value) => {
    if (_syncing) return;

    // 只读模式
    if (node.isActive || node.properties?._isActive || widget?._isReadOnly) {
      if (widget) {
        _syncing = true;
        widget.value = targetWidget.value;
        _syncing = false;
      }
      return;
    }

    _syncing = true;
    try {
      targetWidget.value = value;
      if (targetWidget.callback) {
        targetWidget.callback(value);
      }
      if (targetNode.onWidgetChanged) {
        targetNode.onWidgetChanged(targetWidget.name, value, null, targetWidget);
      }
      snapshotCollectorProperties(node);
      app.graph.setDirtyCanvas(true)
    } finally {
      _syncing = false
    }
  };

  // --- 使用 ui.addAuto 自动选择合适的官方控件 ---
  widget = ui.addAuto(node, widgetId, widgetInfo, syncToTarget);
  if (widgetInfo.type === "slider") {
    widget.type = "slider";
    widget.component = "WidgetInputSlider";
    widget.options.component = "WidgetInputSlider"
  }
  widget.label = fullName;

  const isTextarea = widget.element != null; // DOM widget (textarea) 有 element 属性

  // --- 初始禁用状态 ---
  const isActive = !!node.isActive || !!node.properties?._isActive;
  if (isActive) {
    if (!node.isActive) {
      node.isActive = true;
      activeCollector = node;
    }
    widget._isReadOnly = true
  };

  // --- 双向同步：target → mirror + 激活状态自修复 ---
  widget._syncInterval = setInterval(() => {
    try {
      if (widget._isReadOnly) {
        const targetVal = targetWidget.value;
        if (targetVal !== widget.value && !_syncing) {
          _syncing = true;
          widget.value = targetVal;
          if (widget.callback) widget.callback(targetVal);
          _syncing = false;
        }
        return
      };

      // 值同步
      const targetVal = targetWidget.value;
      if (targetVal !== widget.value && !_syncing) {
        _syncing = true;
        widget.value = targetVal;
        // 触发 Vue reactive trigger（Nodes 2.0 需要调 callback 才会刷新 UI）
        if (widget.callback) widget.callback(targetVal);
        _syncing = false;
      }

      // combo 动态选项同步
      if (widget.options?.values !== undefined && targetWidget.options?.values) {
        const srcVals = typeof targetWidget.options.values === "function"
          ? targetWidget.options.values()
          : targetWidget.options.values;
        if (widget.options && srcVals) {
          widget.options.values = srcVals;
        }
      }

      // 激活状态自修复（仅同步 isActive 标志，disabled 状态由 setReadOnly 统一管理）
      const isActive = !!(node.isActive || node.properties?._isActive);
      if (isActive && !node.isActive) {
        node.isActive = true;
        activeCollector = node;
      }

      // DOM widget（多行文本）的只读处理
      if (isTextarea && widget.element && !widget._isReadOnly) {
        const el = widget.element;
        const curReadonly = el.dataset.readonly === "true";
        if (isActive !== curReadonly) {
          el.dataset.readonly = isActive ? "true" : "false";
          el.querySelectorAll("textarea").forEach((ctrl) => {
            ctrl.disabled = isActive;
          });
          el.style.opacity = isActive ? "0.55" : "1";
          el.style.pointerEvents = isActive ? "none" : "auto";
        }
      }
    } catch (_) {
      // 目标部件可能已被移除，静默忽略
    }
  }, 150);

  widget.onRemove = () => {
    if (widget._syncInterval) {
      clearInterval(widget._syncInterval);
      widget._syncInterval = null;
    }
  };

  if (isActive) {
    setReadOnly(node, true)
  };

  return widget;
}

// ========== 面板操作 ==========

function addWidgetToPanel(node, targetNode, targetWidget) {
  const widgetId = `mirror_${targetNode.id}_${targetWidget.name}_${Date.now()}`;

  cleanupInvalidConnections(node);

  // 防止重复添加
  for (const [, collection] of node.collectedWidgets.entries()) {
    if (collection.targetWidget === targetWidget && collection.targetNode === targetNode) {
      return;
    }
  }

  const widgetInfo = getWidgetInfo(targetWidget);
  const mirrorWidget = createMirrorWidget(node, targetNode, targetWidget, widgetInfo, widgetId);

  if (mirrorWidget) {
    node.collectedWidgets.set(widgetId, {
      targetNode,
      targetWidget,
      mirrorWidget,
      widgetInfo,
      widgetId,
    });

    if (node.isActive) {
      setReadOnly(node, true)
    };

    snapshotCollectorProperties(node);
    app.graph.setDirtyCanvas(true);
  }
}

function removeWidgetFromPanel(node, widgetId) {
  const collection = node.collectedWidgets.get(widgetId);
  if (!collection) return;

  if (collection.mirrorWidget) {
    if (collection.mirrorWidget.onRemove) {
      collection.mirrorWidget.onRemove();
    }
    const idx = node.widgets.indexOf(collection.mirrorWidget);
    if (idx !== -1) {
      node.widgets.splice(idx, 1);
    }
  }

  node.collectedWidgets.delete(widgetId);
  snapshotCollectorProperties(node);
  app.graph.setDirtyCanvas(true);
}

function clearAllWidgets(node) {
  const ids = Array.from(node.collectedWidgets.keys());
  ids.forEach((id) => removeWidgetFromPanel(node, id));
  snapshotCollectorProperties(node);
}

function cleanupInvalidConnections(node) {
  if (!node.collectedWidgets) return;
  const invalidIds = [];
  for (const [widgetId, collection] of node.collectedWidgets.entries()) {
    const found = app.graph.getNodeById(collection.targetNode.id);
    if (!found) {
      invalidIds.push(widgetId);
    }
  }
  invalidIds.forEach((id) => removeWidgetFromPanel(node, id));
}

// ========== 按钮部件 ==========

function createButtonWidget(node) {
  const adapter = new ComfyThemeAdapter();
  let theme = adapter.theme;

  const container = custom.container();

  node.contentText = node.widgetState?.contentText || "Open Collector";
  node.widgetDisplay = node.widgetState?.widgetDisplay || "flex";
  node.menuText = node.widgetState?.menuText || "Hide Switch";

  const controlBtn = custom.button(node.contentText, theme);
  custom.buttonHover(controlBtn, theme);
  container.appendChild(controlBtn);
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

  const widget = node.addDOMWidget("switch_button", "SWITCH_BUTTON", container, {
    serialize: false,
    hideOnZoom: false,
  });

  node.collectorWidget = widget;

  widget.computeSize = function (width) {
    return [width, 34];
  };

  widget.onRemove = function () {
    adapter.destroy();
  };

  node.collectorWidget.element.style.display = node.widgetDisplay || "flex";

  return widget;
}

// ========== 注册扩展 ==========

app.registerExtension({
  name: "a1rworkshop.widgetcollector",

  async nodeCreated(node) {
    if (node.comfyClass !== "WidgetCollector") return;

    node.properties = node.properties || {};
    node.collectedWidgets = new Map();
    node.isActive = false;
    node._isRestoring = false;

    createButtonWidget(node);

    // ----- 序列化 -----
    const originalOnSerialize = node.onSerialize;
    node.onSerialize = function (o) {
      if (originalOnSerialize) {
        originalOnSerialize.apply(this, arguments);
      }

      // 快照当前状态到 properties
      updateButtonState(this);
      snapshotCollectorProperties(this);

      // LiteGraph 在调用 onSerialize 之前已浅拷贝 properties，
      // 必须直接写入 o.properties
      if (!o.properties) o.properties = {};
      if (this.properties) {
        o.properties._collected_widgets = this.properties._collected_widgets;
        o.properties._isActive = this.properties._isActive;
        o.properties._widgetState = this.properties._widgetState;
      }
    };

    // ----- 反序列化（用于 undo/redo 等后续 configure 调用）-----
    const originalOnConfigure = node.onConfigure;
    node.onConfigure = function (info) {
      if (originalOnConfigure) {
        originalOnConfigure.apply(this, arguments);
      }

      if (this.collectedWidgets && this.properties) {
        restoreCollectorState(this, this.properties);
      }
    };

    // ----- 首次加载恢复 -----
    const props = node.properties;
    if (
      props &&
      ((props._collected_widgets && props._collected_widgets.length > 0) ||
        props._widgetState ||
        props._isActive)
    ) {
      restoreCollectorState(node, props);
    }

    // ----- 节点级兜底：持续从 properties._isActive 自修复 node.isActive -----
    // nodeCreated 是 fire-and-forget 异步调用，实际执行时机不确定：
    // 可能在 configure 之前（properties 为空、首次检查跳过、onConfigure 尚可触发）
    // 也可能在 configure 之后（onConfigure 已错过，依赖首次加载检查）
    // 此轮询是最终安全网：无论生命周期时序如何都能恢复状态
    let _settleCount = 0;
    const _settleInterval = setInterval(() => {
      _settleCount++;
      // 运行 10 秒（50 次 x 200ms），足以覆盖所有异步加载时序
      if (_settleCount > 50) {
        clearInterval(_settleInterval);
        return;
      };

      // 从持久化属性同步 isActive 标志
      if (node.properties?._isActive && !node.isActive) {
        node.isActive = true;
        activeCollector = node;
        setReadOnly(node, true);
      };
      
      // 如果有已收集部件但尚未恢复，触发恢复
      if (
        node.properties?._collected_widgets?.length > 0 &&
        node.collectedWidgets?.size === 0 &&
        !node._isRestoring
      ) {
        restoreCollectorState(node, node.properties);
      };
    }, 200);
  },

  // ----- 右键菜单 -----
  getNodeMenuItems(node) {
    // === Widget Collector 节点自身菜单 ===
    if (node.comfyClass === "WidgetCollector") {
      cleanupInvalidConnections(node);

      const items = [];

      // 隐藏/显示开关按钮
      if (!node.menuText) node.menuText = "Hide Switch";
      items.push({
        content: node.menuText,
        callback: () => {
          const widgetEl = node.collectorWidget.element;
          const btn = node.controlBtn;
          if (widgetEl.style.display === "none") {
            widgetEl.style.display = "flex";
            node.menuText = "Hide Switch";
            node.widgetDisplay = "flex";
          } else {
            btn.textContent = "Open Collector";
            btn.style.outline = "none";
            node.contentText = "Open Collector";
            node.widgetDisplay = "none";
            widgetEl.style.display = "none";
            node.menuText = "Show Switch";
            deactivate(node);
          }
          updateButtonState(node);
        },
      });

      // 重新排序
      if (node.collectedWidgets && node.collectedWidgets.size > 1) {
        const mirrorWidgets = [];
        node.widgets.forEach((w, idx) => {
          for (const [, col] of node.collectedWidgets.entries()) {
            if (col.mirrorWidget === w) {
              mirrorWidgets.push({ widget: w, collection: col, index: idx });
              break;
            }
          }
        });

        if (mirrorWidgets.length > 1) {
          const reorderOptions = mirrorWidgets.map((item) => {
            const displayName = `${item.collection.targetNode.title || item.collection.targetNode.type}.${item.collection.targetWidget.name}`;
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
                        app.graph.setDirtyCanvas(true);
                      }
                    },
                  },
                ],
              },
            };
          });

          items.push({
            content: "Reorder Widgets",
            has_submenu: true,
            submenu: { options: reorderOptions },
          });
        }
      }

      // 移除/清空已收集部件
      if (node.collectedWidgets && node.collectedWidgets.size > 0) {
        items.push(null);

        const removeOptions = [];
        node.collectedWidgets.forEach((collection, widgetId) => {
          const displayName = `${collection.targetNode.title || collection.targetNode.type}.${collection.targetWidget.name}`;
          removeOptions.push({
            content: displayName,
            callback: () => removeWidgetFromPanel(node, widgetId),
          });
        });

        items.push({
          content: "Remove Widget",
          has_submenu: true,
          submenu: { options: removeOptions },
        });

        items.push({
          content: "Clear All Widgets",
          callback: () => clearAllWidgets(node),
        });
      }

      return items;
    }

    // === 其他节点："Add Widget to Panel" 菜单 ===
    if (!activeCollector) return [];
    if (!node.widgets || node.widgets.length === 0) return [];
    if (node.comfyClass === "WidgetCollector") return [];
    if (isNodeBlacklisted(node)) return [];

    const validWidgets = node.widgets.filter(
      (w) => w.type !== "button" && !w.hidden && w.type !== "converted-widget"
    );
    if (validWidgets.length === 0) return [];

    return [
      null,
      {
        content: "Add Widget to Panel",
        has_submenu: true,
        submenu: {
          options: validWidgets.map((widget) => ({
            content: widget.name,
            callback: () => {
              if (activeCollector) {
                addWidgetToPanel(activeCollector, node, widget);
              }
            },
          })),
        },
      },
    ];
  },
});
