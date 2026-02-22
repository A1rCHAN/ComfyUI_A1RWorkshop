/**
 * ComfyUI 双前端主题系统
 * 检测Nodes 2.0/Vue前端与LiteGraph旧前端
 */

// ========== 前端类型常量 ==========

export const FRONTEND_TYPE = {
  VUE: 'vue',           // Nodes 2.0 - Vue-based
  LITEGRAPH: 'litegraph', // Classic - Canvas-based
  AUTO: 'auto'          // 自动检测
};

// ========== 主题配色方案 ==========

export const THEME_COLORS = {
  // --- Nodes 2.0 现代主题 ---
  "dark": {
    name: "Dark (Default)",
    frontend: FRONTEND_TYPE.VUE,
    title: "#161617",
    background: "#313236",
    border: "#9b9eab",
    text: "#ffffff",
    primary: "#262729",
    secondary: "#454545",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000",
    // Nodes 2.0 特有变量
    nodeBg: "#1a1a1a",
    nodeBorder: "#4a4a4a",
    inputBg: "#2a2a2a",
    widgetBorderRadius: "6px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
  },
  "light": {
    name: "Light",
    frontend: FRONTEND_TYPE.VUE,
    title: "#d9d9d9",
    background: "#e8e8e8",
    border: "#828282",
    text: "#222222",
    primary: "#ffffff",
    secondary: "#d9d9d9",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000",
    nodeBg: "#f5f5f5",
    nodeBorder: "#cccccc",
    inputBg: "#ffffff",
    widgetBorderRadius: "6px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
  },
  "solarized": {
    name: "Solarized",
    frontend: FRONTEND_TYPE.VUE,
    title: "#094757",
    background: "#002b36",
    border: "#9b9eab",
    text: "#ffffff",
    primary: "#073642",
    secondary: "#454545",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000",
    nodeBg: "#002b36",
    nodeBorder: "#586e75",
    inputBg: "#073642",
    widgetBorderRadius: "6px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
  },
  "arc": {
    name: "Arc",
    frontend: FRONTEND_TYPE.VUE,
    title: "#2b2f38",
    background: "#2b2f38",
    border: "#9b9eab",
    text: "#ffffff",
    primary: "#242730",
    secondary: "#454545",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000",
    nodeBg: "#2b2f38",
    nodeBorder: "#4a505c",
    inputBg: "#242730",
    widgetBorderRadius: "6px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
  },
  "nord": {
    name: "Nord",
    frontend: FRONTEND_TYPE.VUE,
    title: "#2e3440",
    background: "#2e3440",
    border: "#9b9eab",
    text: "#ffffff",
    primary: "#161a21",
    secondary: "#454545",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000",
    nodeBg: "#2e3440",
    nodeBorder: "#4c566a",
    inputBg: "#161a21",
    widgetBorderRadius: "6px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
  },
  "github": {
    name: "Github",
    frontend: FRONTEND_TYPE.VUE,
    title: "#161a21",
    background: "#161a21",
    border: "#9b9eab",
    text: "#ffffff",
    primary: "#13161c",
    secondary: "#454545",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000",
    nodeBg: "#161a21",
    nodeBorder: "#30363d",
    inputBg: "#13161c",
    widgetBorderRadius: "6px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
  },
  
  // --- Classic 旧前端主题 (LiteGraph风格) ---
  "classic": {
    name: "Classic (LiteGraph)",
    frontend: FRONTEND_TYPE.LITEGRAPH,
    // LiteGraph 经典深色配色
    title: "#2a2a2a",
    background: "#2a2a2a",
    border: "#666666",
    text: "#aaaaaa",
    primary: "#333333",
    secondary: "#1a1a1a",
    prompt: "#5fa5fa",
    warning: "#ff5555",
    shadow: "#000000",
    // LiteGraph 特有变量
    nodeBg: "#333333",
    nodeBorder: "#555555",
    inputBg: "#1a1a1a",
    widgetBorderRadius: "0px",  // LiteGraph 使用直角
    fontFamily: "Courier New, monospace",  // 等宽字体更符合代码感
    // LiteGraph Canvas 渲染特有
    nodeTextColor: "#aaaaaa",
    connectionColor: "#aef",
    slotColor: "#777",
    selectedNodeBg: "#554433"
  },
  "classic-light": {
    name: "Classic Light",
    frontend: FRONTEND_TYPE.LITEGRAPH,
    title: "#e0e0e0",
    background: "#f0f0f0",
    border: "#999999",
    text: "#333333",
    primary: "#ffffff",
    secondary: "#e0e0e0",
    prompt: "#0066cc",
    warning: "#cc0000",
    shadow: "#999999",
    nodeBg: "#f5f5f5",
    nodeBorder: "#cccccc",
    inputBg: "#ffffff",
    widgetBorderRadius: "0px",
    fontFamily: "Courier New, monospace",
    nodeTextColor: "#333333",
    connectionColor: "#0066cc",
    slotColor: "#666666",
    selectedNodeBg: "#fff4e6"
  }
};

