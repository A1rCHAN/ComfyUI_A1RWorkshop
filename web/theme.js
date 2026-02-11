/**
 * ComfyUI官方主题配色适配
 */

// ========== 主题配色方案 ==========
export const THEME_COLORS = {
  "dark": {
    name: "Dark (Default)",
    title: "#161617",
    background: "#313236",
    border: "#9b9eab",
    text: "#ffffff",
    primary: "#262729",
    secondary: "#454545",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000"
  },
  "light": {
    name: "Light",
    title: "#d9d9d9",
    background: "#e8e8e8",
    border: "#828282",
    text: "#222222",
    primary: "#ffffff",
    secondary: "#d9d9d9",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000"
  },
  "solarized": {
    name: "Solarized",
    title: "#094757",
    background: "#002b36",
    border: "#9b9eab",
    text: "#ffffff",
    primary: "#073642",
    secondary: "#454545",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000"
  },
  "arc": {
    name: "Arc",
    title: "#2b2f38",
    background: "#2b2f38",
    border: "#9b9eab",
    text: "#ffffff",
    primary: "#242730",
    secondary: "#454545",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000"
  },
  "nord": {
    name: "Nord",
    title: "#2e3440",
    background: "#2e3440",
    border: "#9b9eab",
    text: "#ffffff",
    primary: "#161a21",
    secondary: "#454545",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000"
  },
  "github": {
    name: "Github",
    title: "#161a21",
    background: "#161a21",
    border: "#9b9eab",
    text: "#ffffff",
    primary: "#13161c",
    secondary: "#454545",
    prompt: "#5fa5fa",
    warning: "#b33a3a",
    shadow: "#000000"
  }
};

/**
 * 检测当前主题
 * @returns {string} 主题名称
 */
export function detectCurrentTheme() {
  // 1. 从ComfyUI设置API获取（最准确的方法）
  try {
    if (window.app && window.app.ui && window.app.ui.settings) {
      const colorPalette = window.app.ui.settings.getSettingValue('Comfy.ColorPalette');
      
      if (colorPalette) {
        const themeName = colorPalette.toLowerCase().trim();
        if (THEME_COLORS[themeName]) {
          return themeName;
        }
      }
    }
  } catch (e) {
    console.warn('[Theme] Error reading ComfyUI settings:', e);
  }
  
  // 2. 检查body的data-theme属性（备用）
  const dataTheme = document.body.getAttribute("data-theme");
  if (dataTheme) {
    const normalizedTheme = dataTheme.toLowerCase().trim();
    if (THEME_COLORS[normalizedTheme]) {
      return normalizedTheme;
    }
  }
  
  // 3. 检查body的class（备用）
  const bodyClasses = document.body.className;
  const bodyClassList = bodyClasses.split(/\s+/);
  for (const cls of bodyClassList) {
    const themeName = cls.replace(/^theme-/, '').toLowerCase();
    if (THEME_COLORS[themeName]) {
      return themeName;
    }
  }
  
  // 4. 默认返回dark主题
  return "dark";
}

/**
 * 获取当前主题配色
 * @returns {Object} 主题配色对象
 */
export function getTheme() {
  const currentTheme = detectCurrentTheme();
  return THEME_COLORS[currentTheme] || THEME_COLORS.dark;
}

/**
 * 辅助函数：将hex颜色转换为rgba
 * @param {string} hex - 十六进制颜色值
 * @param {number} alpha - 透明度 (0-1)
 * @returns {string} rgba颜色字符串
 */
export function hexToRgba(hex, alpha = 1) {
  // 移除#号
  hex = hex.replace(/^#/, '');
  
  // 处理3位hex (如 #fff)
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * 监听主题变化
 * @param {Function} callback - 主题变化时的回调函数，接收新主题对象作为参数
 * @returns {Object} 包含清理函数的对象 { cleanup: Function }
 */
export function watchTheme(callback) {
  let currentTheme = detectCurrentTheme();
  let checkInterval = null;
  let domObserver = null;
  
  // 方法1: 定期检查ComfyUI设置API（主要方法）
  const checkThemeChange = () => {
    try {
      const newTheme = detectCurrentTheme();
      if (newTheme !== currentTheme) {
        currentTheme = newTheme;
        const themeColors = getTheme();
        callback(themeColors, newTheme);
      }
    } catch (e) {
      console.error('[Theme] Error checking theme change:', e);
    }
  };
  
  // 每500ms检查一次（轻量级，只比较字符串）
  checkInterval = setInterval(checkThemeChange, 500);
  
  // 方法2: 监听DOM变化（备用方法）
  domObserver = new MutationObserver(() => {
    checkThemeChange();
  });
  
  domObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-theme', 'class']
  });
  
  // 返回清理函数
  return {
    cleanup: () => {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
      }
    }
  };
}
