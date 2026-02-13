/**
 * 全局自定义样式以及官方样式调用
 */
import { hexToRgba } from "./theme.js";

// ========== Style Constants ==========

export const STYLE = {
  // --- Base Layout ---
  container: {
    display: "flex",
    gap: "8px",
    padding: "4px 8px",
    boxSizing: "border-box",
    width: "100%",
    position: "relative",
    alignItems: "center",
    minHeight: "32px"
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "16px"
  },

  // --- Buttons ---
  button: {
    flex: "1",
    padding: "6px 0",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
    textAlign: "center",
    userSelect: "none",
    transition: "background 0.15s, opacity 0.15s",
    lineHeight: "1.4",
    minHeight: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box"
  },
  dialogButton: {
    padding: "10px 24px",
    borderRadius: "6px",
    border: "none",
    outline: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.2s"
  },

  // --- Dialog / Overlay ---
  overlay: {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: "10000",
    backdropFilter: "blur(8px)"
  },
  dialog: {
    borderRadius: "20px",
    padding: "20px",
    minWidth: "500px",
    maxWidth: "600px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    flexShrink: "0"
  },
  dialogTitle: {
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "20px",
    padding: "10px 16px",
    borderRadius: "20px 20px 0 0",
    margin: "-20px -20px 20px",
  },
  dialogButtonBar: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    marginTop: "24px"
  },

  // --- Section ---
  sectionLabel: {
    fontSize: "14px",
    fontWeight: "600",
    minWidth: "80px",
    flexShrink: "0"
  },
  controlWrapper: {
    display: "flex",
    minHeight: "32px",
    padding: "2px 4px",
    border: "none",
    borderRadius: "6px",
    outline: "none",
    alignItems: "center",
    gap: "0",
    flexGrow: "1"
  },
  valueDisplay: {
    fontSize: "14px",
    fontWeight: "500",
    minWidth: "50px",
    flexShrink: "0"
  },
  selector: {
    width: "100%",
    height: "100%",
    border: "none",
    borderRadius: "6px",
    outline: "none",
    padding: "0 20px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer"
  },

  // --- Textarea ---
  textarea: {
    width: "100%",
    minHeight: "120px",
    padding: "10px",
    border: "none",
    borderRadius: "6px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "monospace"
  },

  // --- Slider ---
  sliderContainer: {
    position: "relative",
    height: "40px",
    flexGrow: "1",
    cursor: "pointer"
  },
  sliderTrack: {
    position: "absolute",
    top: "50%",
    left: "0",
    right: "0",
    height: "4px",
    transform: "translateY(-50%)",
    borderRadius: "2px"
  },
  activeTrack: {
    position: "absolute",
    top: "50%",
    height: "4px",
    transform: "translateY(-50%)",
    borderRadius: "2px",
    pointerEvents: "none"
  },
  sliderThumb: {
    position: "absolute",
    top: "50%",
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    outline: "none",
    transform: "translate(-50%, -50%)",
    cursor: "grab",
    zIndex: "3",
    transition: "transform 0.1s ease, outline 0.15s ease",
    pointerEvents: "none"
  },
  hiddenSlider: {
    position: "absolute",
    top: "50%",
    left: "0",
    right: "0",
    width: "100%",
    margin: "0",
    padding: "0",
    transform: "translateY(-50%)",
    opacity: "0",
    cursor: "pointer",
    pointerEvents: "none"
  },

  // --- Popover ---
  popover: {
    position: "fixed",
    zIndex: "10000",
    minWidth: "220px",
    maxHeight: "340px",
    overflowY: "auto",
    borderRadius: "10px",
    padding: "6px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
  },
  popoverTitle: {
    fontSize: "12px",
    fontWeight: "600",
    padding: "4px 8px 6px",
    marginBottom: "4px"
  },
  popoverItem: {
    padding: "6px 10px",
    borderRadius: "6px",
    fontSize: "13px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    transition: "background 0.12s"
  },
  popoverBadge: {
    fontSize: "10px",
    fontWeight: "500",
    padding: "1px 6px",
    borderRadius: "4px",
    flexShrink: "0"
  },

  // --- Toast ---
  toast: {
    position: "fixed",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "10000",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 0.3s ease"
  },

  // --- 2D Canvas Slider ---
  canvas2dContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
    padding: "10px",
    boxSizing: "border-box"
  },
  sliderBox: {
    position: "relative",
    border: "none",
    borderRadius: "6px",
    overflow: "hidden",
    cursor: "crosshair",
    boxShadow: "none",
    userSelect: "none",
    touchAction: "none"
  },
  canvasGrid: {
    position: "absolute",
    inset: "0",
    pointerEvents: "none"
  },
  canvasZone: {
    position: "absolute",
    bottom: "0",
    left: "0",
    border: "none",
    borderBottom: "none",
    borderLeft: "none",
    pointerEvents: "none"
  },
  guideLineH: {
    position: "absolute",
    left: "0",
    right: "0",
    height: "6px",
    background: "transparent",
    cursor: "ns-resize",
    pointerEvents: "auto",
    transform: "translateY(50%)",
    zIndex: "5"
  },
  guideLineV: {
    position: "absolute",
    top: "0",
    bottom: "0",
    width: "6px",
    background: "transparent",
    cursor: "ew-resize",
    pointerEvents: "auto",
    transform: "translateX(-50%)",
    zIndex: "5"
  },
  guideLineVisual: {
    position: "absolute",
    pointerEvents: "none",
    outline: "none",
    transition: "outline 0.15s ease"
  },
  guideLineHVisual: {
    left: "0",
    right: "0",
    top: "50%",
    height: "2px",
    transform: "translateY(-50%)"
  },
  guideLineVVisual: {
    top: "0",
    bottom: "0",
    left: "50%",
    width: "2px",
    transform: "translateX(-50%)"
  },
  guidePoint: {
    position: "absolute",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    outline: "none",
    transform: "translate(-50%, 50%)",
    cursor: "grab",
    pointerEvents: "auto",
    zIndex: "10",
    transition: "outline 0.15s ease"
  },
  coordTooltip: {
    position: "fixed",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "500",
    borderRadius: "4px",
    pointerEvents: "none",
    zIndex: "10000",
    display: "none",
    whiteSpace: "nowrap",
    fontFamily: "monospace"
  }
};

