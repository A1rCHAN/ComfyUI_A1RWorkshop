import { FRONTEND_TYPE, THEME_STYLES, THEME_STYLE_CHANGE_EVENT, THEME_STYLE_STORAGE_KEY, getCurrentStyle, } from "./themeStyle.js";
import { getThemeColor, isThemeName, } from "./themeColor.js";
import { hexToRGBA } from "./themeUtils.js";
const COLOR_KEYS = [
    "name",
    "menu",
    "title",
    "background",
    "border",
    "text",
    "number",
    "label",
    "secondary",
    "prompt",
    "warning",
    "shadow",
];
function normalizeRadius(borderRadius) {
    if (typeof borderRadius === "string") {
        return { sm: borderRadius, md: borderRadius, lg: borderRadius, xl: borderRadius };
    }
    const r = (borderRadius ?? {});
    return {
        sm: r.sm ?? "4px",
        md: r.md ?? "6px",
        lg: r.lg ?? "8px",
        xl: r.xl ?? "12px",
    };
}
function readThemeNameFromDOM() {
    try {
        const colorPalette = window.app?.ui?.settings?.getSettingValue?.("Comfy.ColorPalette");
        if (typeof colorPalette === "string") {
            const normalized = colorPalette.toLowerCase().trim();
            if (isThemeName(normalized))
                return normalized;
        }
    }
    catch { }
    const raw = document.documentElement.getAttribute("data-theme") ||
        document.body.getAttribute("data-theme") ||
        "";
    if (isThemeName(raw))
        return raw;
    for (const cls of document.body.classList) {
        const name = cls.replace(/^theme-/, "").toLowerCase();
        if (isThemeName(name))
            return name;
    }
    return "dark";
}
function patchSettingsDispatcher() {
    const s = window.app?.ui?.settings;
    if (s && !s.__a1r_patched && typeof s.dispatchChange === "function") {
        const orig = s.dispatchChange.bind(s);
        s.dispatchChange = (id, value, oldValue) => {
            orig(id, value, oldValue);
            window.dispatchEvent(new CustomEvent(id + ".change", { detail: { value, oldValue } }));
        };
        s.__a1r_patched = true;
    }
}
export function resolveThemeToken(theme = {}) {
    const modeRaw = (theme?._themeStyle ?? getCurrentStyle());
    const mode = modeRaw === FRONTEND_TYPE.CLASSIC ? "classic" : "modern";
    const styleDef = THEME_STYLES[mode];
    const requestedThemeName = theme?._themeName ?? readThemeNameFromDOM();
    const themeName = isThemeName(requestedThemeName) ? requestedThemeName : "dark";
    const baseColor = getThemeColor(themeName);
    const color = { ...baseColor };
    for (const key of COLOR_KEYS) {
        if (typeof theme?.[key] === "string") {
            ;
            color[key] = theme[key];
        }
    }
    return {
        mode,
        isClassic: mode === "classic",
        fontFamily: styleDef.fontFamily,
        transition: styleDef.transition,
        radius: normalizeRadius(styleDef.borderRadius),
        color,
        themeName,
    };
}
export function watchThemeToken(cb, theme = {}) {
    let last = "";
    const emit = () => {
        const token = resolveThemeToken(theme);
        const sig = JSON.stringify({
            mode: token.mode,
            name: token.themeName,
            color: token.color,
            radius: token.radius,
        });
        if (sig !== last) {
            last = sig;
            cb(token);
        }
    };
    emit();
    patchSettingsDispatcher();
    const settingsInterval = window.setInterval(() => {
        const s = window.app?.ui?.settings;
        if (s) {
            patchSettingsDispatcher();
            window.clearInterval(settingsInterval);
        }
    }, 500);
    const onStyle = () => emit();
    const onStorage = (e) => {
        if (e.key === THEME_STYLE_STORAGE_KEY)
            emit();
    };
    const onSettingChange = () => emit();
    window.addEventListener(THEME_STYLE_CHANGE_EVENT, onStyle);
    window.addEventListener("storage", onStorage);
    window.addEventListener("Comfy.ColorPalette.change", onSettingChange);
    window.addEventListener("Comfy.VueNodes.Enabled.change", onSettingChange);
    window.addEventListener("Comfy.UseNewMenu.change", onSettingChange);
    const mo = new MutationObserver(() => emit());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    const timer = window.setInterval(emit, 800);
    return () => {
        window.removeEventListener(THEME_STYLE_CHANGE_EVENT, onStyle);
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("Comfy.ColorPalette.change", onSettingChange);
        window.removeEventListener("Comfy.VueNodes.Enabled.change", onSettingChange);
        window.removeEventListener("Comfy.UseNewMenu.change", onSettingChange);
        mo.disconnect();
        window.clearInterval(timer);
        window.clearInterval(settingsInterval);
    };
}
const injectedCSS = new Set();
export function injectCSS(relativePath, baseUrl) {
    const href = new URL(relativePath, baseUrl).href;
    if (injectedCSS.has(href))
        return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = href;
    document.head.appendChild(link);
    injectedCSS.add(href);
}
function injectThemeCSS() {
    injectCSS("../../css/a1r-theme.css", import.meta.url);
}
export function initGlobalThemeCSSVar(themeConfig = {}) {
    injectThemeCSS();
    return watchThemeToken((token) => {
        const root = document.documentElement;
        root.style.setProperty('--a1r-font', token.fontFamily);
        root.style.setProperty('--a1r-transition', token.transition);
        root.style.setProperty('--a1r-radius-sm', token.radius.sm);
        root.style.setProperty('--a1r-radius-md', token.radius.md);
        root.style.setProperty('--a1r-radius-lg', token.radius.lg);
        root.style.setProperty('--a1r-radius-xl', token.radius.xl);
        root.style.setProperty('--a1r-border-width', token.isClassic ? '1px' : '0px');
        root.dataset.a1rMode = token.mode;
        for (const [key, value] of Object.entries(token.color)) {
            root.style.setProperty(`--a1r-color-${key}`, value);
        }
        root.style.setProperty('--a1r-color-shadow-alpha', hexToRGBA(token.color.shadow, 0.3));
        root.style.setProperty('--a1r-color-bg-alpha', hexToRGBA(token.color.shadow, 0.3));
    }, themeConfig);
}
