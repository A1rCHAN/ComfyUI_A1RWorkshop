/**
 * A1R Workshop - 统一对话框工厂
 * 基于 CSS Variables， 支持动态主题切换
 * 支持双前端架构（Vue/Nodes 2.0 和 Classic/LiteGraph）
 * 提供标准化的对话框创建、管理和主题适配
 */

import { ComfyThemeAdapter, STYLE_PRESETS } from "./adapter.js";
import { custom } from "./style.js";
import { FRONTEND_TYPE, hexToRgba } from "./theme.js";

// ========== 对话框类型常量 ==========

export const DIALOG_TYPE = {
  STANDARD: "standard", // 标准对话框
  FORM: "form", // 表单对话框（带输入区）
  LIST: "list", // 列表选择对话框
  CONFIRM: "confirm", // 确认对话框
  CUSTOM: "custom", // 完全自定义内容
};

// ========== 对话框配置预设 ==========

const DIALOG_PRESETS = {
  [DIALOG_TYPE.STANDARD]: {
    width: { modern: "500px", classic: "400px" },
    maxWidth: "90vw",
    maxHeight: { modern: "85vh", classic: "90vh" },
    showCloseButton: true,
    showOverlay: true,
    closeOnOverlayClick: true,
    closeOnEsc: true,
  },
  [DIALOG_TYPE.FORM]: {
    width: { modern: "500px", classic: "400px" },
    maxWidth: "90vw",
    maxHeight: { modern: "80vh", classic: "85vh" },
    showCloseButton: true,
    showOverlay: true,
    closeOnOverlayClick: false, // 表单防止误触关闭
    closeOnEsc: true,
  },
  [DIALOG_TYPE.LIST]: {
    width: { modern: "480px", classic: "380px" },
    maxWidth: "90vw",
    maxHeight: { modern: "70vh", classic: "75vh" },
    showCloseButton: true,
    showOverlay: true,
    closeOnOverlayClick: true,
    closeOnEsc: true,
  },
  [DIALOG_TYPE.CONFIRM]: {
    width: { modern: "400px", classic: "320px" },
    maxWidth: "90vw",
    maxHeight: "auto",
    showCloseButton: false,
    showOverlay: true,
    closeOnOverlayClick: false,
    closeOnEsc: false,
  },
};

// ========== 对话框管理器 ==========

class DialogManager {
  constructor() {
    this.activeDialogs = new Map();
    this.dialogCounter = 0;
  }

  // 注册活动对话框
  register(dialog) {
    const id = `dialog_${++this.dialogCounter}`;
    this.activeDialogs.set(id, dialog);
    return id;
  }

  // 注销对话框
  unregister(id) {
    this.activeDialogs.delete(id);
  }

  // 关闭所有活动对话框
  closeAll() {
    this.activeDialogs.forEach((dialog) => {
      if (dialog.close && !dialog._isClosing) dialog.close(false);
    });
    this.activeDialogs.clear();
  }

  // 获取最顶层的对话框
  getTopDialog() {
    const entries = Array.from(this.activeDialogs.entries());
    return entries.length > 0 ? entries[entries.length - 1][1] : null;
  }
}

// 全局对话框管理器实例
export const dialogManager = new DialogManager();

// ========== 对话框构建器类 ==========

export class DialogBuilder {
  constructor(type = DIALOG_TYPE.STANDARD) {
    this.type = type;
    this.config = { ...DIALOG_PRESETS[type] };
    this.title = "";
    this.content = null;
    this.buttons = [];
    this._onClose = null;
    this._onOpen = null;
    this.customStyles = {};
    this._adapter = null;
    this._elements = {};
    this._resolve = null;
    this._reject = null;
    this._isOpen = false;
    this._isClosing = false;
    this._dialogId = null;
    this._cleanupFns = [];
    this.autoFocus = true
  };

  // ========== 链式配置方法 ==========

  /**
   * 设置对话框标题
   */
  setTitle(title) {
    this.title = title;
    return this;
  };

  /**
   * 设置对话框内容（DOM元素或HTML字符串）
   */
  setContent(content) {
    if (typeof content === 'string') {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = content;
      this.content = wrapper;
    } else {
      this.content = content;
    }
    return this;
  };