// ========== Factory Functions ==========

// --- Base Layout ---

export function createContainer(theme, customStyle) {
  const el = document.createElement("div");
  el.className = "container";
  Object.assign(el.style, STYLE.container, {
    background: theme.primary,
    border: "none"
  }, customStyle);
  return el;
}

// --- Buttons ---

export function createButton(label, theme, customStyle) {
  const el = document.createElement("div");
  el.className = "button";
  Object.assign(el.style, STYLE.button, {
    background: theme.background,
    color: theme.text,
  }, customStyle);
  el.textContent = label;
  return el;
}

export function createDialogButton(label, theme, customStyle) {
  const el = document.createElement("button");
  el.className = "dialog-button";
  Object.assign(el.style, STYLE.dialogButton, {
    background: theme.background,
    color: theme.text,
  }, customStyle);
  el.textContent = label;
  return el;
}

/**
 * 为按钮添加标准 hover 效果
 */
export function addButtonHover(btn, theme, hoverOpacity = 0.25) {
  btn.addEventListener("mouseenter", () => {
    btn.style.background = hexToRgba(theme.border, hoverOpacity);
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = theme.background;
  });
}

// --- Dialog / Overlay ---

export function createOverlay(theme) {
  const el = document.createElement("div");
  el.className = "overlay";
  Object.assign(el.style, STYLE.overlay, {
    backgroundColor: hexToRgba(theme.shadow, 0.3),
  });
  return el;
}

export function createDialog(theme) {
  const el = document.createElement("div");
  el.className = "dialog";
  Object.assign(el.style, STYLE.dialog, {
    background: theme.primary,
    border: `1px solid ${theme.secondary}`,
    boxShadow: `0 4px 16px ${hexToRgba(theme.shadow, 0.5)}`,
    color: theme.text,
  });
  return el;
}

