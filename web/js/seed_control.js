import { ComfyThemeAdapter } from "../adapter.js";
import { hexToRgba } from "../theme.js";
import { custom } from "../style.js";
import { app } from "/scripts/app.js";

// ========== 辅助函数 ==========

/**
 * 更新种子历史记录
 * @param {Object} node - 节点实例
 * @param {number} seedValue - 要记录的种子值
 */
function updateSeedHistory(node, seedValue) {
  if (node.seedHistory.length === 0 || node.seedHistory[0] !== seedValue) {
    node.seedHistory.unshift(seedValue);
    if (node.seedHistory.length > node.maxHistoryLength) {
      node.seedHistory.pop();
    }
    // 立即刷新按钮状态
    if (node._onHistoryChange) node._onHistoryChange();
  }
}

/**
 * 获取当前的控制模式
 */
function getControlMode(node) {
  const controlWidget = node.widgets.find((w) => w.name === "control_after_generate");
  return controlWidget ? controlWidget.value : "fixed";
}

/**
 * 获取当前的种子值
 */
function getCurrentSeed(node) {
  const seedWidget = node.widgets.find((w) => w.name === "seed");
  return seedWidget ? seedWidget.value : 0;
}

/**
 * 生成新的随机种子（带锁定保护）
 * @returns {number|null} 新种子值，失败返回null
 */
function generateRandomSeed(node) {
  const seedWidget = node.widgets.find((w) => w.name === "seed");
  if (!seedWidget) return null;

  const randomSeed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  // 关键：在设置值之前先锁定
  node.lockedSeed = randomSeed;
  node.isRestoring = false;

  // 设置新种子值（此时已被保护，不会被其他值覆盖）
  seedWidget.value = randomSeed;

  // 手动更新历史记录
  updateSeedHistory(node, randomSeed);

  // 手动触发callback
  if (seedWidget.callback) {
    const tempRestoring = node.isRestoring;
    node.isRestoring = true;
    seedWidget.callback(randomSeed);
    node.isRestoring = tempRestoring;
  }

  return randomSeed;
}

/**
 * 队列prompt并注入正确的seed值
 */
async function queuePromptWithSeed(node, targetSeed) {
  const operationId = Date.now() + Math.random();
  node.currentOperationId = operationId;

  node.forcedSeed = targetSeed;
  node.isExecuting = true;

  try {
    await app.queuePrompt(0, 1);

    // 延迟清除标志 - 只有当前操作是最新操作时才清除
    setTimeout(() => {
      if (node.currentOperationId === operationId) {
        node.forcedSeed = null;
        node.isExecuting = false;
        node.lockedSeed = null;
      }
    }, 2000);
  } catch (err) {
    // 发生错误时，只有当前操作才清除标志
    if (node.currentOperationId === operationId) {
      node.forcedSeed = null;
      node.isExecuting = false;
      node.lockedSeed = null;
    }
  }
}

// ========== Control Widget 更新 ==========

/**
 * 程序化设置 control_after_generate 的值，并强制刷新 nodes 2.0 的图标。
 *
 * Nodes 2.0 的 WidgetWithControl.vue 使用 ref() 一次性初始化 controlModel，
 * 外部代码直接修改 widget.value 不会触发图标更新。
 * 本函数通过短暂断开 linkedWidgets 连接强制组件重新挂载，从而刷新图标。
 *
 * @param {Object} node
 * @param {string} value - "fixed" | "increment" | "decrement" | "randomize"
 */