  /**
   * 添加按钮
   * @param {string} label - 按钮文本
   * @param {string} type - 按钮类型：'primary' | 'secondary' | 'danger' | 'default'
   * @param {Function} onClick - 点击回调，返回true则关闭对话框
   * @param {Object} options - 额外选项 { disabled, autoFocus, style }
   */
  addButton(label, type = 'default', onClick = null, options = {}) {
    this.buttons.push({ label, type, onClick, options });
    return this;
  };

  /**
   * 添加标题栏自定义按钮
   */
  addCustomHeaderButton(label, type, onClick) {
    this.customHeaderButtons = this.customHeaderButtons || [];
    this.customHeaderButtons.push({ label, type, onClick });
    return this;
  };

  /**
   * 设置对话框尺寸
   */
  setSize(width, maxWidth = null, maxHeight = null) {
    if (width) this.config.width = { modern: width, classic: width };
    if (maxWidth) this.config.maxWidth = maxWidth;
    if (maxHeight) this.config.maxHeight = { modern: maxHeight, classic: maxHeight };
    return this;
  };

  /**
   * 设置是否显示关闭按钮
   */
  setCloseButton(show) {
    this.config.showCloseButton = show;
    return this;
  };

  /**
   * 设置点击遮罩层是否关闭
   */
  setCloseOnOverlayClick(close) {
    this.config.closeOnOverlayClick = close;
    return this;
  };

  /**
   * 设置ESC键是否关闭
   */
  setCloseOnEsc(close) {
    this.config.closeOnEsc = close;
    return this;
  };

  /**
   * 添加自定义样式
   */
  addStyle(selector, styles) {
    this.customStyles[selector] = styles;
    return this;
  };

  /**
   * 设置打开回调
   */
  onOpen(callback) {
    this._onOpen = callback;
    return this
  };

  /**
   * 设置关闭回调
   */
  onClose(callback) {
    this._onClose = callback;
    return this
  };

  /**
   * 设置自动聚焦
   */
  setAutoFocus(flag) {
    this.autoFocus = !!flag;
    return this
  };

  // ========== 构建方法 ==========