export function createDialogTitle(text, theme) {
  const el = document.createElement("div");
  el.className = "dialog-title";
  Object.assign(el.style, STYLE.dialogTitle, {
    color: theme.text,
    background: theme.title,
  });
  el.textContent = text;
  return el;
}

export function createDialogButtonBar() {
  const el = document.createElement("div");
  el.className = "dialog-button-bar";
  Object.assign(el.style, STYLE.dialogButtonBar);
  return el;
}

// --- Section ---

export function createSectionLabel(text, theme) {
  const el = document.createElement("div");
  el.className = "section-label";
  Object.assign(el.style, STYLE.sectionLabel, {
    color: theme.text,
  });
  el.textContent = text;
  return el;
}

export function createControlWrapper(theme) {
  const el = document.createElement("div");
  el.className = "control-wrapper";
  Object.assign(el.style, STYLE.controlWrapper, {
    background: theme.background,
  });
  return el;
}

export function createValueDisplay(value, theme, align = "left") {
  const el = document.createElement("div");
  el.className = "value-display";
  Object.assign(el.style, STYLE.valueDisplay, {
    color: theme.text,
    textAlign: align,
  });
  el.textContent = value;
  return el;
}

export function createSelector(theme) {
  const el = document.createElement("select");
  el.className = "selector";
  Object.assign(el.style, STYLE.selector, {
    background: "transparent",
    color: theme.text
  });
  return el;
}

// --- Textarea ---

export function createTextarea(theme) {
  const el = document.createElement("textarea");
  el.className = "textarea";
  Object.assign(el.style, STYLE.textarea, {
    background: theme.background,
    color: theme.text
  });
  return el;
}

// --- Slider ---

export function createSliderContainer() {
  const el = document.createElement("div");
  el.className = "slider-container";
  Object.assign(el.style, STYLE.sliderContainer);
  return el;
}

export function createSliderTrack(theme) {
  const el = document.createElement("div");
  el.className = "slider-track";
  Object.assign(el.style, STYLE.sliderTrack, {
    background: theme.secondary,
  });
  return el;
}

export function createActiveTrack(theme, customStyle) {
  const el = document.createElement("div");
  el.className = "active-track";
  Object.assign(el.style, STYLE.activeTrack, {
    background: theme.border,
  }, customStyle);
  return el;
}

export function createSliderThumb(theme, customStyle) {
  const el = document.createElement("div");
  el.className = "slider-thumb";
  Object.assign(el.style, STYLE.sliderThumb, {
    background: theme.border,
    boxShadow: `0 2px 8px ${hexToRgba(theme.shadow, 0.3)}`,
  }, customStyle);
  return el;
}

export function createHiddenSlider(config = {}, customStyle) {
  const el = document.createElement("input");
  el.className = "hidden-slider";
  el.type = "range";
  if (config.min !== undefined) el.min = config.min;
  if (config.max !== undefined) el.max = config.max;
  if (config.step !== undefined) el.step = config.step;
  if (config.value !== undefined) el.value = config.value;
  Object.assign(el.style, STYLE.hiddenSlider, customStyle);
  return el;
}

// --- Popover ---

export function createPopover(theme) {
  const el = document.createElement("div");
  el.className = "popover";
  Object.assign(el.style, STYLE.popover, {
    background: theme.primary,
    border: `1px solid ${theme.secondary}`,
    boxShadow: `0 8px 24px ${hexToRgba(theme.shadow, 0.45)}`,
  });
  return el;
}

export function createPopoverTitle(text, theme) {
  const el = document.createElement("div");
  el.className = "popover-title";
  Object.assign(el.style, STYLE.popoverTitle, {
    color: hexToRgba(theme.text, 0.5),
    borderBottom: `1px solid ${theme.secondary}`,
  });
  el.textContent = text;
  return el;
}

export function createPopoverItem(theme, options = {}) {
  const el = document.createElement("div");
  el.className = "popover-item";
  Object.assign(el.style, STYLE.popoverItem, {
    fontWeight: options.isCurrent ? "600" : "400",
    color: options.isCurrent ? hexToRgba(theme.text, 0.4) : theme.text,
    cursor: options.isCurrent ? "default" : "pointer",
  });
  return el;
}

