/**
 * ComfyUI 主题适配器 v2.1
 * 基于 theme.js 的配色系统，自动跟踪主题变化并更新绑定元素的样式。
 * 所有实例共享同一个全局 watcher，避免重复的 MutationObserver / setInterval。
 * 
 * 增强功能：
 * - 支持双前端架构（Vue/Nodes 2.0 和 Classic/LiteGraph）
 * - 样式映射支持前端类型特定的值
 * - 自动清理和内存管理
 * - 主题变化回调支持
 *
 * styleMap 支持四种映射格式：
 * 1. 字符串: { "background": "primary" } → el.style.background = theme.primary
 * 2. 数组: { "background": ["shadow", 0.3] } → el.style.background = hexToRgba(theme.shadow, 0.3)
 * 3. 函数: { "boxShadow": (t) => `0 4px ${hexToRgba(t.shadow, 0.5)}` }
 * 4. 前端特定对象: { "borderRadius": { litegraph: "0px", vue: "6px", default: "4px" } }
 *
 * 使用方式：
 * import { ComfyThemeAdapter } from "../adapter.js";
 * const adapter = new ComfyThemeAdapter();
 * adapter.bindElement(el, { background: "primary", color: "text" });
 * 
 * // 注册主题变化回调
 * const unbind = adapter.onThemeChange((theme, themeName, frontendType) => {
 *   console.log("Theme changed to:", themeName);
 * });
 * 
 * // 注册前端类型变化回调
 * const unbindFrontend = adapter.onFrontendChange((frontendType, theme) => {
 *   console.log("Frontend changed to:", frontendType);
 * });
 * 
 * // 清理
 * adapter.destroy();
 */

import { 
  getTheme, 
  hexToRgba, 
  watchTheme, 
  getEffectiveFrontendType,
  FRONTEND_TYPE, 
  injectThemeCSS,
  getCSSVar
} from "./theme.js";

class ComfyThemeAdapter {
  // --- 单例 watcher（所有实例共享） ---
  static _watcher = null;
  static _instances = new Set();

  static _ensureWatcher() {
    if (ComfyThemeAdapter._watcher) return;
    
    ComfyThemeAdapter._watcher = watchTheme((newTheme, themeName, frontendType) => {
      ComfyThemeAdapter._instances.forEach(instance => {
        // 检查前端类型是否变化
        const frontendChanged = instance._frontendType !== frontendType;
        
        instance._theme = newTheme;
        instance._frontendType = frontendType;
        instance._isClassic = newTheme._isClassic;
        
        // 触发主题变化回调
        instance._callbacks.forEach(fn => {
          try {
            fn(newTheme, themeName, frontendType);
          } catch (err) {
            console.warn("[ComfyThemeAdapter] Theme change callback error:", err);
          }
        });
        
        // 如果前端类型变化，触发前端变化回调
        if (frontendChanged) {
          instance._frontendCallbacks.forEach(fn => {
            try {
              fn(frontendType, newTheme);
            } catch (err) {
              console.warn("[ComfyThemeAdapter] Frontend change callback error:", err);
            }
          });
        }
      });
    });
  }

  // --- 实例 ---
  constructor() {
    this._bindings = [];
    this._callbacks = [];        // 主题变化回调数组
    this._frontendCallbacks = []; // 前端类型变化回调数组
    
    const theme = getTheme();
    this._theme = theme;
    this._frontendType = theme._frontendType || getEffectiveFrontendType();
    this._isClassic = theme._isClassic || this._frontendType === FRONTEND_TYPE.LITEGRAPH;

    injectThemeCSS(theme);
    
    ComfyThemeAdapter._instances.add(this);
    ComfyThemeAdapter._ensureWatcher();
  }

  /** 获取当前主题配色对象 */
  get theme() { return this._theme; }

  /** 获取当前前端类型 */
  get frontendType() { return this._frontendType; }

  /** 是否为Classic模式 */
  get isClassic() { return this._isClassic; }
  
  /**
   * 绑定元素，在主题变化时自动更新
   */
  bindElement(el, styleMap) {
    if (!el || !styleMap) return this;
    
    // 标准化样式映射（处理前端特定值）
    const normalizedMap = this._normalizeStyleMap(styleMap);
    
    const binding = { 
      el, 
      styleMap: normalizedMap, 
      originalMap: styleMap,
      id: Math.random().toString(36).slice(2, 11),
      initialStyle: {}
    };
    
    // 保存初始样式
    Object.keys(normalizedMap).forEach(prop => {
      binding.initialStyle[prop] = el.style[prop];
    });

    this._bindings.push(binding);
    this._applyBinding(binding);
    
    return this;
  }