  /**
   * 构建并打开对话框
   * @returns {Promise} 返回Promise，resolve时传入结果
   */
  open() {
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
      this._build();
      this._registerEvents();
      this._show();

      if (this._onOpen) {
        this._onOpen(this._elements.dialog);
      }
    });
  };

  /**
   * 关闭对话框
   * @param {*} result - 传递给resolve的结果
   */
  close(result = null) {
    if (this._isClosing || !this._isOpen) return;
    this._isClosing = true;

    // 执行清理函数
    this._cleanupFns.forEach(fn => {
      try { fn(); } catch (e) { console.warn('[Dialog] Cleanup error:', e); }
    });
    this._cleanupFns = [];

    // 执行关闭回调
    if (this._onClose) {
      this._onClose(result);
    };

    // 销毁适配器
    if (this._adapter) {
      this._adapter.destroy();
      this._adapter = null;
    };

    // 移除DOM
    if (this._elements.overlay && this._elements.overlay.parentNode) {
      this._elements.overlay.parentNode.removeChild(this._elements.overlay);
    };

    // 注销管理器
    if (this._dialogId) {
      dialogManager.unregister(this._dialogId);
    };

    this._isOpen = false;
    this._isClosing = false;

    // 解析Promise
    if (this._resolve) {
      this._resolve(result);
    }
  };

  /**
   * 获取对话框DOM元素（用于外部操作）
   */
  getElement() {
    return this._elements.dialog;
  };

  /**
   * 获取内容容器（用于动态添加内容）
   */
  getContentContainer() {
    return this._elements.content;
  };

  /**
   * 获取按钮容器
   */
  getButtonContainer() {
    return this._elements.buttonBar;
  };

  // ========== 私有构建方法 ==========
  _build() {
    this._adapter = new ComfyThemeAdapter();
    const theme = this._adapter.theme;
    const isClassic = this._adapter.isClassic;

    // --- 遮罩层 ---
    const overlay = custom.overlay(theme);
    this._elements.overlay = overlay;

    // --- 对话框 ---
    const dialog = custom.dialog(theme);
    // 只设置布局相关结构属性，不覆盖主题样式
    const layoutStyle = {
      width: this._getConfigValue("width", isClassic),
      maxWidth: this.config.maxWidth
    };
    const maxHeight = this._getConfigValue("maxHeight", isClassic);
    if (maxHeight !== "auto") { layoutStyle.maxHeight = maxHeight };

    // 使用Object.assign合并，保留custom.dialog的样式
    Object.assign(dialog.style, layoutStyle);

    this._elements.dialog = dialog;

    // --- 内部组件 ---
    this._buildTitleBar(theme, isClassic);
    this._buildContent(theme, isClassic);
    this._buildButtonBar(theme, isClassic);

    dialog.appendChild(this._elements.titleBar);
    dialog.appendChild(this._elements.content);
    if (this.buttons.length > 0) { dialog.appendChild(this._elements.buttonBar) };
    overlay.appendChild(dialog);

    this._applyCustomStyles();

    this._dialogId = dialogManager.register(this);

    // 注册主题变化监听（用于非颜色类样式的更新）
    this._setupThemeListener();
  }

  _buildTitleBar(theme, isClassic) {
    const titleBar = document.createElement("div");

    // 结构样式
    const horizontalPadding = isClassic ? "12px" : "20px";
    const verticalPadding = isClassic ? "6px" : "10px";

    Object.assign(titleBar.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: `${verticalPadding} ${horizontalPadding}`,
      position: "relative"
    });

    titleBar.style.borderRadius = isClassic ? "0" : "20px 20px 0 0";

    this._adapter.bindElement(titleBar, { background: "title", color: "text" });

    // 标题文本
    const titleText = document.createElement("span");
    titleText.textContent = this.title;
    Object.assign(titleText.style, {
      fontSize: isClassic ? "14px" : "16px",
      fontWeight: isClassic ? "400" : "600",
      fontFamily: isClassic ? "Courier New, monospace" : "system-ui",
      userSelect: "none",
      cursor: "default"
    });

    if (isClassic) {
      titleText.style.textTransform = "uppercase";
      titleText.style.letterSpacing = "1px"
    };

    titleBar.appendChild(titleText);

    const titleControls = document.createElement("div");
    titleControls.style.cssText = "display: flex; align-items: center; gap: 8px;";

    if (this.customHeaderButtons && this.customHeaderButtons.length > 0) {
      this.customHeaderButtons.forEach((btnConfig) => {
        const btn = this._createHeaderButton(btnConfig, theme, isClassic);
        titleControls.appendChild(btn)
      })
    };

    // 关闭按钮
    if (this.config.showCloseButton) {
      const closeBtn = this._createCloseButton(theme, isClassic);
      titleControls.appendChild(closeBtn)
    };

    titleBar.appendChild(titleControls);
    this._elements.titleBar = titleBar;
    this._elements.titleText = titleText
  };

  _createHeaderButton(config, theme, isClassic) {
    const btn = custom.dialogButton(config.label, theme);

    Object.assign(btn.style, {
      padding: "6px 14px",
      fontSize: "12px",
      minWidth: "70px",
      flexShrink: "0"
    });

    if (config.type === "primary") {
      this._adapter.bindElement(btn, {
        background: (t) => hexToRgba(t.prompt, 0.2),
        color: "text",
        border: (t, ft) => ft === FRONTEND_TYPE.LITEGRAPH ? `1px solid ${t.prompt}` : "none"
      })
    } else if (config.type === "danger") {
      this._adapter.bindElement(btn, {
        background: (t) => hexToRgba(t.warning, 0.2),
        color: "text"
      })
    } else {
      this._adapter.bindElement(btn, {
        background: "background",
        color: "text"
      })
    };

    btn.addEventListener("click", (e) => {
      if (config.onClick) {
        const result = config.onClick(e, this);

        if (result === true) {
          this.close(null)
        }
      }
    });

    return btn
  };

  _createCloseButton(theme, isClassic) {
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "X";

    // 结构样式
    Object.assign(closeBtn.style, {
      background: "transparent",
      fontSize: isClassic ? "16px" : "20px",
      cursor: "pointer",
      padding: isClassic ? "2px 6px" : "0 4px",
      lineHeight: "1",
      opacity: "0.6",
      borderRadius: isClassic ? "0" : "4px",
      fontFamily: isClassic ? "Courier New, monospace" : "system-ui"
    });

    // 主题样式
    closeBtn.style.border = isClassic ? `1px solid var(--a1r-border)` : "none";
    closeBtn.style.color = "var(--a1r-text)";

    // 交互效果
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.opacity = "1";
      if (isClassic) {
        closeBtn.style.borderColor = "var(--a1r-accent)";
      }
    });

    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.opacity = "0.6";
      if (isClassic) {
        closeBtn.style.borderColor = "var(--a1r-border)";
      }
    });

    closeBtn.addEventListener("click", () => this.close(null));

    return closeBtn;
  };
  
  _buildContent(theme, isClassic) {
    const content = document.createElement("div");
    const horizontalPadding = isClassic ? "12px" : "20px";
    const verticalPadding = isClassic ? "12px" : "16px";
    Object.assign(content.style, {
      flexGrow: "1",
      padding: `${verticalPadding} ${horizontalPadding}`,
      display: "flex",
      flexDirection: "column",
      gap: isClassic ? "12px" : "16px",
    });

    if (this.content) {
      if (typeof this.content === "string") { content.innerHTML = this.content }
      else { content.appendChild(this.content) }
    };

    this._elements.content = content;
  };

  // 按钮栏构建
  _buildButtonBar(theme, isClassic) {
    const buttonBar = document.createElement("div");

    Object.assign(buttonBar.style, {
      display: "flex",
      gap: isClassic ? "8px" : "12px",
      justifyContent: "flex-end",
      padding: isClassic ? "6px 12px" : "8px 16px",
      borderTop: isClassic ? "1px solid var(--a1r-border)" : "none"
    });

    this.buttons.forEach((btnConfig, index) => {
      const btn = this._createButton(btnConfig, theme, isClassic, index === this.buttons.length - 1);
      buttonBar.appendChild(btn);
    });

    this._elements.buttonBar = buttonBar
  }

  _createButton(config, theme, isClassic, isLast) {
    const btn = custom.dialogButton(config.label, theme, { type: config.type });

    // 布局样式
    if (config.options.fullWidth) {
      btn.style.flex = "1";
    } else { btn.style.flex = "0 0 auto" };

    if (isClassic) {
      btn.style.minWidth = "60px";
    }

    // 主题样式绑定
    if (config.type === "primary") {
      this._adapter.bindElement(btn, {
        background: (t) => hexToRgba(t.prompt, 0.2),
        color: "text",
        border: (t, ft) => ft === FRONTEND_TYPE.LITEGRAPH ? `1px solid ${t.prompt}` : "none"
      })
    } else if (config.type === "danger") {
      this._adapter.bindElement(btn, {
        background: (t) => hexToRgba(t.warning, 0.2),
        color: "text"
      })
    } else {
      this._adapter.bindElement(btn, {
        background: "background",
        color: "text"
      })
    };

    // Classic 按压效果
    if (isClassic) {
      btn.addEventListener("mousedown", () => {
        btn.style.transform = "translate(1px, 1px)"
      });
      btn.addEventListener("mouseup", () => {
        btn.style.transform = "none"
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "none"
      })
    };

    // 状态
    if (config.options.disabled) {
      btn.disabled = true;
      btn.style.opacity = "0.4";
      btn.style.cursor = "not-allowed"
    };

    if (config.options.autoFocus) {
      setTimeout(() => {
        btn.focus()
      }, 100)
    };

    // 点击事件
    btn.addEventListener("click", (e) => {
      if (config.onClick) {
        const result = config.onClick(e, this);
        if (result !== false) { this.close(result) }
      } else {
        this.close(config.label)
      }
    });

    // 应用自定义样式
    if (config.options.style) {
      Object.assign(btn.style, config.options.style)
    };

    return btn
  };

  /**
   * 设置主题变化监听
   * 用于处理非颜色类样式更新（如圆角、字体等）
   */
  _setupThemeListener() {
    const unbindTheme = this._adapter.onThemeChange((newTheme, themeName, frontendType) => {
      const newIsClassic = frontendType === FRONTEND_TYPE.LITEGRAPH;
      
      if (this._isClassic !== newIsClassic) {
        this._rebuildForFrontendChange(newIsClassic)
      }
    });

    this._cleanupFns.push(unbindTheme)
  };

  /**
   * 前端类型变化时重建
   */
  _rebuildForFrontendChange(isClassic) {
    // 更新对话框圆角
    const dialog = this._elements.dialog;
    dialog.style.borderRadius = isClassic ? "0" : "20px";

    // 更新标题栏
    const titleBar = this._elements.titleBar;
    titleBar.style.borderRadius = isClassic ? "0" : "20px 20px 0 0";

    // 更新内边距
    const hPadding = isClassic ? "12px" : "20px";
    const vPadding = isClassic ? "6px" : "10px";
    titleBar.style.padding = `${vPadding} ${hPadding}`;

    // 更新标题样式
    const titleText = this._elements.titleText;
    titleText.style.fontSize = isClassic ? "14px" : "16px";
    titleText.style.fontWeight = isClassic ? "400" : "600";
    titleText.style.fontFamily = isClassic ? "Courier New, monospace" : "system-ui";
    titleText.style.textTransform = isClassic ? "uppercase" : "none";
    titleText.style.letterSpacing = isClassic ? "1px" : "normal";

    // 更新内容区域
    const content = this._elements.content;
    content.style.padding = `${isClassic ? "12px" : "16px"} ${isClassic ? "12px" : "20px"}`;
    content.style.gap = isClassic ? "12px" : "24px";

    // 更新按钮栏
    const buttonBar = this._elements.buttonBar;
    buttonBar.style.padding = `${isClassic ? "6px" : "8px"} ${isClassic ? "12px" : "16px"}`;
    buttonBar.style.gap = isClassic ? "8px" : "12px";
    buttonBar.style.borderTop = isClassic ? "1px solid var(--a1r-border)" : "none"
  };

  _getConfigValue(key, isClassic) {
    const value = this.config[key];
    if (typeof value === "object" && value !== null) {
      return isClassic ? value.classic || value.modern : value.modern || value.classic
    };
    return value
  };

  _applyCustomStyles() {
    Object.entries(this.customStyles).forEach(([selector, styles]) => {
      const element =
        selector === "dialog"
          ? this._elements.dialog
          : selector === "content"
          ? this._elements.content
          : selector === "overlay"
          ? this._elements.overlay
          : this._elements.dialog.querySelector(selector);
      if (element) Object.assign(element.style, styles)
    })
  };

  _registerEvents() {
    if (this.config.closeOnOverlayClick) {
      this._elements.overlay.addEventListener("click", (e) => {
        if (e.target === this._elements.overlay) this.close(null)
      })
    };

    if (this.config.closeOnEsc) {
      const escHandler = (e) => {
        if (e.key === "Escape") {
          this.close(null);
          document.removeEventListener("keydown", escHandler)
        }
      };
      document.addEventListener("keydown", escHandler);
      this._cleanupFns.push(() => document.removeEventListener("keydown", escHandler))
    };

    // 主题变化
    const unbindTheme = this._adapter.onThemeChange((newTheme) => {
      // 主题已自动更新，这里可以执行额外逻辑
    });
    this._cleanupFns.push(unbindTheme);

    // 前端类型变化
    const unbindFrontend = this._adapter.onFrontendChange((type, theme) => {
      // 前端类型变化时，可以选择重新构建或调整样式
      console.log(`[Dialog] Frontend changed to: ${type}`)
    });
    this._cleanupFns.push(unbindFrontend)
  };

  _show() {
    document.body.appendChild(this._elements.overlay);
    this._isOpen = true;

    if (this.autoFocus) {
      setTimeout(() => {
        const focusable =
          this._elements.dialog.querySelector(
            "button:not([disabled]), input, textarea, select"
          );
        if (focusable) focusable.focus()
      }, 50)
    }
  };

  close(result = null) {
    if (this._isClosing || !this._isOpen) return;
    this._isClosing = true;

    // 执行清理函数
    this._cleanupFns.forEach(fn => {
      try { fn(); } catch (e) { console.warn('[Dialog] Cleanup error:', e) }
    });

    this._cleanupFns = [];

    if (this._onClose) {
      this._onClose(result)
    };

    // 销毁适配器
    if (this._adapter) {
      this._adapter.destroy();
      this._adapter = null
    };

    // 移除DOM
    if (this._elements.overlay?.parentNode) {
      this._elements.overlay.parentNode.removeChild(this._elements.overlay)
    };

    if (this._dialogId) {
      dialogManager.unregister(this._dialogId)
    };

    this._isOpen = false;
    this._isClosing = false;

    if (this._resolve) {
      this._resolve(result)
    }
  }
};