// ========== 本地存储键名 ==========

const STORAGE_KEY = 'a1rworkshop.frontendType';
const STORAGE_KEY_THEME = 'a1rworkshop.themeOverride';

// ========== 前端检测系统 ==========

/**
 * 检测当前运行的前端类型
 * 基于ComfyUI官方提供的切换机制
 * @returns {string} 'vue' | 'litegraph'
 */
export function detectFrontendType() {
  // 方法1: 检测Vue应用实例 (Nodes 2.0标志)
  if (window.comfyAPI?.app?.vueApp || document.querySelector('#vue-app')) {
    return FRONTEND_TYPE.VUE;
  }
  
  // 方法2: 检测LiteGraph Canvas元素
  if (window.LiteGraph && document.querySelector('canvas.lgraphcanvas')) {
    return FRONTEND_TYPE.LITEGRAPH;
  }
  
  // 方法3: 检测ComfyUI设置中的Nodes 2.0开关
  try {
    const useNewMenu = window.app?.ui?.settings?.getSettingValue?.('Comfy.UseNewMenu');
    if (useNewMenu === true) return FRONTEND_TYPE.VUE;
  } catch (e) {
    console.warn('[Theme] Error detecting frontend type from settings:', e);
  }
  
  // 方法4: 检测DOM结构特征 (Nodes 2.0使用Vue组件，旧版使用Canvas)
  const hasVueComponents = !!document.querySelector('.comfy-vue-node') || 
    !!document.querySelector('[class*="comfyui-"]');
  const hasLiteGraph = !!window.LGraphCanvas;
  
  if (hasVueComponents && !hasLiteGraph) return FRONTEND_TYPE.VUE;
  if (hasLiteGraph && !hasVueComponents) return FRONTEND_TYPE.LITEGRAPH;
  
  // 默认假设为新版 (未来趋势)
  return FRONTEND_TYPE.VUE;
};

/**
 * 获取用户设置的前端类型偏好
 * 用于手动覆盖自动检测
 */
export function getFrontendPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && Object.values(FRONTEND_TYPE).includes(stored)) {
      return stored;
    }
  } catch (e) {
    console.warn('[Theme] Error reading frontend preference:', e);
  }
  return FRONTEND_TYPE.AUTO; // 默认自动
};

/**
 * 设置前端类型偏好
 * @param {string} type - 'vue' | 'litegraph' | 'auto'
 */
export function setFrontendPreference(type) {
  try {
    localStorage.setItem(STORAGE_KEY, type);
    // 触发主题重新计算
    window.dispatchEvent(new CustomEvent('a1rworkshop:frontendChanged', { 
      detail: { type } 
    }));
  } catch (e) {
    console.warn('[Theme] Error saving frontend preference:', e);
  }
};

/**
 * 获取当前生效的前端类型
 * 优先使用用户手动设置，否则自动检测
 */
export function getEffectiveFrontendType() {
  const preference = getFrontendPreference();
  if (preference !== FRONTEND_TYPE.AUTO) {
    return preference;
  }
  return detectFrontendType();
};

// ========== CSS 变量注入 ==========

/**
 * 定义主题属性
 */
const CSS_VAR_MAP = {
  title: '--a1r-title',
  background: '--a1r-background',
  border: '--a1r-border',
  text: '--a1r-text',
  primary: '--a1r-primary',
  secondary: '--a1r-secondary',
  prompt: '--a1r-prompt',
  warning: '--a1r-warning',
  shadow: '--a1r-shadow',
  shadowSm: '--a1r-shadow-sm',
  shadowMd: '--a1r-shadow-md',
  shadowLg: '--a1r-shadow-lg',
  isClassic: '--a1r-is-classic',
  frontendType: '--a1r-frontend'
};

/**
 * 注入CSS变量
 */
