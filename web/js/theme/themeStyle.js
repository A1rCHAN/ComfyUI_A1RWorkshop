// TODO: comfyui nodes2.0 检测，识别前端类型，自动切换主题
export const FRONTEND_TYPE = {
    MODERN: "modern",
    CLASSIC: "classic",
    AUTO: "auto",
};
export const THEME_STYLE_STORAGE_KEY = "a1rworkshop.themeStyle";
export const THEME_STYLE_CHANGE_EVENT = "themeStyleChange";
export const THEME_STYLES = {
    modern: {
        isClassic: false,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
        gap: { sm: "4px", md: "8px", lg: "12px", xl: "16px" },
        borderRadius: { sm: "4px", md: "6px", lg: "8px", xl: "12px" },
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    classic: {
        isClassic: true,
        fontFamily: "Courier New, Consolas, monospace",
        gap: { sm: "4px", md: "8px", lg: "12px", xl: "16px" },
        borderRadius: "0px",
        transition: "none",
    },
};
/**
 * 配置样式类型
 * @param isClassic 风格判断
 * @returns CSS 样式类型对象
 */
export function getWidgetStructure(isClassic) {
    const fontFamily = isClassic ? THEME_STYLES.classic.fontFamily : THEME_STYLES.modern.fontFamily;
    const transition = isClassic ? THEME_STYLES.classic.transition : THEME_STYLES.modern.transition;
    return {
        toast: {
            position: "fixed",
            top: "24px",
            left: "50%",
            zIndex: "10001",
            minWidth: "180px",
            maxWidth: "360px",
            padding: "10px 12px",
            borderRadius: isClassic ? THEME_STYLES.classic.borderRadius : THEME_STYLES.modern.borderRadius.md,
            fontFamily: fontFamily,
            fontSize: "13px",
            lineHeight: "1.4",
            pointerEvents: "none",
            transition: transition,
            transform: "translateX(-50%)",
        },
        overlay: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "fixed",
            top: "0",
            left: "0",
            bottom: "0",
            right: "0",
            zIndex: "1000",
            backdropFilter: "blur(8px)",
            pointerEvents: "auto",
        },
        dialog: {
            display: "flex",
            flexShrink: "0",
            flexDirection: "column",
            position: "relative",
            minWidth: "400px",
            minHeight: "200px",
            maxWidth: "90vw",
            maxHeight: "90vh",
            margin: "0",
            borderRadius: isClassic ? THEME_STYLES.classic.borderRadius : THEME_STYLES.modern.borderRadius.xl,
            fontFamily: fontFamily,
            overflow: "auto",
        },
        container: {
            display: "flex",
            alignItems: "center",
            position: "relative",
            width: "100%",
            minHeight: "32px",
            padding: "4px 8px",
            boxSizing: "border-box",
            borderRadius: isClassic ? THEME_STYLES.classic.borderRadius : THEME_STYLES.modern.borderRadius.md,
            fontFamily: fontFamily,
        },
        combo: {
            width: "100%",
            height: "100%",
            padding: "0 20px",
            borderRadius: isClassic ? THEME_STYLES.classic.borderRadius : THEME_STYLES.modern.borderRadius.md,
            fontFamily: fontFamily,
            fontSize: "14px",
            fontWeight: "500",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            cursor: "pointer",
        },
        textarea: {
            width: "100%",
            minHeight: "120px",
            padding: "10px",
            boxSizing: "border-box",
            borderRadius: isClassic ? THEME_STYLES.classic.borderRadius : THEME_STYLES.modern.borderRadius.md,
            fontFamily: isClassic ? THEME_STYLES.classic.fontFamily : THEME_STYLES.modern.fontFamily,
        },
        button: {
            display: "flex",
            flex: "0 0 auto",
            flexShrink: "0",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "20px",
            borderRadius: isClassic ? THEME_STYLES.classic.borderRadius : THEME_STYLES.modern.borderRadius.md,
            padding: "4px 12px",
            boxSizing: "border-box",
            textAlign: "center",
            fontFamily: fontFamily,
            fontSize: "13px",
            fontWeight: "600",
            lineHeight: "1.4",
            whiteSpace: "nowrap",
            cursor: "pointer",
            userSelect: "none",
            transition: transition,
        },
        label: {
            flexShrink: "0",
            minWidth: "80px",
            fontFamily: fontFamily,
            fontSize: "14px",
            fontWeight: "600",
            userSelect: "none",
        },
    };
}
export function getThemeStyle() {
    const stored = localStorage.getItem(THEME_STYLE_STORAGE_KEY);
    if (stored && Object.values(FRONTEND_TYPE).includes(stored)) {
        return stored;
    }
    return FRONTEND_TYPE.AUTO;
}
export function setThemeStyle(type) {
    localStorage.setItem(THEME_STYLE_STORAGE_KEY, type);
    window.dispatchEvent(new CustomEvent(THEME_STYLE_CHANGE_EVENT, { detail: { type } }));
}
export function getCurrentStyle() {
    const themeStyle = getThemeStyle();
    if (themeStyle !== FRONTEND_TYPE.AUTO) {
        return themeStyle;
    }
    return detectThemeStyle();
}
export function detectThemeStyle() {
    const modernStyle = window.app?.ui?.settings?.getSettingValue?.("Comfy.VueNodes.Enabled");
    switch (modernStyle) {
        case true:
            return FRONTEND_TYPE.MODERN;
        case false:
            return FRONTEND_TYPE.CLASSIC;
        default:
            // eslint-disable-next-line no-console
            console.log("Unable to detect theme style, defaulting to modern.");
            return FRONTEND_TYPE.MODERN;
    }
    // 这里可以添加更多的检测逻辑，例如检查 DOM 结构、CSS 变量等
}