// ========== 便捷工厂函数 ==========

/**
 * 创建标准对话框
 */
export function createDialog(title, content, buttons = []) {
  const builder = new DialogBuilder(DIALOG_TYPE.STANDARD).setTitle(title).setContent(content);
  buttons.forEach((btn) => builder.addButton(btn.label, btn.type, btn.onClick, btn.options));
  return builder
};

/**
 * 创建表单对话框
 */
export function createFormDialog(title, formContent, onSubmit, onCancel = null) {
  const builder = new DialogBuilder(DIALOG_TYPE.FORM).setTitle(title).setContent(formContent).setCloseOnOverlayClick(false);
  if (onCancel) builder.addButton("Cancel", "secondary", onCancel);
  builder.addButton("Submit", "primary", onSubmit, { autoFocus: false });
  return builder
};

/**
 * 创建确认对话框
 */
export function createConfirmDialog(title, message, onConfirm, onCancel = null) {
  const content = document.createElement("div");
  content.textContent = message;
  content.style.cssText = "padding: 20px 0; font-size: 14px; line-height: 1.5;";

  const builder = new DialogBuilder(DIALOG_TYPE.CONFIRM).setTitle(title).setContent(content);
  if (onCancel !== false) builder.addButton(onCancel?.label || "Cancel", "secondary", onCancel?.onClick || (() => false));
  builder.addButton(onConfirm?.label || "Confirm", onConfirm?.type || "primary", onConfirm?.onClick || (() => true), { autoFocus: true, fullWidth: false });
  return builder
};