export function createPopoverBadge(text, theme) {
  const el = document.createElement("span");
  el.className = "popover-badge";
  Object.assign(el.style, STYLE.popoverBadge, {
    color: hexToRgba(theme.text, 0.35),
    background: hexToRgba(theme.border, 0.15),
  });
  el.textContent = text;
  return el;
}

// --- Toast ---

export function createToast(theme) {
  const el = document.createElement("div");
  el.className = "toast";
  Object.assign(el.style, STYLE.toast, {
    background: theme.primary,
    color: theme.text,
    boxShadow: `0 2px 8px ${hexToRgba(theme.shadow, 0.3)}`,
  });
  return el;
}

// --- 2D Canvas Slider ---

export function createCanvas2dContainer() {
  const el = document.createElement("div");
  el.className = "size-canvas-2d-slider-container";
  Object.assign(el.style, STYLE.canvas2dContainer);
  return el;
}

export function createSliderBox(theme) {
  const el = document.createElement("div");
  el.className = "slider-box";
  Object.assign(el.style, STYLE.sliderBox, {
    background: theme.background,
  });
  return el;
}

export function createCanvasGrid(theme) {
  const el = document.createElement("div");
  el.className = "canvas-grid";
  Object.assign(el.style, STYLE.canvasGrid, {
    boxShadow: `inset 0 0 0 1px ${theme.background}`,
  });
  return el;
}

export function createCanvasZone(theme, opacity, zIndex) {
  const el = document.createElement("div");
  el.className = "canvas-zone";
  Object.assign(el.style, STYLE.canvasZone, {
    background: hexToRgba(theme.primary, opacity),
    zIndex: zIndex ?? "1",
  });
  return el;
}

export function createCanvasSelectedArea(theme) {
  const el = document.createElement("div");
  el.className = "canvas-selected-area";
  Object.assign(el.style, STYLE.canvasZone, {
    background: hexToRgba(theme.border, 0.5),
    zIndex: "3",
  });
  return el;
}

export function createGuideLineH() {
  const container = document.createElement("div");
  container.className = "guide-line-h";
  Object.assign(container.style, STYLE.guideLineH);
  return container;
}

export function createGuideLineV() {
  const container = document.createElement("div");
  container.className = "guide-line-v";
  Object.assign(container.style, STYLE.guideLineV);
  return container;
}

export function createGuideLineHVisual(theme) {
  const el = document.createElement("div");
  el.className = "guide-line-h-visual";
  Object.assign(el.style, STYLE.guideLineVisual, STYLE.guideLineHVisual, {
    background: theme.border,
  });
  return el;
}

export function createGuideLineVVisual(theme) {
  const el = document.createElement("div");
  el.className = "guide-line-v-visual";
  Object.assign(el.style, STYLE.guideLineVisual, STYLE.guideLineVVisual, {
    background: theme.border,
  });
  return el;
}

export function createGuidePoint(theme) {
  const el = document.createElement("div");
  el.className = "guide-point";
  Object.assign(el.style, STYLE.guidePoint, {
    background: theme.border,
    boxShadow: `0 2px 8px ${hexToRgba(theme.shadow, 0.3)}`,
  });
  return el;
}

export function createCoordTooltip(theme) {
  const el = document.createElement("div");
  el.className = "coord-tooltip";
  Object.assign(el.style, STYLE.coordTooltip, {
    background: theme.primary,
    color: theme.text,
    boxShadow: `0 2px 8px ${hexToRgba(theme.shadow, 0.3)}`,
  });
  return el;
}

// ========== Namespace Export ==========

/**
 * custom — 自定义 DOM 样式工厂（布局、对话框、滑块、弹出菜单、2D Canvas 等）
 */