  /**
   * 注册主题变化回调
   * @param {Function} callback - 回调函数，接收 (theme, themeName, frontendType)
   * @returns {Function} 取消订阅函数
   */
  onThemeChange(callback) {
    if (typeof callback !== "function") {
      console.warn("[ComfyThemeAdapter] onThemeChange requires a function argument");
      return () => {}; // 返回空函数避免报错
    }
    
    this._callbacks.push(callback);
    
    // 立即执行一次回调，传入当前主题
    try {
      callback(this._theme, this._theme._themeName, this._frontendType);
    } catch (err) {
      console.warn("[ComfyThemeAdapter] Initial theme callback error:", err);
    }
    
    // 返回取消订阅函数
    return () => {
      const index = this._callbacks.indexOf(callback);
      if (index > -1) {
        this._callbacks.splice(index, 1);
      }
    };
  }

  /**
   * 注册前端类型变化回调
   * @param {Function} callback - 回调函数，接收 (frontendType, theme)
   * @returns {Function} 取消订阅函数
   */
  onFrontendChange(callback) {
    if (typeof callback !== "function") {
      console.warn("[ComfyThemeAdapter] onFrontendChange requires a function argument");
      return () => {}; // 返回空函数避免报错
    }
    
    this._frontendCallbacks.push(callback);
    
    // 返回取消订阅函数
    return () => {
      const index = this._frontendCallbacks.indexOf(callback);
      if (index > -1) {
        this._frontendCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 智能解绑，恢复原始样式
   */
  unbindElement(el) {
    const bindingsToRemove = this._bindings.filter(b => b.el === el);
    
    bindingsToRemove.forEach(binding => {
      // 恢复原始样式
      Object.entries(binding.initialStyle).forEach(([prop, value]) => {
        if (value === undefined || value === '') {
          el.style.removeProperty(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
        } else {
          el.style[prop] = value;
        }
      });
    });

    this._bindings = this._bindings.filter(b => b.el !== el);
    return this;
  }

  /**
   * 手动触发更新
   * 通知而非强制重绘（CSS 变量自动处理颜色更新）
   */
  updateAllElements(renormalize = false) {
    // 清理已移除DOM的绑定
    this._bindings = this._bindings.filter(b => {
      if (!b.el) return false;
      try {
        return document.body.contains(b.el);
      } catch (e) {
        return false;
      }
    });
    
    // 如果需要，重新标准化所有绑定
    if (renormalize) {
      this._bindings.forEach(binding => {
        binding.styleMap = this._normalizeStyleMap(binding.originalMap);
        this._applyBinding(binding);
      });
    }
  }

  destroy() {
    // 解绑所有元素，恢复原始样式
    this._bindings.forEach(binding => {
      if (binding.el) {
        this.unbindElement(binding.el);
      }
    });

    this._bindings = [];
    this._callbacks = [];
    this._frontendCallbacks = [];

    ComfyThemeAdapter._instances.delete(this);
    
    if (ComfyThemeAdapter._instances.size === 0 && ComfyThemeAdapter._watcher) {
      ComfyThemeAdapter._watcher.cleanup();
      ComfyThemeAdapter._watcher = null;
    }
  }

  // ========== 私有方法 ==========

  /**
   * 标准化样式映射，处理前端类型特定的值
   * @private
   */
  _normalizeStyleMap(styleMap) {
    const result = {};
    
    Object.entries(styleMap).forEach(([prop, value]) => {
      // 检查是否为前端类型特定对象
      if (value !== null && typeof value === 'object' && 
        !Array.isArray(value) && typeof value !== 'function') {
        
        if (value[this._frontendType] !== undefined) {
          result[prop] = value[this._frontendType];
        } else if (value.default !== undefined) {
          result[prop] = value.default;
        } else {
          result[prop] = value;
        }
      } else {
        result[prop] = value;
      }
    });
    
    return result;
  }

  /**
   * 应用绑定，支持 CSS 变量、函数、数组等
   * @private
   */
  _applyBinding({ el, styleMap }) {
    Object.entries(styleMap).forEach(([cssProp, expr]) => {
      let value;
      
      try {
        if (typeof expr === "function") {
          // 函数：接收 theme 和 frontendType
          value = expr(this._theme, this._frontendType);
        } else if (Array.isArray(expr)) {
          // 数组：[themeKey, alpha] 或 [cssVar, alpha, 'var']
          const [key, alpha, type] = expr;
          
          if (type === "var") {
            // CSS 变量引用: ['--a1r-accent', 0.5, 'var']
            value = hexToRgba(getCSSVar(key), alpha);
          } else {
            // 主题键引用
            value = hexToRgba(this._theme[key], alpha);
          }
        } else if (typeof expr === "string") {
          // 字符串：CSS 变量或主题键
          if (expr.startsWith("--")) {
            value = `var(${expr})`;
          } else if (this._theme[expr]) {
            value = this._theme[expr];
          } else {
            value = expr;
          }
        } else {
          value = expr;
        }
        
        if (value !== undefined && value !== null) {
          el.style[cssProp] = value;
        }
      } catch (e) {
        console.warn(`[ComfyThemeAdapter] Error applying style ${cssProp}:`, e);
      }
    });
  }
}

// ========== 便捷函数 ==========

/**
 * 快速创建适配器并绑定单个元素
 * @param {HTMLElement} el
 * @param {Object} styleMap
 * @returns {ComfyThemeAdapter}
 */
export function bindTheme(el, styleMap) {
  const adapter = new ComfyThemeAdapter();
  adapter.bindElement(el, styleMap);
  return adapter;
}

/**
 * 获取当前主题信息（便捷函数）
 * @returns {Object} { theme, frontendType, isClassic }
 */
export function getCurrentThemeInfo() {
  const theme = getTheme();
  return {
    theme,
    frontendType: theme._frontendType || getEffectiveFrontendType(),
    isClassic: theme._isClassic
  };
}

// ========== 样式预设 ==========

export const STYLE_PRESETS = {
  // 对话框背景
  dialog: (theme) => ({
    background: '--a1r-primary',
    color: '--a1r-text',
    border: {
      litegraph: `1px solid var(--a1r-border)`,
      vue: "none",
      default: "none"
    },
    borderRadius: {
      litegraph: "0px",
      vue: "20px",
      default: "12px"
    },
    boxShadow: (t, ft) => ft === FRONTEND_TYPE.LITEGRAPH 
      ? `4px 4px 0 var(--a1r-shadow-md)`
      : `0 4px 16px var(--a1r-shadow-md)`,
    fontFamily: {
      litegraph: "Courier New, monospace",
      vue: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
      default: "system-ui"
    }
  }),
  
  // 按钮样式
  button: (theme) => ({
    background: '--a1r-background',
    color: '--a1r-text',
    border: {
      litegraph: `1px solid var(--a1r-border)`,
      vue: "none",
      default: "none"
    },
    borderRadius: {
      litegraph: "0px",
      vue: "6px",
      default: "4px"
    },
    fontFamily: {
      litegraph: "Courier New, monospace",
      vue: "system-ui",
      default: "system-ui"
    },
    transition: {
      litegraph: "none",
      vue: "all 0.2s",
      default: "all 0.2s"
    }
  }),

  // 强调按钮样式
  accentButton: (theme) => ({
    background: ['--a1r-accent', 0.2, 'var'],
    color: '--a1r-text',
    border: `1px solid var(--a1r-accent)`
  }),
  
  // 输入框样式
  input: (theme) => ({
    background: theme.inputBg || theme.background,
    color: theme.text,
    border: { litegraph: `1px solid ${theme.border}`, vue: "1px solid transparent", default: "1px solid transparent" },
    borderRadius: { litegraph: "0px", vue: "6px", default: "4px" },
    fontFamily: { litegraph: "Courier New, monospace", vue: "monospace", default: "monospace" }
  }),
  
  // 滑块轨道
  sliderTrack: (theme) => ({
    background: theme.secondary,
    borderRadius: { litegraph: "0px", vue: "2px", default: "2px" },
    height: { litegraph: "2px", vue: "4px", default: "4px" }
  }),
  
  // 滑块 thumb
  sliderThumb: (theme) => ({
    background: theme.border,
    border: { litegraph: `1px solid ${theme.text}`, vue: "none", default: "none" },
    borderRadius: { litegraph: "0px", vue: "50%", default: "50%" },
    width: { litegraph: "12px", vue: "16px", default: "16px" },
    height: { litegraph: "12px", vue: "16px", default: "16px" },
    boxShadow: (t, ft) => ft === FRONTEND_TYPE.LITEGRAPH 
      ? "none"
      : `0 2px 8px ${hexToRgba(t.shadow, 0.3)}`
  })
};

export { ComfyThemeAdapter };