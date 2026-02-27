/*
 * A1RWorkshop Theme Engine
 * Fully typed | Hot-switch compatible
 */
// --- Types ---
export const FRONTEND_TYPE = {
    VUE: "vue",
    LITEGRAPH: "litegraph",
    AUTO: "auto",
};
// --- Theme Registry ---
export const THEME_COLORS = {
    dark: {
        name: "Dark",
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
        nodeBg: "#1a1a1a",
        nodeBorder: "#4a4a4a",
        inputBg: "#2a2a2a",
        widgetBorderRadius: "6px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    },
    light: {
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
};
// --- Frontend Detection ---
export function detectFrontendType() {
    try {
        const settings = window?.app?.ui?.settings;
        const vueNodes = settings?.getSettingValue?.("Comfy.VueNodes.Enabled");
        if (vueNodes === true)
            return FRONTEND_TYPE.VUE;
        if (vueNodes === false)
            return FRONTEND_TYPE.LITEGRAPH;
    }
    catch { }
    if (window?.comfyAPI?.app?.vueApp ||
        document.querySelector("#vue-app")) {
        return FRONTEND_TYPE.VUE;
    }
    if (window?.LiteGraph &&
        document.querySelector("canvas.lgraphcanvas")) {
        return FRONTEND_TYPE.LITEGRAPH;
    }
    return FRONTEND_TYPE.VUE;
}
// --- Theme Resolver ---
// export function resolveTheme(): RuntimeTheme {
//   const frontend = detectFrontendType();
//   const themeName: ThemeName =
//     frontend === FRONTEND_TYPE.LITEGRAPH
//       ? "classic"
//       : "dark";
//   const base = THEME_COLORS[themeName];
//   return {
//     ...base,
//     _themeName: themeName,
//     _frontendType: frontend,
//     _isClassic:
//       base.frontend === FRONTEND_TYPE.LITEGRAPH,
//   };
// }
// --- CSS Injection ---
const CSS_VAR_PREFIX = "--a1r-";
export function injectTheme(theme) {
    const root = document.documentElement;
    const set = (key, value) => root.style.setProperty(`${CSS_VAR_PREFIX}${key}`, value);
    set("title", theme.title);
    set("background", theme.background);
    set("border", theme.border);
    set("text", theme.text);
    set("primary", theme.primary);
    set("secondary", theme.secondary);
    set("prompt", theme.prompt);
    set("warning", theme.warning);
    set("shadow", theme.shadow);
    root.style.setProperty(`${CSS_VAR_PREFIX}is-classic`, theme._isClassic ? "1" : "0");
    document.body.classList.toggle("a1r-theme-classic", theme._isClassic);
}
// --- Lifecycle Manager ---
function waitForFrontendMount(callback) {
    const check = () => {
        const vueReady = document.querySelector("#vue-app");
        const liteReady = document.querySelector("canvas.lgraphcanvas");
        if (vueReady || liteReady) {
            callback();
        }
        else {
            requestAnimationFrame(check);
        }
    };
    check();
}
function watchFrontendRebuild(onRebuild) {
    let rebuilding = false;
    const observer = new MutationObserver(() => {
        if (rebuilding)
            return;
        const hasRoot = document.querySelector("#vue-app") ||
            document.querySelector("canvas.lgraphcanvas");
        if (!hasRoot) {
            rebuilding = true;
            waitForFrontendMount(() => {
                rebuilding = false;
                onRebuild();
            });
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
    return () => observer.disconnect();
}
// --- Public Watcher ---
export function watchTheme(callback) {
    let current = null;
    function apply() {
        // const theme = resolveTheme();
        // injectTheme(theme);
        // current = theme;
        // callback?.(theme);
    }
    apply();
    const stop = watchFrontendRebuild(() => {
        apply();
    });
    return {
        cleanup() {
            stop();
        },
    };
}