/**
 * 创建列表选择对话框
 */
export function createListDialog(title, items, onSelect, options = {}) {
  const content = document.createElement("div");
  content.style.cssText = "display: flex; flex-direction: column; gap: 4px;";

  items.forEach((item) => {
    const row = document.createElement("div");
    row.style.cssText = `padding: 10px 12px; cursor: pointer; border-radius: ${options.rounded ? "6px" : "0"}; transition: background 0.15s; display: flex; align-items: center; justify-content: space-between;`;
    row.textContent = typeof item === "string" ? item : item.label;

    if (typeof item !== "string" && item.description) {
      const desc = document.createElement("span");
      desc.textContent = item.description;
      desc.style.cssText = "opacity: 0.6; font-size: 12px;";
      row.appendChild(desc)
    };

    row.addEventListener("mouseenter", () => {
      row.style.background = hexToRgba(options.hoverColor || "#5fa5fa", 0.1)
    });
    row.addEventListener("mouseleave", () => {
      row.style.background = "transparent"
    });
    row.addEventListener("click", () => {
      const result = typeof item === "string" ? item : item.value;
      const builder = content._dialogBuilder;
      if (builder) builder.close(result)
    });

    content.appendChild(row);
  });

  // 标记builder引用供点击事件使用
  content._dialogBuilder = null;

  const builder = new DialogBuilder(DIALOG_TYPE.LIST).setTitle(title).setContent(content);
  content._dialogBuilder = builder;
  if (options.showCancel !== false) builder.addButton("Cancel", "secondary", () => null);
  return builder
};