export function injectThemeCSS(theme) {
  const root = document.documentElement;
  const isClassic = theme._isClassic;
  const frontend = theme._frontendType;

  Object.entries(CSS_VAR_MAP).forEach(([key, varName]) => {
    if (theme[key] && typeof theme[key] === 'string') {
      root.style.setProperty(varName, theme[key])
    }
  });

  const shadowBase = theme.shadow || '#000000';
  root.style.setProperty(CSS_VAR_MAP.shadowSm, hexToRgba(shadowBase, isClassic ? 0.3 : 0.1));
  root.style.setProperty(CSS_VAR_MAP.shadowMd, hexToRgba(shadowBase, isClassic ? 0.5 : 0.3));
  root.style.setProperty(CSS_VAR_MAP.shadowLg, hexToRgba(shadowBase, isClassic ? 0.6 : 0.4));

  root.style.setProperty(CSS_VAR_MAP.isClassic, isClassic ? '1' : '0');

  root.style.setProperty(CSS_VAR_MAP.frontendType, frontend);

  document.body.classList.remove('a1r-theme-classic', 'a1r-theme-modern');
  document.body.classList.add(isClassic ? 'a1r-theme-classic' : 'a1r-theme-modern');

  return () => { cleanupThemeCSS() }
};

/**
 * 清理主题CSS变量
 */
export function cleanupThemeCSS() {
  const root = document.documentElement;
  Object.values(CSS_VAR_MAP).forEach(varName => {
    root.style.removeProperty(varName);
  });
  document.body.classList.remove('a1r-theme-classic', 'a1r-theme-modern')
};

/**
 * 获取当前CSS变量值
 */
export function getCSSVar(name, fallback = '') {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(CSS_VAR_MAP[name] || name)
    .trim() || fallback
};

// ========== 主题获取逻辑 ==========

/**
 * 检测当前ComfyUI主题设置
 */
export function detectCurrentTheme() {
  // 检查是否有主题覆盖设置
  try {
    const themeOverride = localStorage.getItem(STORAGE_KEY_THEME);
    if (themeOverride && THEME_COLORS[themeOverride]) {
      return themeOverride;
    }
  } catch (e) {
    console.warn('[Theme] Error reading theme override:', e);
  }
  
  // 从ComfyUI设置API获取
  try {
    if (window.app?.ui?.settings) {
      const colorPalette = window.app.ui.settings.getSettingValue('Comfy.ColorPalette');
      if (colorPalette) {
        const themeName = colorPalette.toLowerCase().trim();
        // 如果用户选择了classic主题，直接返回
        if (THEME_COLORS[themeName]) return themeName;
      }
    }
  } catch (e) {
    console.warn('[Theme] Error reading ComfyUI settings:', e);
  }
  
  // 回退检测
  const dataTheme = document.body.getAttribute("data-theme");
  if (dataTheme && THEME_COLORS[dataTheme]) return dataTheme;
  
  // 检查body class
  const bodyClasses = document.body.className;
  const bodyClassList = bodyClasses.split(/\s+/);
  for (const cls of bodyClassList) {
    const themeName = cls.replace(/^theme-/, '').toLowerCase();
    if (THEME_COLORS[themeName]) return themeName;
  }
  
  // 根据前端类型返回默认主题
  const frontend = getEffectiveFrontendType();
  return frontend === FRONTEND_TYPE.LITEGRAPH ? "classic" : "dark";
}

/**
 * 设置主题覆盖（强制使用特定主题）
 * @param {string} themeName - 主题名称或null取消覆盖
 */
export function setThemeOverride(themeName) {
  try {
    if (themeName && THEME_COLORS[themeName]) {
      localStorage.setItem(STORAGE_KEY_THEME, themeName);
    } else {
      localStorage.removeItem(STORAGE_KEY_THEME);
    }
    window.dispatchEvent(new CustomEvent('a1rworkshop:themeChanged'));
  } catch (e) {
    console.warn('[Theme] Error setting theme override:', e);
  }
}

/**
 * 获取当前主题配色
 * 自动根据前端类型选择合适主题
 */
export function getTheme() {
  const themeName = detectCurrentTheme();
  const theme = THEME_COLORS[themeName] || THEME_COLORS.dark;
  const frontendType = getEffectiveFrontendType();
  const isClassic = themeName.startsWith('classic') || 
            theme.frontend === FRONTEND_TYPE.LITEGRAPH ||
            frontendType === FRONTEND_TYPE.LITEGRAPH;
  
  // 注入当前前端类型信息到主题对象
  return {
    ...theme,
    _frontendType: frontendType,
    _themeName: themeName,
    _isClassic: isClassic
  };
}

// ========== 工具函数 ==========

/**
 * 将hex颜色转换为rgba
 * @param {string} hex - 十六进制颜色值
 * @param {number} alpha - 透明度 (0-1)
 * @returns {string} rgba颜色字符串
 */
