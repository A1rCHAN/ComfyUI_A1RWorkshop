import { getWidgetStructure } from "./themeStyle.js";
import { watchThemeToken, } from "./themeWatcher.js";
/**
 * 配置颜色属性
 * @param theme
 * @returns CSS 颜色属性对象
 */
function createThemeStyle(theme) {
    const boxShadow = `0 8px 24px ${hexToRGBA(theme.color.shadow, 0.3)}`;
    return {
        toast: {
            background: theme.color.title,
            color: theme.color.text,
            border: theme.isClassic ? `1px solid ${theme.color.border}` : "none",
            boxShadow: boxShadow,
        },
        overlay: {
            background: hexToRGBA(theme.color.shadow, 0.3),
        },
        dialog: {
            background: theme.color.background,
            color: theme.color.text,
            border: theme.isClassic ? `1px solid ${theme.color.border}` : "none",
            boxShadow: boxShadow,
        },
        container: {
            background: theme.color.border,
            borderColor: "transparent",
            outline: "none",
        },
        combo: {
            background: "transparent",
            color: theme.color.text,
            outline: "none",
            border: "none",
        },
        textarea: {
            background: "transparent",
            color: theme.color.text,
            outline: "none",
            border: "none",
        },
        button: {
            background: theme.color.border,
            color: theme.color.text,
            outline: "none",
            border: "none",
        },
        label: {
            color: theme.color.text,
        },
    };
}
export function hexToRGBA(hex, alpha = 1) {
    if (!hex)
        return `rgba(0, 0, 0, ${alpha})`;
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex
            .split('')
            .map((char) => char + char)
            .join('');
    }
    const R = parseInt(hex.substring(0, 2), 16);
    const G = parseInt(hex.substring(2, 4), 16);
    const B = parseInt(hex.substring(4, 6), 16);
    if (isNaN(R) || isNaN(G) || isNaN(B)) {
        return `rgba(0, 0, 0, ${alpha})`;
    }
    return `rgba(${R}, ${G}, ${B}, ${alpha})`;
}
function bindThemeSync(element, widgetKey, themeConfig, customStyle) {
    return watchThemeToken((token) => {
        element.className = `a1r-${widgetKey} ${token.mode}`;
        Object.assign(element.style, getWidgetStructure(token.isClassic)[widgetKey]);
        Object.assign(element.style, createThemeStyle(token)[widgetKey]);
        Object.assign(element.style, customStyle);
    }, themeConfig);
}
export function showToast(theme = {}, customStyle = {}, message, type = "success", duration = 2500) {
    const el = document.createElement("div");
    el.textContent = message;
    const stopWatch = watchThemeToken((token) => {
        const structure = getWidgetStructure(token.isClassic)["toast"];
        const themeStyle = createThemeStyle(token)["toast"];
        const typeColor = type === "success" ? token.color.background
            : type === "error" ? token.color.warning
                : token.color.prompt;
        el.className = `a1r-toast ${token.mode}`;
        Object.assign(el.style, structure);
        Object.assign(el.style, themeStyle);
        el.style.background = typeColor;
        Object.assign(el.style, customStyle);
    }, theme);
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(-20px)";
    const remove = () => {
        el.style.opacity = "0";
        el.style.transform = "translateX(-50%) translateY(-20px)";
        setTimeout(() => {
            stopWatch();
            el.remove();
        }, 300);
    };
    el.onclick = remove;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateX(-50%) translateY(0)";
    });
    if (duration > 0) {
        setTimeout(remove, duration);
    }
    return el;
}
export function createOverlay(theme = {}, customStyle = {}) {
    const el = document.createElement('div');
    const stopWatch = bindThemeSync(el, "overlay", theme, customStyle);
    el.__a1rStopThemeWatch = stopWatch;
    return el;
}
export function createDialog(theme = {}, customStyle = {}) {
    const el = document.createElement('div');
    const stopWatch = bindThemeSync(el, "dialog", theme, customStyle);
    el.__a1rStopThemeWatch = stopWatch;
    return el;
}
export function createContainer(theme = {}, customStyle = {}) {
    const el = document.createElement('div');
    const stopWatch = bindThemeSync(el, "container", theme, customStyle);
    el.__a1rStopThemeWatch = stopWatch;
    return el;
}
export function createButton(label, theme = {}, customStyle = {}) {
    const el = document.createElement('button');
    el.textContent = label;
    const stopWatch = bindThemeSync(el, "button", theme, customStyle);
    el.addEventListener("mouseenter", () => {
        el.style.filter = "brightness(1.2)";
    });
    el.addEventListener("mouseleave", () => {
        el.style.filter = "none";
    });
    el.__a1rStopThemeWatch = stopWatch;
    return el;
}
export function createLabel(text, theme = {}, customStyle = {}) {
    const el = document.createElement('label');
    el.textContent = text;
    const stopWatch = bindThemeSync(el, "label", theme, customStyle);
    el.__a1rStopThemeWatch = stopWatch;
    return el;
}
export function createCombo(theme = {}, customStyle = {}) {
    const el = document.createElement("select");
    const stopWatch = bindThemeSync(el, "combo", theme, customStyle);
    el.addEventListener("mouseenter", () => {
        el.style.filter = "brightness(2)";
    });
    el.addEventListener("mouseleave", () => {
        el.style.filter = "none";
    });
    el.__a1rStopThemeWatch = stopWatch;
    return el;
}
export function createTextarea(theme = {}, customStyle = {}) {
    const el = document.createElement("textarea");
    const stopWatch = bindThemeSync(el, "textarea", theme, customStyle);
    el.__a1rStopThemeWatch = stopWatch;
    return el;
}
