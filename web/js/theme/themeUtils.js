import { getCanvasSettingState } from "../data/state.js";
// === 工具 ===
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
export function showToast(message, type = "success", duration = 2500, customStyle = {}) {
    const el = document.createElement("div");
    el.textContent = message;
    el.className = `a1r-toast a1r-toast--${type}`;
    Object.assign(el.style, customStyle);
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(-20px)";
    const remove = () => {
        el.style.opacity = "0";
        el.style.transform = "translateX(-50%) translateY(-20px)";
        setTimeout(() => {
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
// === 组件 ===
export function createOverlay(customStyle = {}) {
    const el = document.createElement('div');
    el.className = 'a1r-overlay';
    Object.assign(el.style, customStyle);
    return el;
}
export function createDialog(customStyle = {}) {
    const el = document.createElement('div');
    el.className = 'a1r-dialog';
    Object.assign(el.style, customStyle);
    return el;
}
export function createContainer(customStyle = {}) {
    const el = document.createElement('div');
    el.className = 'a1r-container';
    Object.assign(el.style, customStyle);
    return el;
}
export function createButton(label, customStyle = {}) {
    const el = document.createElement('button');
    el.textContent = label;
    el.className = 'a1r-button';
    Object.assign(el.style, customStyle);
    return el;
}
export function createLabel(text, customStyle = {}) {
    const el = document.createElement('label');
    el.textContent = text;
    el.className = 'a1r-label';
    Object.assign(el.style, customStyle);
    return el;
}
export function createCombo(customStyle = {}) {
    const el = document.createElement("select");
    el.className = 'a1r-combo';
    Object.assign(el.style, customStyle);
    return el;
}
export function createTextarea(customStyle = {}) {
    const el = document.createElement("textarea");
    el.className = 'a1r-textarea';
    Object.assign(el.style, customStyle);
    return el;
}
// === 复合组件 ===
export function rangeSlider(customStyle = {}) {
    return createRangeSlider(customStyle);
}
export function stepSlider(customStyle = {}) {
    return createStepSlider(customStyle);
}
// --- 辅助函数 ---
function hiddenSlider(config = {}, customStyle = {}) {
    const hiddenSlider = document.createElement("input");
    hiddenSlider.className = 'a1r-slider-hidden';
    hiddenSlider.type = "range";
    if (config.min !== undefined)
        hiddenSlider.min = config.min;
    if (config.max !== undefined)
        hiddenSlider.max = config.max;
    if (config.step !== undefined)
        hiddenSlider.step = config.step;
    if (config.value !== undefined)
        hiddenSlider.value = config.value;
    Object.assign(hiddenSlider.style, customStyle);
    return hiddenSlider;
}
function createRangeSlider(customStyle = {}) {
    const state = getCanvasSettingState();
    // 整体（容器）
    const main = createContainer(customStyle);
    const track = document.createElement("div");
    track.className = 'a1r-slider-track';
    Object.assign(track.style, customStyle);
    const activeTrack = document.createElement("div");
    activeTrack.className = 'a1r-slider-track-active';
    Object.assign(activeTrack.style, customStyle);
    const minSlider = hiddenSlider({
        min: state.rangeStepValue,
        max: state.MAX_RANGE,
        step: state.rangeStepValue,
        value: state.rangeMinValue,
    }, { zIndex: "4" });
    const maxSlider = hiddenSlider({
        min: state.rangeStepValue,
        max: state.MAX_RANGE,
        step: state.rangeStepValue,
        value: state.rangeMaxValue,
    }, { zIndex: "5" });
    const minThumb = document.createElement("div");
    minThumb.className = 'a1r-slider-thumb';
    Object.assign(minThumb.style, customStyle);
    const maxThumb = document.createElement("div");
    maxThumb.className = 'a1r-slider-thumb';
    Object.assign(maxThumb.style, customStyle);
    const updateVisual = () => {
        minSlider.value = state.rangeMinValue;
        maxSlider.value = state.rangeMaxValue;
    };
    main.appendChild(track);
    main.appendChild(activeTrack);
    main.appendChild(minThumb);
    main.appendChild(maxThumb);
    main.appendChild(minSlider);
    main.appendChild(maxSlider);
    return main;
}
function createStepSlider(customStyle = {}) {
}