function setControlAfterGenerate(node, value) {
  // 1. 检查当前值，已经是目标值则跳过
  const controlWidget = node.widgets.find(
    (w) => w.name === "control_after_generate"
  );
  if (!controlWidget || controlWidget.value === value) return;

  // 2. 设置底层 litegraph widget 值
  controlWidget.value = value;

  // 3. Nodes 2.0: 强制 WidgetWithControl 组件重新挂载以刷新图标
  const seedWidget = node.widgets.find((w) => w.name === "seed");
  if (seedWidget?.linkedWidgets) {
    const savedLinked = seedWidget.linkedWidgets;
    // 断开连接 → hasControlAfterGenerate = false → 组件卸载
    seedWidget.linkedWidgets = [];

    // 触发 shallowReactive 数组变化 → safeWidgets 重算
    const idx = node.widgets.indexOf(seedWidget);
    if (idx >= 0) node.widgets.splice(idx, 1, seedWidget);

    // Vue 处理完卸载后恢复连接 → 组件以新值重新挂载
    setTimeout(() => {
      seedWidget.linkedWidgets = savedLinked;
      if (idx >= 0) node.widgets.splice(idx, 1, seedWidget);
    }, 0);
  }
}

// ========== 节点状态初始化 ==========

/**
 * 初始化节点的所有状态变量
 */
function initNodeState(node) {
  node.seedHistory = [];
  node.maxHistoryLength = 10;
  node.isRestoring = false;
  node.isExecuting = false;
  node.forcedSeed = null;
  node.lockedSeed = null;
  node.currentOperationId = null;
  node.buttonCooldown = { left: false };
  node.isHandlingControlChange = false;
}

// ========== Widget 拦截器 ==========

/**
 * 设置 seed widget 的拦截器（value setter + callback）
 */
function setupSeedWidgetInterceptor(node) {
  const seedWidget = node.widgets.find((w) => w.name === "seed");
  if (!seedWidget) return;

  // 记录初始种子值
  if (seedWidget.value !== undefined) {
    updateSeedHistory(node, seedWidget.value);
  }

  const originalCallback = seedWidget.callback;

  // 重写 value 属性，添加 setter 拦截
  let internalValue = seedWidget.value;

  Object.defineProperty(seedWidget, "value", {
    get() {
      return internalValue;
    },
    set(v) {
      // 如果有 lockedSeed，只允许设置为 lockedSeed
      if (node.lockedSeed !== null && v !== node.lockedSeed) {
        return; // 完全阻止设置，避免闪烁
      }

      // 在 fixed 模式下，如果正在执行队列，阻止种子变化
      const controlWidget = node.widgets.find((w) => w.name === "control_after_generate");
      if (controlWidget && controlWidget.value === "fixed" && !node.isRestoring) {
        if (!node.isExecuting && node.forcedSeed === null && v !== internalValue) {
          return;
        }
      }

      internalValue = v;

      // 触发 UI 更新
      if (node.graph) {
        node.graph.setDirtyCanvas(true);
      }
    },
    configurable: true,
  });

  // 重写 callback
  seedWidget.callback = (value) => {
    // 如果有 lockedSeed 且值不匹配，忽略
    if (node.lockedSeed !== null && value !== node.lockedSeed) {
      return;
    }

    // 执行期间忽略变更（但仍调用原始 callback）
    if (node.isExecuting) {
      if (originalCallback) {
        originalCallback.call(seedWidget, value);
      }
      return;
    }

    // 只有不是在恢复历史记录时才记录新值
    if (!node.isRestoring) {
      updateSeedHistory(node, value);
    }

    if (originalCallback) {
      originalCallback.call(seedWidget, value);
    }
  };
}

/**
 * 设置 control_after_generate widget 的拦截器
 */
function setupControlWidgetInterceptor(node) {
  const controlWidget = node.widgets.find((w) => w.name === "control_after_generate");
  if (!controlWidget) return;

  const originalControlCallback = controlWidget.callback;

  controlWidget.callback = (value) => {
    if (node.isHandlingControlChange) {
      if (originalControlCallback) {
        originalControlCallback.call(controlWidget, value);
      }
      return;
    }

    node.isHandlingControlChange = true;

    if (value === "randomize") {
      // 重置所有状态
      node.isRestoring = false;
      node.isExecuting = false;
      node.forcedSeed = null;
      node.lockedSeed = null;
      node.currentOperationId = null;

      generateRandomSeed(node);
    } else if (value === "fixed") {
      // 切换到 fixed 模式时，锁定当前种子
      const seedWidget = node.widgets.find((w) => w.name === "seed");
      if (seedWidget) {
        const currentSeed = seedWidget.value;
        if (!node.isRestoring) {
          updateSeedHistory(node, currentSeed);
        }
      }
    }

    if (originalControlCallback) {
      originalControlCallback.call(controlWidget, value);
    }

    node.isHandlingControlChange = false;
  };
}