export const custom = {
  // Layout
  container: createContainer,
  // Buttons
  button: createButton,
  dialogButton: createDialogButton,
  buttonHover: addButtonHover,
  // Dialog / Overlay
  overlay: createOverlay,
  dialog: createDialog,
  dialogTitle: createDialogTitle,
  dialogButtonBar: createDialogButtonBar,
  // Section
  sectionLabel: createSectionLabel,
  controlWrapper: createControlWrapper,
  valueDisplay: createValueDisplay,
  selector: createSelector,
  // Text
  textarea: createTextarea,
  // Slider
  sliderContainer: createSliderContainer,
  sliderTrack: createSliderTrack,
  activeTrack: createActiveTrack,
  sliderThumb: createSliderThumb,
  hiddenSlider: createHiddenSlider,
  // Popover
  popover: createPopover,
  popoverTitle: createPopoverTitle,
  popoverItem: createPopoverItem,
  popoverBadge: createPopoverBadge,
  // Toast
  toast: createToast,
  // 2D Canvas
  canvas2dContainer: createCanvas2dContainer,
  sliderBox: createSliderBox,
  canvasGrid: createCanvasGrid,
  canvasZone: createCanvasZone,
  canvasSelectedArea: createCanvasSelectedArea,
  guideLineH: createGuideLineH,
  guideLineV: createGuideLineV,
  guideLineHVisual: createGuideLineHVisual,
  guideLineVVisual: createGuideLineVVisual,
  guidePoint: createGuidePoint,
  coordTooltip: createCoordTooltip
};

// ========== 官方 Widget 封装 ==========

/**
 * ui — 封装 ComfyUI 官方 node.addWidget / addDOMWidget API
 *
 * 所有方法返回 LiteGraph widget 对象，在 Nodes 2.0 (Vue) 模式下
 * 自动渲染为与官方完全一致的 Vue 组件样式。
 *
 * 类型映射：
 *   number  → WidgetInputNumber
 *   combo   → WidgetSelect
 *   toggle  → WidgetToggleSwitch
 *   text    → WidgetInputText
 *   textarea→ WidgetTextarea (DOM widget)
 *
 * @example
 *   import { ui } from "../style.js";
 *   const w = ui.addNumber(node, "my_num", 0, (v) => console.log(v), { min: 0, max: 100 });
 */