/**
 * 兼容旧版showCanvasSettingDialog的包装
 */
export function showCanvasSettingDialog({ currentMin, currentMax, currentStep }) {
  return new Promise((resolve) => {
    const content = document.createElement("div");

    const rangeSection = document.createElement("div");
    rangeSection.style.marginBottom = "24px";

    const rangeRow = document.createElement("div");
    rangeRow.style.cssText = "display: flex; gap: 8px; padding: 4px 8px; align-items: center;";

    const rangeLabel = document.createElement("div");
    rangeLabel.textContent = "range";
    rangeLabel.style.cssText = "font-size: 14px; font-weight: 600; min-width: 80px;";

    const rangeControlWrapper = document.createElement("div");
    rangeControlWrapper.style.cssText = "display: flex; min-height: 32px; padding: 2px 4px; border-radius: 6px; align-items: center; gap: 0; flex-grow: 1;";

    // ... (保留原有的滑块创建逻辑，但使用DialogBuilder管理生命周期)
    content.appendChild(rangeSection);

    const builder = new DialogBuilder(DIALOG_TYPE.FORM)
      .setTitle("Canvas Setting")
      .setContent(content)
      .setCloseOnOverlayClick(false)
      .addButton("Cancel", "secondary", () => null)
      .addButton(
        "Apply",
        "primary",
        () => ({ min: currentMin, max: currentMax, step: currentStep }),
        { autoFocus: true }
      );

    builder.open().then(resolve)
  })
};

export default {
  DialogBuilder,
  DIALOG_TYPE,
  dialogManager,
  createDialog,
  createFormDialog,
  createConfirmDialog,
  createListDialog,
  showCanvasSettingDialog,
}