// ========== 按钮部件 ==========

/**
 * 创建按钮 DOM Widget（manual random + pull history 下拉）
 */
function createButtonWidget(node) {
  const adapter = new ComfyThemeAdapter();
  let theme = adapter.theme;

  const container = custom.container();

  const manualBtn = custom.button("manual random", theme);
  const historyBtn = custom.button("pull history", theme);

  container.appendChild(manualBtn);
  container.appendChild(historyBtn);

  // --- manual random hover ---
  manualBtn.addEventListener("mouseenter", () => {
    if (manualBtn.dataset.cooldown === "true") return;
    manualBtn.style.background = hexToRgba(theme.border, 0.25);
  });
  manualBtn.addEventListener("mouseleave", () => {
    if (manualBtn.dataset.cooldown === "true") return;
    manualBtn.style.background = theme.background;
  });

  // --- pull history hover ---
  historyBtn.addEventListener("mouseenter", () => {
    if (historyBtn.dataset.disabled === "true") return;
    historyBtn.style.background = hexToRgba(theme.border, 0.25);
  });
  historyBtn.addEventListener("mouseleave", () => {
    if (historyBtn.dataset.disabled === "true") return;
    // popover 打开时恢复到 primary，否则恢复到激活色 background
    const isLit = historyBtn.dataset.lit === "true" && !popover;
    historyBtn.style.background = isLit ? theme.background : theme.primary;
  });

  /**
   * 获取 historyBtn 当前应有的背景色
   */
  function getHistoryBtnBg() {
    if (historyBtn.dataset.disabled === "true") return theme.primary;
    if (popover) return theme.primary; // popover 打开时为未激活色
    if (historyBtn.dataset.lit === "true") return theme.background; // 有历史时激活
    return theme.primary;
  }

  /**
   * 更新 pull history 按钮的视觉状态（禁用 / 亮起 / 默认）
   */
  function updateHistoryBtnState() {
    const hasHistory = node.seedHistory.length >= 2;
    historyBtn.dataset.disabled = hasHistory ? "false" : "true";
    historyBtn.dataset.lit = hasHistory ? "true" : "false";
    historyBtn.style.opacity = hasHistory ? "1" : "0.4";
    historyBtn.style.cursor = hasHistory ? "pointer" : "default";
    historyBtn.style.background = getHistoryBtnBg();
  }

  /**
   * 恢复 manual random 按钮外观（冷却结束后）
   */
  function resetManualBtn() {
    node.buttonCooldown.left = false;
    manualBtn.dataset.cooldown = "false";
    manualBtn.style.opacity = "1";
    manualBtn.style.background = theme.background;
  }

  // ========== 种子历史下拉菜单 ==========

  let popover = null; // 当前弹出的菜单实例

  /**
   * 关闭已打开的历史菜单
   */
  function closePopover() {
    if (popover) {
      popover.remove();
      popover = null;
    }
    document.removeEventListener("pointerdown", onOutsideClick, true);
    // 恢复按钮亮起状态
    updateHistoryBtnState();
  }

  /**
   * 点击菜单外部时关闭
   */
  function onOutsideClick(e) {
    if (popover && !popover.contains(e.target) && e.target !== historyBtn) {
      closePopover();
    }
  }

  /**
   * 选中某个历史种子后的执行逻辑
   */
  function selectHistorySeed(seed) {
    closePopover();

    // 设置 control 为 fixed
    setControlAfterGenerate(node, "fixed");

    const seedWidget = node.widgets.find((w) => w.name === "seed");
    if (!seedWidget) return;

    node.isRestoring = true;
    node.lockedSeed = seed;
    seedWidget.value = seed;

    // 将选中的种子提升到历史顶部
    const idx = node.seedHistory.indexOf(seed);
    if (idx > 0) {
      node.seedHistory.splice(idx, 1);
      node.seedHistory.unshift(seed);
    }

    setTimeout(() => {
      node.isRestoring = false;
    }, 100);

    setTimeout(() => {
      queuePromptWithSeed(node, seed);
    }, 50);
  }

  /**
   * 打开种子历史下拉菜单
   */
  function openPopover() {
    if (popover) {
      closePopover();
      return;
    }

    // 至少需要 2 条记录（当前种子 + 历史）
    if (node.seedHistory.length < 2) return;

    // popover 打开时按钮恢复未激活外观
    historyBtn.style.background = theme.primary;

    popover = custom.popover(theme);

    // 标题
    const title = custom.popoverTitle("Seed History", theme);
    popover.appendChild(title);

    // 当前种子（第一条）标记为 current，不可点击
    // 历史种子从 index 1 开始
    const currentSeed = node.seedHistory[0];

    node.seedHistory.forEach((seed, i) => {
      const isCurrent = i === 0;
      const item = custom.popoverItem(theme, { isCurrent });

      // 种子值文本
      const seedText = document.createElement("span");
      seedText.style.fontFamily = "'SF Mono', 'Cascadia Code', 'Consolas', monospace";
      seedText.style.fontSize = "12px";
      seedText.textContent = String(seed);
      item.appendChild(seedText);

      // 标签
      if (isCurrent) {
        const badge = custom.popoverBadge("current", theme);
        item.appendChild(badge);
      }

      // 非当前种子的交互
      if (!isCurrent) {
        item.addEventListener("mouseenter", () => {
          item.style.background = hexToRgba(theme.border, 0.2);
        });
        item.addEventListener("mouseleave", () => {
          item.style.background = "transparent";
        });
        item.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectHistorySeed(seed);
        });
      }

      popover.appendChild(item);
    });

    // 主题绑定
    adapter.bindElement(popover, {
      background: "primary",
      boxShadow: (t) => `0 8px 24px ${hexToRgba(t.shadow, 0.45)}`,
    });

    // 定位：在按钮下方弹出
    document.body.appendChild(popover);

    const btnRect = historyBtn.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();

    // 优先向下弹出，空间不够则向上
    let top = btnRect.bottom + 4;
    if (top + popRect.height > window.innerHeight - 8) {
      top = btnRect.top - popRect.height - 4;
    }
    // 水平对齐到按钮右侧
    let left = btnRect.right - popRect.width;
    if (left < 8) left = btnRect.left;

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;

    // 点击外部关闭
    setTimeout(() => {
      document.addEventListener("pointerdown", onOutsideClick, true);
    }, 0);
  }

  // --- manual random 点击 ---
  manualBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePopover();

    if (node.buttonCooldown.left) return;

    // 进入冷却期
    node.buttonCooldown.left = true;
    manualBtn.dataset.cooldown = "true";
    manualBtn.style.opacity = "0.5";

    node.isRestoring = false;

    // 设置 control_after_generate 为 fixed（含 nodes 2.0 图标刷新）
    setControlAfterGenerate(node, "fixed");

    // 生成新的随机种子
    const newSeed = generateRandomSeed(node);

    if (newSeed !== null) {
      setTimeout(() => {
        queuePromptWithSeed(node, newSeed).finally(() => {
          setTimeout(() => resetManualBtn(), 500);
        });
      }, 50);
    } else {
      resetManualBtn();
    }
  });

  // --- pull history 点击 ---
  historyBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openPopover();
  });

  // --- 主题绑定 ---
  adapter.bindElement(manualBtn, { background: "background", color: "text" });
  // historyBtn 背景由 updateHistoryBtnState 管理，仅绑定文字色
  adapter.bindElement(historyBtn, { color: "text" });
  adapter.onThemeChange((newTheme) => {
    theme = newTheme;
    updateHistoryBtnState();
  });

  // --- 注册为 DOM Widget ---
  const widget = node.addDOMWidget("seed_buttons", "SEED_BUTTONS", container, {
    serialize: false,
    hideOnZoom: false,
  });

  widget.computeSize = function (width) {
    return [width, 34];
  };

  widget.updateHistoryBtnState = updateHistoryBtnState;

  // 注册到节点上，供 updateSeedHistory 回调
  node._onHistoryChange = updateHistoryBtnState;

  widget.onRemove = function () {
    closePopover();
    adapter.destroy();
  };

  updateHistoryBtnState();

  return widget;
}