export function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  
  // 移除#号
  hex = hex.replace(/^#/, '');

  // 处理3位hex (如 #fff)
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(0,0,0,${alpha})`;
  }

  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * 监听主题和前端类型变化
 * @param {Function} callback - 主题变化时的回调函数，接收新主题对象作为参数
 * @returns {Object} 包含清理函数的对象 { cleanup: Function }
 */
export function watchTheme(callback) {
  let currentTheme = detectCurrentTheme();
  let currentFrontend = getEffectiveFrontendType();

  injectThemeCSS(getTheme());
  
  const checkChange = () => {
    const newTheme = detectCurrentTheme();
    const newFrontend = getEffectiveFrontendType();
    
    if (newTheme !== currentTheme || newFrontend !== currentFrontend) {
      currentTheme = newTheme;
      currentFrontend = newFrontend;

      const themeObject = getTheme();

      injectThemeCSS(themeObject);

      callback(themeObject, currentTheme, currentFrontend);
    }
  };
  
  // 轮询检测（轻量级，只比较字符串）
  const interval = setInterval(checkChange, 500);
  
  // DOM观察
  const observer = new MutationObserver(() => { checkChange() });
  
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-theme', 'class']
  });
  
  // 监听自定义前端切换事件
  const handleFrontendChange = (e) => { checkChange() };
  window.addEventListener('a1rworkshop:frontendChanged', handleFrontendChange);
  
  // 监听自定义主题切换事件
  const handleThemeChange = () => { checkChange() };
  window.addEventListener('a1rworkshop:themeChanged', handleThemeChange);
  
  return {
    cleanup: () => {
      clearInterval(interval);
      observer.disconnect();
      window.removeEventListener('a1rworkshop:frontendChanged', handleFrontendChange);
      window.removeEventListener('a1rworkshop:themeChanged', handleThemeChange);
    }
  };
}

/**
 * 初始化设置面板
 * 在ComfyUI扩展setup中调用
 */
export function initSettings(app) {
  if (!app?.ui?.settings) {
    console.warn('[A1RWorkshop] Settings API not available');
    return;
  }
  
  // 注册前端类型选择设置
  app.ui.settings.addSetting({
    id: "A1RWorkshop.FrontendStyle",
    name: "[A1R] UI Style Mode",
    type: "combo",
    defaultValue: FRONTEND_TYPE.AUTO,
    options: [
      { value: FRONTEND_TYPE.AUTO, text: "Auto (Detect)" },
      { value: FRONTEND_TYPE.VUE, text: "Modern (Nodes 2.0)" },
      { value: FRONTEND_TYPE.LITEGRAPH, text: "Classic (LiteGraph)" }
    ],
    tooltip: "Force a specific UI style or let it auto-detect based on your ComfyUI frontend version. Classic mode uses直角边框/等宽字体/硬阴影风格。",
    onChange: (value) => {
      setFrontendPreference(value);
      // 提示用户刷新
      if (app.extensionManager?.dialog) {
        app.extensionManager.dialog.show({
          title: "Style Mode Changed",
          message: "The UI style mode has been changed. Some visual updates may require a page refresh to take full effect.",
          type: "info"
        });
      }
    }
  });
  
  // 注册Classic主题变体选择（仅当手动选择Classic时有效）
  app.ui.settings.addSetting({
    id: "A1RWorkshop.ClassicThemeVariant",
    name: "[A1R] Classic Theme Variant",
    type: "combo",
    defaultValue: "classic",
    options: [
      { value: "classic", text: "Classic Dark" },
      { value: "classic-light", text: "Classic Light" }
    ],
    tooltip: "Select the color variant for Classic mode. Only applies when using Classic style or when connected to a LiteGraph-based frontend.",
    onChange: (value) => {
      const currentFrontend = getEffectiveFrontendType();
      // 如果当前是classic模式，立即应用
      if (currentFrontend === FRONTEND_TYPE.LITEGRAPH || 
        getFrontendPreference() === FRONTEND_TYPE.LITEGRAPH) {
        setThemeOverride(value);
      }
    }
  });
}

// ========== 向后兼容导出 ==========

// 默认导出主题配置
export default {
  FRONTEND_TYPE,
  THEME_COLORS,
  detectFrontendType,
  getFrontendPreference,
  setFrontendPreference,
  getEffectiveFrontendType,
  detectCurrentTheme,
  getTheme,
  hexToRgba,
  watchTheme,
  initSettings
};
