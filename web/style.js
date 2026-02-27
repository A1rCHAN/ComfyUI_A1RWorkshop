/**
 * 全局自定义样式以及官方样式调用
 * 支持双前端架构：Nodes 2.0 (Vue) 和 Classic (LiteGraph)
 * 自动检测前端类型，支持手动覆盖为 Classic 模式
 */
import { ComfyThemeAdapter } from "./adapter.js";
import {
  hexToRgba,
  getEffectiveFrontendType,
  FRONTEND_TYPE,
  getCSSVar
} from "./dist/theme/theme.js";

// ========== 前端类型检测与风格配置 ==========

/**
 * 获取当前UI风格配置
 * 优先CSS变量覆盖，兼容手动传入theme对象
 */
function getUIStyle(theme) {
  const frontend = theme?._frontendType || getEffectiveFrontendType();
  const isClassic = theme?._isClassic || frontend === FRONTEND_TYPE.LITEGRAPH;

  return {
    isClassic,
    frontend,
    // 圆角
    radius: {
      sm: `var(--a1r-radius-sm, ${isClassic ? "0px" : "4px"})`,
      md: `var(--a1r-radius-md, ${isClassic ? "0px" : "6px"})`,
      lg: `var(--a1r-radius-lg, ${isClassic ? "0px" : "8px"})`,
      xl: `var(--a1r-radius-xl, ${isClassic ? "0px" : "12px"})`,
      dialog: `var(--a1r-radius-dialog, ${isClassic ? "0px" : "20px"})`
    },
    // 阴影
    shadow: {
      sm: `var(--a1r-shadow-sm)`,
      md: `var(--a1r-shadow-md)`,
      lg: `var(--a1r-shadow-lg)`,
      dialog: `var(--a1r-shadow-md)`
    },
    // 字体
    font: {
      ui: isClassic ? "Courier New, Consolas, monospace" : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
      mono: isClassic ? "Courier New, Consolas, monospace" : "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, monospace"
    },
    // 间距
    spacing: isClassic ? {
      xs: "2px",
      sm: "4px",
      md: "6px",
      lg: "10px",
      xl: "16px"
    } : {
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "24px"
    },
    // 动画
    transition: isClassic ? "none" : "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",

    // 颜色
    color: {
      title: 'var(--a1r-title)',
      background: 'var(--a1r-background)',
      border: 'var(--a1r-border)',
      text: 'var(--a1r-text)',
      primary: 'var(--a1r-primary)',
      secondary: 'var(--a1r-secondary)',
      accent: 'var(--a1r-accent)',
      warning: 'var(--a1r-warning)',
      shadow: 'var(--a1r-shadow)'
    }
  };
}

// ========== 结构样式常量 ==========