// ========== 注册扩展 ==========

app.registerExtension({
  name: "a1rworkshop.seedcontrol",

  async nodeCreated(node, app) {
    if (node.comfyClass !== "SeedControl") return;

    // 1) 初始化节点状态
    initNodeState(node);

    // 2) 设置 seed widget 拦截器
    setupSeedWidgetInterceptor(node);

    // 3) 设置 control_after_generate widget 拦截器
    setupControlWidgetInterceptor(node);

    // 4) 创建按钮 DOM Widget
    const buttonWidget = createButtonWidget(node);

    // 5) 设置最小节点宽度
    const minNodeWidth = 300;
    if (node.size[0] < minNodeWidth) node.size[0] = minNodeWidth;

    // 6) 包装 onRemoved —— 清理 DOM widget
    const originalOnRemoved = node.onRemoved;
    node.onRemoved = function () {
      if (buttonWidget.onRemove) buttonWidget.onRemove();
      if (originalOnRemoved) originalOnRemoved.apply(this, arguments);
    };

    // 7) 包装 onConfigure —— 加载工作流时恢复状态（反序列化）
    const originalOnConfigure = node.onConfigure;
    node.onConfigure = function (info) {
      if (originalOnConfigure) originalOnConfigure.apply(this, arguments);

      if (info.seedHistory) {
        this.seedHistory = info.seedHistory;
        // 兼容旧工作流：截断到新上限
        if (this.seedHistory.length > this.maxHistoryLength) {
          this.seedHistory.length = this.maxHistoryLength;
        }
      } else {
        this.seedHistory = [];
        const seedWidget = this.widgets.find((w) => w.name === "seed");
        if (seedWidget && seedWidget.value !== undefined) {
          updateSeedHistory(this, seedWidget.value);
        }
      }

      // 更新按钮视觉状态
      if (buttonWidget.updateHistoryBtnState) {
        buttonWidget.updateHistoryBtnState();
      }
    };

    // 8) 包装 onSerialize —— 保存时持久化状态（序列化）
    const originalOnSerialize = node.onSerialize;
    node.onSerialize = function (info) {
      if (originalOnSerialize) originalOnSerialize.apply(this, arguments);
      info.seedHistory = this.seedHistory || [];
    };
  },

  /**
   * 在 app 级别拦截 graphToPrompt 注入 seed 值
   */
  async setup() {
    const originalGraphToPrompt = app.graphToPrompt;

    app.graphToPrompt = async function () {
      const prompt = await originalGraphToPrompt.call(app);

      for (const node of app.graph._nodes) {
        if (node.comfyClass === "SeedControl") {
          const nodeId = node.id;
          if (prompt.output && prompt.output[nodeId]) {
            // 优先使用 forcedSeed（来自按钮操作）
            if (node.forcedSeed !== null) {
              prompt.output[nodeId].inputs.seed = node.forcedSeed;
            }
            // 如果是 fixed 模式，强制使用当前种子值
            else if (getControlMode(node) === "fixed") {
              prompt.output[nodeId].inputs.seed = getCurrentSeed(node);
            }
          }
        }
      }

      return prompt;
    };
  },
});