export const ui = {
  /**
   * 创建数字输入控件
   * @param {Object} node       - LiteGraph 节点
   * @param {string} name       - widget 名称
   * @param {number} value      - 默认值
   * @param {Function} callback - 值变更回调 (value) => void
   * @param {Object} [options]  - { min, max, step, precision }
   * @returns {IBaseWidget}
   */
  addNumber(node, name, value, callback, options = {}) {
    const step = options.step ?? 1;
    const node2Config = options.component === "WidgetInputSlider" || options.isSlider ? {
      type: "slider",
      component: "WidgetInputSlider",
      range: [options.min ?? -999999, options.max ?? 999999]
      } : {
      type: "number",
      component: "WidgetInputNumber"
    };

    const finalOptions = {
      min: options.min ?? -999999,
      max: options.max ?? 999999,
      step: step * 10,      // LiteGraph legacy 约定
      step2: step,           // 实际步长
      precision: options.precision ?? (step < 1 ? Math.max(2, -Math.floor(Math.log10(step))) : 0),
      ...node2Config,
      ...options
    };

    const widgetType = finalOptions.isSlider || finalOptions.component === "WidgetInputSlider" ? "slider" : "number";
    const widget = node.addWidget(widgetType, name, value, callback, finalOptions);

    widget.component = finalOptions.component;
    widget.widget_type = finalOptions.widget_type || widgetType;

    return widget
  },

  /**
   * 创建下拉选择控件
   * @param {Object} node       - LiteGraph 节点
   * @param {string} name       - widget 名称
   * @param {*}      value      - 默认值
   * @param {Function} callback - 值变更回调
   * @param {Object} [options]  - { values: string[] | () => string[] }
   * @returns {IBaseWidget}
   */
  addCombo(node, name, value, callback, options = {}) {
    const rawValues = options.values;
    return node.addWidget("combo", name, value, callback, {
      values: typeof rawValues === "function" ? rawValues() : rawValues || [],
      ...options,
    });
  },

  /**
   * 创建开关控件
   * @param {Object} node       - LiteGraph 节点
   * @param {string} name       - widget 名称
   * @param {boolean} value     - 默认值
   * @param {Function} callback - 值变更回调
   * @param {Object} [options]  - { on, off }
   * @returns {IBaseWidget}
   */
  addToggle(node, name, value, callback, options = {}) {
    return node.addWidget("toggle", name, !!value, callback, {
      on: options.on || "ON",
      off: options.off || "OFF",
      ...options,
    });
  },

  /**
   * 创建单行文本输入控件
   * @param {Object} node       - LiteGraph 节点
   * @param {string} name       - widget 名称
   * @param {string} value      - 默认值
   * @param {Function} callback - 值变更回调
   * @param {Object} [options]  - 附加选项
   * @returns {IBaseWidget}
   */
  addText(node, name, value, callback, options = {}) {
    return node.addWidget("text", name, value ?? "", callback, options);
  },

  /**
   * 创建多行文本输入控件（DOM widget）
   * @param {Object} node       - LiteGraph 节点
   * @param {string} name       - widget 名称
   * @param {string} value      - 默认值
   * @param {Function} callback - 值变更回调
   * @param {Object} [options]  - { rows, minHeight, hideOnZoom }
   * @returns {IBaseWidget}
   */
  addTextarea(node, name, value, callback, options = {}) {
    const textarea = document.createElement("textarea");
    textarea.value = value ?? "";
    textarea.style.width = "100%";
    textarea.style.minHeight = options.minHeight || "40px";
    textarea.style.resize = "vertical";
    textarea.style.boxSizing = "border-box";
    if (options.rows) textarea.rows = options.rows;
    textarea.addEventListener("change", () => callback?.(textarea.value));
    textarea.addEventListener("input", () => callback?.(textarea.value));

    const widget = node.addDOMWidget(name, "customtext", textarea, {
      getValue: () => textarea.value,
      setValue: (v) => { textarea.value = v ?? ""; },
      serialize: options.serialize ?? false,
      hideOnZoom: options.hideOnZoom ?? false,
    });
    widget.computeSize = function (width) {
      return [width, options.height || 56];
    };
    return widget;
  },

  /**
   * 根据 widgetInfo 自动选择合适的控件类型创建 widget
   * @param {Object} node        - LiteGraph 节点
   * @param {string} name        - widget 名称（显示用 widgetId）
   * @param {Object} widgetInfo  - { type, value, options }
   * @param {Function} callback  - 值变更回调
   * @param {Object} [extra]     - 附加选项（会合并到 widget options）
   * @returns {IBaseWidget}
   */
  addAuto(node, name, widgetInfo, callback, extra = {}) {
    const t = (widgetInfo.type || "text").toLowerCase();
    const opts = { ...widgetInfo.options, component: widgetInfo.component, ...extra };

    if (opts.component === "WidgetInputSlider" || t === "slider") {
      return ui.addNumber(node, name, widgetInfo.value, callback, {
        ...opts,
        isSlider: true,
        component: "WidgetInputSlider"
      });
    }

    switch (t) {
      case "number":
      case "knob":
        return ui.addNumber(node, name, widgetInfo.value, callback, {
          ...opts,
          component: "WidgetInputNumber"
        });
      case "combo":
        return ui.addCombo(node, name, widgetInfo.value, callback, {
          ...opts,
          component: "WidgetSelect"
        });
      case "toggle":
        return ui.addToggle(node, name, widgetInfo.value, callback, {
          ...opts,
          component: "WidgetToggleSwitch"
        });
      case "text":
      case "string":
        if (opts.multiline) {
          return ui.addTextarea(node, name, widgetInfo.value, callback, opts);
        }
        return ui.addText(node, name, widgetInfo.value, callback, {
          ...opts,
          component: "WidgetInputText"
        });
      case "customtext":
        return ui.addTextarea(node, name, widgetInfo.value, callback, opts);
      default:
        return ui.addText(node, name, widgetInfo.value, callback, opts);
    }
  },
};