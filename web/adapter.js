/**
 * ComfyUI 主题适配器
 * 基于 theme.js 的配色系统，自动跟踪主题变化并更新绑定元素的样式。
 * 所有实例共享同一个全局 watcher，避免重复的 MutationObserver / setInterval。
 *
 * styleMap 支持三种映射格式：
 *   字符串:  { "background": "primary" }         → el.style.background = theme.primary
 *   数组:    { "background": ["shadow", 0.3] }    → el.style.background = hexToRgba(theme.shadow, 0.3)
 *   函数:    { "boxShadow": (t) => `0 4px ${hexToRgba(t.shadow, 0.5)}` }
 *
 * 使用方式：
 *   import { ComfyThemeAdapter } from "../adapter.js";
 *   const adapter = new ComfyThemeAdapter();
 *   adapter.bindElement(el, { background: "primary", color: "text" });
 *   adapter.onThemeChange((theme) => { customUpdate(); });
 *   adapter.destroy();
 */
import { getTheme, hexToRgba, watchTheme } from "./theme.js";

class ComfyThemeAdapter {
  // -------- 单例 watcher（所有实例共享） --------
  static _watcher = null;
  static _instances = new Set();

  static _ensureWatcher() {
    if (ComfyThemeAdapter._watcher) return;
    ComfyThemeAdapter._watcher = watchTheme((newTheme) => {
      ComfyThemeAdapter._instances.forEach(instance => {
        instance._theme = newTheme;
        instance.updateAllElements();
        instance._callbacks.forEach(fn => fn(newTheme));
      });
    });
  }

  // -------- 实例 --------
  constructor() {
    this._bindings = [];
    this._callbacks = [];
    this._theme = getTheme();
    ComfyThemeAdapter._instances.add(this);
    ComfyThemeAdapter._ensureWatcher();
  }

  /** 获取当前主题配色对象 */
  get theme() {
    return this._theme;
  }

  /**
   * 绑定元素，在主题变化时自动更新指定的 CSS 属性。
   * @param {HTMLElement} el
   * @param {Object} styleMap - CSS属性名 → 主题映射表达式
   * @returns {ComfyThemeAdapter} this（支持链式调用）
   */
  bindElement(el, styleMap) {
    if (!el || !styleMap) return this;
    const binding = { el, styleMap };
    this._bindings.push(binding);
    this._applyBinding(binding);
    return this;
  }

  /**
   * 解除指定元素的所有绑定
   * @param {HTMLElement} el
   */
  unbindElement(el) {
    this._bindings = this._bindings.filter(b => b.el !== el);
    return this;
  }

  /**
   * 注册主题变化回调（用于无法通过 styleMap 表达的复杂更新逻辑）
   * @param {Function} callback - 接收新主题配色对象
   */
  onThemeChange(callback) {
    if (typeof callback === "function") {
      this._callbacks.push(callback);
    }
    return this;
  }

  /** @private 对单个绑定执行样式更新 */
  _applyBinding({ el, styleMap }) {
    const theme = this._theme;
    Object.entries(styleMap).forEach(([cssProp, expr]) => {
      let value;
      if (typeof expr === "function") {
        value = expr(theme);
      } else if (Array.isArray(expr)) {
        // [themeKey, alpha]  →  hexToRgba(theme[key], alpha)
        value = hexToRgba(theme[expr[0]], expr[1]);
      } else {
        // 字符串  →  直接取 theme 属性
        value = theme[expr];
      }
      if (value !== undefined) {
        el.style[cssProp] = value;
      }
    });
  }

  /** 手动刷新所有绑定元素的样式（自动清理已移除的 DOM） */
  updateAllElements() {
    this._bindings = this._bindings.filter(b => {
      if (!b.el) return false;
      const root = b.el.getRootNode();
      return root === document || document.body.contains(b.el);
    });
    this._bindings.forEach(b => this._applyBinding(b));
  }

  /** 销毁适配器：解除所有绑定、回调，必要时关闭全局 watcher */
  destroy() {
    this._bindings = [];
    this._callbacks = [];
    ComfyThemeAdapter._instances.delete(this);
    if (ComfyThemeAdapter._instances.size === 0 && ComfyThemeAdapter._watcher) {
      ComfyThemeAdapter._watcher.cleanup();
      ComfyThemeAdapter._watcher = null;
    }
  }
}

export { ComfyThemeAdapter };