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
        borderRadius: { sm: "4px", md: "6px", lg: "8px", xl: "12px" },
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    classic: {
        isClassic: true,
        fontFamily: "Courier New, Consolas, monospace",
        borderRadius: "0px",
        transition: "none",
    },
};
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
            console.log("Unable to detect theme style, defaulting to modern.");
            return FRONTEND_TYPE.MODERN;
    }
}
