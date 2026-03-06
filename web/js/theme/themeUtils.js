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