const STRUCTURE = {
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
  dialog: {
    minWidth: "400px",
    maxWidth: "600px",
    flexShrink: "0",
    margin: "0",
    position: "relative",
    maxHeight: "90vh",
    overflow: "auto"
  },
  dialogStructure: {
    display: "flex",
    flexDirection: "column"
  },
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
    pointerEvents: "auto"
  }
}

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
    padding: "4px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
    textAlign: "center",
    userSelect: "none",
    transition: "background 0.15s, opacity 0.15s",
    lineHeight: "1.4",
    minHeight: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box"
  },
  // Classic button variant
  buttonClassic: {
    flex: "1",
    padding: "4px 12px",
    borderRadius: "0px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "400",
    textAlign: "center",
    userSelect: "none",
    transition: "none",
    lineHeight: "1.4",
    minHeight: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    border: "1px solid",
    fontFamily: "Courier New, monospace"
  },
  dialogButton: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "none",
    outline: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.2s"
  },
  // Classic dialog button
  dialogButtonClassic: {
    padding: "6px 12px",
    borderRadius: "0px",
    border: "1px solid",
    outline: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "400",
    transition: "none",
    fontFamily: "Courier New, monospace"
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
    backdropFilter: "blur(8px)",
    pointerEvents: "auto"
  },
  // Classic overlay (no blur)
  overlayClassic: {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: "10000",
    backdropFilter: "none"
  },
  dialog: {
    borderRadius: "20px",
    padding: "20px",
    minWidth: "500px",
    maxWidth: "600px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    flexShrink: "0",
    margin: "0",
    position: "relative"
  },
  // Classic dialog
  dialogClassic: {
    borderRadius: "0px",
    padding: "12px",
    minWidth: "400px",
    maxWidth: "500px",
    fontFamily: "Courier New, monospace",
    flexShrink: "0",
    border: "1px solid"
  },
  dialogTitle: {
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "20px",
    padding: "10px 16px",
    borderRadius: "20px 20px 0 0",
    margin: "-20px -20px 20px",
  },
  // Classic title
  dialogTitleClassic: {
    fontSize: "14px",
    fontWeight: "400",
    marginBottom: "12px",
    padding: "6px 10px",
    borderRadius: "0px",
    margin: "-12px -12px 12px",
    borderBottom: "1px solid",
    textTransform: "uppercase",
    letterSpacing: "1px"
  },
  dialogButtonBar: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    marginTop: "8px"
  },
  // Classic button bar
  dialogButtonBarClassic: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
    marginTop: "12px"
  },

  // --- Section ---
  sectionLabel: {
    fontSize: "14px",
    fontWeight: "600",
    minWidth: "80px",
    flexShrink: "0"
  },
  sectionLabelClassic: {
    fontSize: "13px",
    fontWeight: "400",
    minWidth: "70px",
    flexShrink: "0",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
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
  controlWrapperClassic: {
    display: "flex",
    minHeight: "28px",
    padding: "2px",
    border: "1px solid",
    borderRadius: "0px",
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
  valueDisplayClassic: {
    fontSize: "13px",
    fontWeight: "400",
    minWidth: "45px",
    flexShrink: "0",
    fontFamily: "Courier New, monospace"
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
  selectorClassic: {
    width: "100%",
    height: "100%",
    border: "none",
    borderRadius: "0px",
    outline: "none",
    padding: "0 8px",
    fontSize: "13px",
    fontWeight: "400",
    cursor: "pointer",
    fontFamily: "Courier New, monospace",
    background: "transparent"
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
  textareaClassic: {
    width: "100%",
    minHeight: "80px",
    padding: "6px",
    border: "1px solid",
    borderRadius: "0px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "Courier New, monospace",
    fontSize: "12px",
    resize: "none"
  },

  // --- Slider ---
  sliderContainer: {
    position: "relative",
    height: "40px",
    flexGrow: "1",
    cursor: "pointer"
  },
  sliderContainerClassic: {
    position: "relative",
    height: "32px",
    flexGrow: "1",
    cursor: "pointer",
    border: "1px solid",
    padding: "0 4px"
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
  sliderTrackClassic: {
    position: "absolute",
    top: "50%",
    left: "4px",
    right: "4px",
    height: "2px",
    transform: "translateY(-50%)",
    borderRadius: "0px"
  },
  activeTrack: {
    position: "absolute",
    top: "50%",
    height: "4px",
    transform: "translateY(-50%)",
    borderRadius: "2px",
    pointerEvents: "none"
  },
  activeTrackClassic: {
    position: "absolute",
    top: "50%",
    height: "2px",
    transform: "translateY(-50%)",
    borderRadius: "0px",
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
  sliderThumbClassic: {
    position: "absolute",
    top: "50%",
    width: "12px",
    height: "12px",
    borderRadius: "0px",
    outline: "none",
    transform: "translate(-50%, -50%)",
    cursor: "grab",
    zIndex: "3",
    transition: "none",
    pointerEvents: "none",
    border: "1px solid"
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
  popoverClassic: {
    position: "fixed",
    zIndex: "10000",
    minWidth: "200px",
    maxHeight: "300px",
    overflowY: "auto",
    borderRadius: "0px",
    padding: "4px",
    fontFamily: "Courier New, monospace",
    border: "1px solid"
  },
  popoverTitle: {
    fontSize: "12px",
    fontWeight: "600",
    padding: "4px 8px 6px",
    marginBottom: "4px"
  },
  popoverTitleClassic: {
    fontSize: "11px",
    fontWeight: "400",
    padding: "4px 6px",
    marginBottom: "4px",
    textTransform: "uppercase",
    borderBottom: "1px solid"
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
  popoverItemClassic: {
    padding: "4px 8px",
    borderRadius: "0px",
    fontSize: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "6px",
    transition: "none",
    cursor: "pointer"
  },
  popoverBadge: {
    fontSize: "10px",
    fontWeight: "500",
    padding: "1px 6px",
    borderRadius: "4px",
    flexShrink: "0"
  },
  popoverBadgeClassic: {
    fontSize: "9px",
    fontWeight: "400",
    padding: "1px 4px",
    borderRadius: "0px",
    flexShrink: "0",
    border: "1px solid"
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
  toastClassic: {
    position: "fixed",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "10000",
    padding: "8px 16px",
    borderRadius: "0px",
    fontSize: "13px",
    fontWeight: "400",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 0.2s",
    border: "1px solid",
    fontFamily: "Courier New, monospace"
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
  canvas2dContainerClassic: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
    padding: "6px",
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
  sliderBoxClassic: {
    position: "relative",
    border: "1px solid",
    borderRadius: "0px",
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
  guideLineHClassic: {
    position: "absolute",
    left: "0",
    right: "0",
    height: "4px",
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
  guideLineVClassic: {
    position: "absolute",
    top: "0",
    bottom: "0",
    width: "4px",
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
  guideLineVisualClassic: {
    position: "absolute",
    pointerEvents: "none",
    outline: "none",
    transition: "none"
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
  guidePointClassic: {
    position: "absolute",
    width: "14px",
    height: "14px",
    borderRadius: "0px",
    outline: "none",
    transform: "translate(-50%, 50%)",
    cursor: "grab",
    pointerEvents: "auto",
    zIndex: "10",
    transition: "none",
    border: "1px solid"
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
  },
  coordTooltipClassic: {
    position: "fixed",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: "400",
    borderRadius: "0px",
    pointerEvents: "none",
    zIndex: "10000",
    display: "none",
    whiteSpace: "nowrap",
    fontFamily: "Courier New, monospace",
    border: "1px solid"
  }
};

// ========== 主题样式生成器 ==========

/**
 * 创建主题样式对象
 * 所有颜色值使用 CSS 变量
 * 运行时主题切换
 */
function createThemeStyle(style) {
  const isClassic = style.isClassic;
  
  return {
    // 对话框
    dialog: {
      background: style.color.primary,
      color: style.color.text,
      border: isClassic ? `1px solid ${style.color.border}` : "none",
      borderRadius: style.radius.dialog,
      fontFamily: style.font.ui
    },
    // 遮罩
    overlay: {
      backgroundColor: isClassic
        ? `color-mix(in srgb, ${style.color.shadow} 80%, transparent)`
        : `color-mix(in srgb, ${style.color.shadow} 30%, transparent)`,
      backdropFilter: isClassic ? "none" : "blur(8px)"
    },
    // 按钮
    button: {
      background: style.color.background,
      color: style.color.text,
      border: isClassic ? `1px solid ${style.color.border}` : "none",
      borderRadius: style.radius.md,
      fontFamily: style.font.ui,
      transition: style.transition
    },
    // 输入框
    input: {
      background: style.color.background,
      color: style.color.text,
      border: isClassic ? `1px solid ${style.color.border}` : "none",
      borderRadius: style.radius.md,
      fontFamily: style.font.mono
    }
  }
};

// ========== Factory Functions ==========

/**
 * 获取当前风格配置
 */
function getStyle(theme) {
  return getUIStyle(theme);
};

// --- Base Layout ---

export function createContainer(theme, customStyle = {}) {
  const style = getUIStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-container" + (style.isClassic ? " classic" : " modern");

  // 结构样式（固定）
  Object.assign(el.style, STRUCTURE.container, {
    gap: style.spacing.sm
  });

  // 主题样式（动态）
  el.style.background = style.color.primary;
  el.style.border = style.isClassic ? `1px solid ${style.color.border}` : "none";
  el.style.fontFamily = style.font.ui;

  // 自定义样式（覆盖）
  Object.assign(el.style, customStyle);

  return el
};

// --- Dialog / Overlay ---

export function createOverlay(theme, customStyle = {}) {
  const style = getUIStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-overlay" + (style.isClassic ? " classic" : " modern");
  
  // 结构样式（固定）
  Object.assign(el.style, STRUCTURE.overlay);

  // 主题样式（动态）
  const themeStyle = createThemeStyle(style).overlay;
  Object.assign(el.style, themeStyle);
  
  // 自定义样式（覆盖）
  Object.assign(el.style, customStyle)
  
  return el
}

export function createDialog(theme, customStyle = {}) {
  const style = getUIStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-dialog" + (style.isClassic ? " classic" : " modern");

  // 结构样式(固定)
  Object.assign(el.style, STRUCTURE.dialog, STRUCTURE.dialogStructure);

  // 主题样式(动态)
  const themeStyle = createThemeStyle(style).dialog;
  Object.assign(el.style, themeStyle);

  // 自定义样式(覆盖)
  Object.assign(el.style, customStyle);

  // 标记前端类型
  el.dataset.frontend = style.frontend;
  el.dataset.isClassic = style.isClassic;

  return el
};

export function createDialogTitle(text, theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-dialog-title" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.dialogTitleClassic : STYLE.dialogTitle;
  
  Object.assign(el.style, baseStyle, {
    color: theme.text,
    background: theme.title,
    borderColor: theme.border,
    fontFamily: style.font.ui
  });
  
  el.textContent = text;
  return el;
}

export function createDialogButtonBar() {
  const style = getStyle();
  const el = document.createElement("div");
  el.className = "a1r-dialog-button-bar" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.dialogButtonBarClassic : STYLE.dialogButtonBar;
  Object.assign(el.style, baseStyle);
  
  return el;
}

// --- Buttons ---

export function createButton(label, theme, customStyle) {
  const style = getUIStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-button" + (style.isClassic ? " classic" : " modern");
  
  const themeStyle = createThemeStyle(style).button;
  Object.assign(el.style, themeStyle, {
    flex: "1",
    padding: "4px 12px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: style.isClassic ? "400" : "600",
    textAlign: "center",
    userSelect: "none",
    lineHeight: "1.4",
    minHeight: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box"
  });
  
  el.textContent = label;
  
  // Classic 按压效果
  if (style.isClassic) {
    el.addEventListener("mousedown", () => {
      el.style.transform = "translate(1px, 1px)"
    });
    el.addEventListener("mouseup", () => {
      el.style.transform = "none";
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "none";
    })
  };

  Object.assign(el.style, customStyle);
  
  return el;
}

export function createDialogButton(label, theme, customStyle) {
  const style = getStyle(theme);
  const el = document.createElement("button");
  el.className = "a1r-dialog-button" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.dialogButtonClassic : STYLE.dialogButton;
  
  Object.assign(el.style, baseStyle, {
    background: theme.background,
    color: theme.text,
    borderColor: theme.border,
    fontFamily: style.font.ui
  }, customStyle || {});
  
  el.textContent = label;

  // 标准hover效果
  const hoverOpacity = style.isClassic ? 0.2 : 0.3;

  el.addEventListener("mouseenter", () => {
    if (style.isClassic) {
      el.style.background = hexToRgba(theme.prompt, hoverOpacity);
      el.style.borderColor = theme.prompt
    } else {
      el.style.background = hexToRgba(theme.border, hoverOpacity)
    }
  });

  el.addEventListener("mouseleave", () => {
    el.style.background = theme.background;
    el.style.borderColor = theme.border
  });
  
  // Classic按压效果
  if (style.isClassic) {
    el.addEventListener("mousedown", () => {
      el.style.transform = "translate(1px, 1px)";
    });
    el.addEventListener("mouseup", () => {
      el.style.transform = "none";
    });
  }

  // 添加类型类名供 CSS 选择器使用
  if (customStyle && customStyle.type) {
    el.classList.add(customStyle.type) // 例如 "primary", "danger" 等
  };
  
  return el
};

export function createDashedButton(text, theme, customStyle = {}) {
  const style = getUIStyle(theme);
  const el = document.createElement("button");
  el.className = "a1r-dashed-button" + (style.isClassic ? " classic" : " modern");

  const baseStyle = {
    width: "100%",
    minHeight: style.isClassic ? "36px" : "44px",
    padding: "10px 14px",
    border: "1px dashed",
    borderRadius: style.radius.md,
    opacity: "0.6",
    fontSize: style.isClassic ? "18px" : "20px",
    cursor: "pointer",
    transition: style.transition,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: theme.background,
    color: theme.border,
    borderColor: theme.border,
    outline: "none",
    marginTop: "8px"
  };

  Object.assign(el.style, baseStyle, customStyle);
  el.textContent = text;

  const adapter = new ComfyThemeAdapter();
  adapter.bindElement(el, {
    borderColor: "border",
    background: "background",
    color: "border"
  });

  el.addEventListener("mouseenter", () => {
    el.style.borderColor = theme.text;
    el.style.color = theme.text;
    el.style.opacity = "1"
  });

  el.addEventListener("mouseleave", () => {
    el.style.borderColor = theme.border;
    el.style.color = theme.border;
    el.style.opacity = "0.6"
  });

  el.addEventListener("remove", () => adapter.destroy());

  return el
};

/**
 * 为按钮添加标准 hover 效果
 */
export function addButtonHover(btn, theme, hoverOpacity = 0.25) {
  const style = getStyle(theme);
  
  if (style.isClassic) {
    // Classic: 简单的颜色反转或边框变化
    btn.addEventListener("mouseenter", () => {
      btn.style.background = hexToRgba(theme.prompt, 0.2);
      btn.style.borderColor = theme.prompt;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = theme.background;
      btn.style.borderColor = theme.border;
    });
  } else {
    // Modern: 透明度过渡
    btn.addEventListener("mouseenter", () => {
      btn.style.background = hexToRgba(theme.border, hoverOpacity);
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = theme.background;
    });
  }
}

// --- Section ---

export function createSectionLabel(text, theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-section-label" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.sectionLabelClassic : STYLE.sectionLabel;
  
  Object.assign(el.style, baseStyle, {
    color: theme.text,
    fontFamily: style.font.ui,
    userSelect: "none"
  });
  
  el.textContent = text;
  return el;
}

export function createControlWrapper(theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-control-wrapper" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.controlWrapperClassic : STYLE.controlWrapper;
  
  Object.assign(el.style, baseStyle, {
    background: style.isClassic ? theme.background : theme.background,
    borderColor: theme.border
  });
  
  return el;
}

export function createValueDisplay(value, theme, align = "left") {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-value-display" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.valueDisplayClassic : STYLE.valueDisplay;
  
  Object.assign(el.style, baseStyle, {
    color: theme.text,
    textAlign: align,
    fontFamily: style.font.mono
  });
  
  el.textContent = value;
  return el;
}

export function createSelector(theme) {
  const style = getStyle(theme);
  const el = document.createElement("select");
  el.className = "a1r-selector" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.selectorClassic : STYLE.selector;
  
  Object.assign(el.style, baseStyle, {
    background: style.isClassic ? "transparent" : "transparent",
    color: theme.text,
    fontFamily: style.font.ui
  });
  
  // Classic focus效果
  if (style.isClassic) {
    el.addEventListener("focus", () => {
      el.parentElement.style.borderColor = theme.prompt;
    });
    el.addEventListener("blur", () => {
      el.parentElement.style.borderColor = theme.border;
    });
  }
  
  return el;
}

// --- Textarea ---

export function createTextarea(theme) {
  const style = getStyle(theme);
  const el = document.createElement("textarea");
  el.className = "a1r-textarea" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.textareaClassic : STYLE.textarea;
  
  Object.assign(el.style, baseStyle, {
    background: theme.background,
    color: theme.text,
    borderColor: theme.border,
    fontFamily: style.font.mono
  });
  
  // Focus效果
  // el.addEventListener("focus", () => {
  //   el.style.boxShadow = style.input.focusRing(theme);
  // });
  
  return el;
}

// --- Slider ---

export function createSliderContainer() {
  const style = getStyle();
  const el = document.createElement("div");
  el.className = "a1r-slider-container" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.sliderContainerClassic : STYLE.sliderContainer;
  Object.assign(el.style, baseStyle);
  
  return el;
}

export function createSliderTrack(theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-slider-track" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.sliderTrackClassic : STYLE.sliderTrack;
  
  Object.assign(el.style, baseStyle, {
    background: theme.secondary,
  });
  
  return el;
}

export function createActiveTrack(theme, customStyle) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-active-track" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.activeTrackClassic : STYLE.activeTrack;
  
  Object.assign(el.style, baseStyle, {
    background: theme.border,
  }, customStyle);
  
  return el;
}

export function createSliderThumb(theme, customStyle) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-slider-thumb" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.sliderThumbClassic : STYLE.sliderThumb;
  
  Object.assign(el.style, baseStyle, {
    background: theme.border,
    borderColor: theme.text,
    boxShadow: style.isClassic ? "none" : `0 2px 8px ${hexToRgba(theme.shadow, 0.3)}`,
  }, customStyle);
  
  return el;
}

export function createHiddenSlider(config = {}, customStyle) {
  const style = getStyle();
  const el = document.createElement("input");
  el.className = "a1r-hidden-slider" + (style.isClassic ? " classic" : " modern");
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
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-popover" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.popoverClassic : STYLE.popover;
  
  Object.assign(el.style, baseStyle, {
    background: theme.primary,
    borderColor: theme.secondary,
    boxShadow: style.isClassic ? "2px 2px 0 rgba(0,0,0,0.5)" : `0 8px 24px ${hexToRgba(theme.shadow, 0.45)}`,
    fontFamily: style.font.ui
  });
  
  return el;
}

export function createPopoverTitle(text, theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-popover-title" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.popoverTitleClassic : STYLE.popoverTitle;
  
  Object.assign(el.style, baseStyle, {
    color: hexToRgba(theme.text, 0.5),
    borderColor: theme.secondary
  });
  
  el.textContent = text;
  return el;
}

export function createPopoverItem(theme, options = {}) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-popover-item" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.popoverItemClassic : STYLE.popoverItem;
  
  Object.assign(el.style, baseStyle, {
    fontWeight: options.isCurrent ? (style.isClassic ? "600" : "600") : "400",
    color: options.isCurrent ? hexToRgba(theme.text, 0.4) : theme.text,
    cursor: options.isCurrent ? "default" : "pointer"
  });
  
  // Hover效果
  if (!options.isCurrent) {
    el.addEventListener("mouseenter", () => {
      el.style.background = style.isClassic 
        ? hexToRgba(theme.prompt, 0.2) 
        : hexToRgba(theme.secondary, 0.5);
      if (style.isClassic) el.style.color = theme.prompt;
    });
    el.addEventListener("mouseleave", () => {
      el.style.background = "transparent";
      el.style.color = options.isCurrent ? hexToRgba(theme.text, 0.4) : theme.text;
    });
  }
  
  return el;
}

export function createPopoverBadge(text, theme) {
  const style = getStyle(theme);
  const el = document.createElement("span");
  el.className = "a1r-popover-badge" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.popoverBadgeClassic : STYLE.popoverBadge;
  
  Object.assign(el.style, baseStyle, {
    color: hexToRgba(theme.text, 0.35),
    background: hexToRgba(theme.border, 0.15),
    borderColor: theme.border
  });
  
  el.textContent = text;
  return el;
}

// --- Toast ---

export function createToast(theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-toast" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.toastClassic : STYLE.toast;
  
  Object.assign(el.style, baseStyle, {
    background: theme.primary,
    color: theme.text,
    borderColor: theme.border,
    boxShadow: style.isClassic ? "2px 2px 0 rgba(0,0,0,0.3)" : `0 2px 8px ${hexToRgba(theme.shadow, 0.3)}`,
    fontFamily: style.font.ui
  });
  
  return el
};

/**
 * 显示 Toast 通知
 * @param {string} message  - 显示文本
 * @param {string} type     - 类型（info, success, error）
 * @param {number} duration - 显示时长（ms）
 * @returns {Function}      - 关闭通知的函数
 */
export function showToast(message, type = "success", duration = 2500) {
  const adapter = new ComfyThemeAdapter();
  const theme = adapter.theme;

  const toast = createToast(theme);
  toast.textContent = message;

  if (type === "error") {
    adapter.bindElement(toast, {
      background: (t) => hexToRgba(t.warning, 0.2),
      color: "text"
    })
  } else if (type === "info") {
    adapter.bindElement(toast, {
      background: (t) => hexToRgba(t.prompt, 0.15),
      color: "text"
    })
  };

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  const timer = setTimeout(() => {
    clearTimeout(timer);
    toast.style.opacity = "0";
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
      adapter.destroy()
    }, 300)
  }, duration);
};

// --- 2D Canvas Slider ---

export function createCanvas2dContainer() {
  const style = getStyle();
  const el = document.createElement("div");
  el.className = "a1r-canvas-2d-slider-container" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.canvas2dContainerClassic : STYLE.canvas2dContainer;
  Object.assign(el.style, baseStyle);
  
  return el;
}

export function createSliderBox(theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-slider-box" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.sliderBoxClassic : STYLE.sliderBox;
  
  Object.assign(el.style, baseStyle, {
    background: theme.background,
    borderColor: theme.border,
    boxShadow: style.isClassic ? "inset 0 0 4px rgba(0,0,0,0.5)" : "none"
  });
  
  return el;
}

export function createCanvasGrid(theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-canvas-grid" + (style.isClassic ? " classic" : " modern");
  Object.assign(el.style, STYLE.canvasGrid, {
    boxShadow: `inset 0 0 0 1px ${theme.background}`
  });
  return el;
}

export function createCanvasZone(theme, opacity, zIndex) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-canvas-zone" + (style.isClassic ? " classic" : " modern");
  Object.assign(el.style, STYLE.canvasZone, {
    background: hexToRgba(theme.primary, opacity),
    zIndex: zIndex ?? "1",
    border: style.isClassic ? `1px solid ${hexToRgba(theme.border, 0.3)}` : "none"
  });
  return el;
}

export function createCanvasSelectedArea(theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-canvas-selected-area" + (style.isClassic ? " classic" : " modern");
  Object.assign(el.style, STYLE.canvasZone, {
    background: hexToRgba(theme.border, 0.5),
    zIndex: "3",
    border: style.isClassic ? `1px solid ${theme.border}` : "none"
  });
  return el;
}

export function createGuideLineH() {
  const style = getStyle();
  const el = document.createElement("div");
  el.className = "a1r-guide-line-h" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.guideLineHClassic : STYLE.guideLineH;
  Object.assign(el.style, baseStyle);
  
  return el;
}

export function createGuideLineV() {
  const style = getStyle();
  const el = document.createElement("div");
  el.className = "a1r-guide-line-v" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.guideLineVClassic : STYLE.guideLineV;
  Object.assign(el.style, baseStyle);
  
  return el;
}

export function createGuideLineHVisual(theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-guide-line-h-visual" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.guideLineVisualClassic : STYLE.guideLineVisual;
  
  Object.assign(el.style, baseStyle, STYLE.guideLineHVisual, {
    background: theme.border
  });
  
  return el;
}

export function createGuideLineVVisual(theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-guide-line-v-visual" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.guideLineVisualClassic : STYLE.guideLineVisual;
  
  Object.assign(el.style, baseStyle, STYLE.guideLineVVisual, {
    background: theme.border
  });
  
  return el;
}

export function createGuidePoint(theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-guide-point" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.guidePointClassic : STYLE.guidePoint;
  
  Object.assign(el.style, baseStyle, {
    background: theme.border,
    borderColor: theme.text,
    boxShadow: style.isClassic ? "none" : `0 2px 8px ${hexToRgba(theme.shadow, 0.3)}`
  });
  
  return el;
}

export function createCoordTooltip(theme) {
  const style = getStyle(theme);
  const el = document.createElement("div");
  el.className = "a1r-coord-tooltip" + (style.isClassic ? " classic" : " modern");
  
  const baseStyle = style.isClassic ? STYLE.coordTooltipClassic : STYLE.coordTooltip;
  
  Object.assign(el.style, baseStyle, {
    background: theme.primary,
    color: theme.text,
    borderColor: theme.border,
    boxShadow: style.isClassic ? "2px 2px 0 rgba(0,0,0,0.3)" : `0 2px 8px ${hexToRgba(theme.shadow, 0.3)}`,
    fontFamily: style.font.mono
  });
  
  return el
};

// ========== 动态主题更新支持 ==========

/**
 * 更新已有元素的主题样式
 * 用于主题切换时无需重建 DOM
 */
export function updateElementTheme(el, theme) {
  if (!el || !el.className.includes("a1r-")) return;

  const style = getUIStyle(theme);
  const classList = el.classList;

  el.dataset.frontend = style.frontend;
  el.dataset.isClassic = style.isClassic;

  if (style.isClassic) {
    classList.remove("modern");
    classList.add("classic")
  } else {
    classList.remove("classic");
    classList.add("modern")
  };

  if (classList.contains("a1r-dialog")) {
    const newStyle = createThemeStyle(style).dialog;
    Object.assign(el.style, newStyle)
  } else if (classList.contains("a1r-overlay")) {
    const newStyle = createThemeStyle(style).overlay;
    Object.assign(el.style, newStyle)
  }
  // ... 其他类型类似处理
};

// ========== Namespace Export ==========

/**
 * custom — 自定义 DOM 样式工厂（布局、对话框、滑块、弹出菜单、2D Canvas等）
 * 自动根据当前前端类型（Modern/Classic）应用对应视觉风格
 */
export const custom = {
  // Layout
  container: createContainer,
  // Buttons
  button: createButton,
  dialogButton: createDialogButton,
  dashedButton: createDashedButton,
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
  coordTooltip: createCoordTooltip,
  // 动态更新
  updateTheme: updateElementTheme
};

// =====================================
// ========== 官方 Widget 封装 ==========
// =====================================

/**
 * ui — 封装 ComfyUI 官方 node.addWidget / addDOMWidget API
 *
 * 所有方法返回 LiteGraph widget 对象，在 Nodes 2.0 (Vue) 模式下
 * 自动渲染为与官方完全一致的 Vue 组件样式。
 *
 * 类型映射：
 * number → WidgetInputNumber / WidgetInputSlider (根据前端类型自动选择)
 * combo → WidgetSelect
 * toggle → WidgetToggleSwitch
 * text → WidgetInputText
 * textarea→ WidgetTextarea (DOM widget)
 *
 * @example
 * import { ui } from "../style.js";
 * const w = ui.addNumber(node, "my_num", 0, (v) => console.log(v), { min: 0, max: 100 });
 */
export const ui = {
  /**
   * 创建数字输入控件
   * 自动根据前端类型选择合适组件：Classic使用Slider，Modern使用Number
   * @param {Object} node - LiteGraph 节点
   * @param {string} name - widget 名称
   * @param {number} value - 默认值
   * @param {Function} callback - 值变更回调 (value) => void
   * @param {Object} [options] - { min, max, step, precision }
   * @returns {IBaseWidget}
   */
  addNumber(node, name, value, callback, options = {}) {
    const frontend = getEffectiveFrontendType();
    const isClassic = frontend === FRONTEND_TYPE.LITEGRAPH;
    const step = options.step ?? 1;
    
    // Classic前端偏好使用Slider，Modern前端使用Number输入
    const useSlider = isClassic || options.isSlider;
    
    const finalOptions = {
      min: options.min ?? -999999,
      max: options.max ?? 999999,
      step: step * 10, // LiteGraph legacy 约定
      step2: step, // 实际步长
      precision: options.precision ?? (step < 1 ? Math.max(2, -Math.floor(Math.log10(step))) : 0),
      // 根据前端类型选择组件
      component: useSlider ? "WidgetInputSlider" : "WidgetInputNumber",
      ...options
    };

    const widgetType = useSlider ? "slider" : "number";
    const widget = node.addWidget(widgetType, name, value, callback, finalOptions);

    widget.component = finalOptions.component;
    widget.widget_type = finalOptions.widget_type || widgetType;
    
    // 标记前端类型，供后续使用
    widget._a1rFrontendType = frontend;
    widget._a1rIsClassic = isClassic;

    return widget;
  },

  /**
   * 创建下拉选择控件
   * @param {Object} node - LiteGraph 节点
   * @param {string} name - widget 名称
   * @param {*} value - 默认值
   * @param {Function} callback - 值变更回调
   * @param {Object} [options] - { values: string[] | () => string[] }
   * @returns {IBaseWidget}
   */
  addCombo(node, name, value, callback, options = {}) {
    const frontend = getEffectiveFrontendType();
    const isClassic = frontend === FRONTEND_TYPE.LITEGRAPH;
    const rawValues = options.values;
    
    const widget = node.addWidget("combo", name, value, callback, {
      values: typeof rawValues === "function" ? rawValues() : rawValues || [],
      component: isClassic ? "WidgetSelect" : "WidgetSelect", // 保持使用Select
      ...options,
    });
    
    widget._a1rFrontendType = frontend;
    widget._a1rIsClassic = isClassic;
    
    return widget;
  },

  /**
   * 创建开关控件
   * @param {Object} node - LiteGraph 节点
   * @param {string} name - widget 名称
   * @param {boolean} value - 默认值
   * @param {Function} callback - 值变更回调
   * @param {Object} [options] - { on, off }
   * @returns {IBaseWidget}
   */
  addToggle(node, name, value, callback, options = {}) {
    const frontend = getEffectiveFrontendType();
    const isClassic = frontend === FRONTEND_TYPE.LITEGRAPH;
    
    const widget = node.addWidget("toggle", name, !!value, callback, {
      on: options.on || "ON",
      off: options.off || "OFF",
      component: "WidgetToggleSwitch",
      ...options,
    });
    
    widget._a1rFrontendType = frontend;
    widget._a1rIsClassic = isClassic;
    
    return widget;
  },

  /**
   * 创建单行文本输入控件
   * @param {Object} node - LiteGraph 节点
   * @param {string} name - widget 名称
   * @param {string} value - 默认值
   * @param {Function} callback - 值变更回调
   * @param {Object} [options] - 附加选项
   * @returns {IBaseWidget}
   */
  addText(node, name, value, callback, options = {}) {
    const frontend = getEffectiveFrontendType();
    const isClassic = frontend === FRONTEND_TYPE.LITEGRAPH;
    
    const widget = node.addWidget("text", name, value ?? "", callback, {
      component: "WidgetInputText",
      ...options,
    });
    
    widget._a1rFrontendType = frontend;
    widget._a1rIsClassic = isClassic;
    
    return widget;
  },

  /**
   * 创建多行文本输入控件（DOM widget）
   * @param {Object} node - LiteGraph 节点
   * @param {string} name - widget 名称
   * @param {string} value - 默认值
   * @param {Function} callback - 值变更回调
   * @param {Object} [options] - { rows, minHeight, hideOnZoom }
   * @returns {IBaseWidget}
   */
  addTextarea(node, name, value, callback, options = {}) {
    const frontend = getEffectiveFrontendType();
    const isClassic = frontend === FRONTEND_TYPE.LITEGRAPH;
    
    const textarea = document.createElement("textarea");
    textarea.value = value ?? "";
    textarea.style.width = "100%";
    textarea.style.minHeight = options.minHeight || (isClassic ? "32px" : "40px");
    textarea.style.resize = isClassic ? "none" : "vertical";
    textarea.style.boxSizing = "border-box";
    textarea.style.fontFamily = isClassic ? "Courier New, monospace" : "monospace";
    textarea.style.fontSize = isClassic ? "12px" : "13px";
    textarea.style.padding = isClassic ? "4px" : "8px";
    textarea.style.border = isClassic ? "1px solid #666" : "none";
    textarea.style.borderRadius = isClassic ? "0px" : "4px";
    
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
      return [width, options.height || (isClassic ? 40 : 56)];
    };
    
    widget._a1rFrontendType = frontend;
    widget._a1rIsClassic = isClassic;
    
    return widget;
  },

  /**
   * 根据 widgetInfo 自动选择合适的控件类型创建 widget
   * @param {Object} node - LiteGraph 节点
   * @param {string} name - widget 名称（显示用 widgetId）
   * @param {Object} widgetInfo - { type, value, options }
   * @param {Function} callback - 值变更回调
   * @param {Object} [extra] - 附加选项（会合并到 widget options）
   * @returns {IBaseWidget}
   */
  addAuto(node, name, widgetInfo, callback, extra = {}) {
    const frontend = getEffectiveFrontendType();
    const isClassic = frontend === FRONTEND_TYPE.LITEGRAPH;
    
    const t = (widgetInfo.type || "text").toLowerCase();
    const opts = { ...widgetInfo.options, component: widgetInfo.component, ...extra };

    // Classic前端偏好使用Slider替代Number
    if (isClassic && (t === "number" || t === "knob") && !opts.forceNumber) {
      return ui.addNumber(node, name, widgetInfo.value, callback, {
        ...opts,
        isSlider: true,
        component: "WidgetInputSlider"
      });
    }

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
