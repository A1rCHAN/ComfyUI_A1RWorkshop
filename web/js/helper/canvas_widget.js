// @ts-expect-error ComfyUI 运行时注入模块
import { app } from "/scripts/app.js";
import { resolveThemeToken, watchThemeToken } from "../theme/themeWatcher.js";
export const SIZE_PRESETS = {
    "Squire 512x512": [512, 512],
    "Squire 768x768": [768, 768],
    "Squire 1024x1024": [1024, 1024],
    "Portrait 512x768": [512, 768],
    "Portrait 768x1024": [768, 1024],
    "Portrait 1024x1536": [1024, 1536],
    "Landscape 768x512": [768, 512],
    "Landscape 1024x768": [1024, 768],
    "Landscape 1536x1024": [1536, 1024],
    "16:9 1920x1080": [1920, 1080],
    "16:9 1280x720": [1280, 720],
    "9:16 1080x1920": [1080, 1920],
    "4:3 1024x768": [1024, 768],
    "3:4 768x1024": [768, 1024],
};
export function forceRefresh(node) {
    node.setDirtyCanvas(true, true);
    if (app.graph)
        app.graph.setDirtyCanvas(true, true);
    if (app.canvas)
        app.canvas.draw(true, true);
    const origSize = node.size;
    node.setSize([origSize[0], origSize[1]]);
    node.graph?.change?.();
}
export function forceUpdateWidgetValue(widget, newValue) {
    const currentValue = widget.value;
    if (newValue === currentValue) {
        widget.value = newValue + 1;
    }
    widget.value = newValue;
    if (widget.callback) {
        widget.callback(newValue);
    }
}
export function saveWidgetRange(node) {
    node.properties = node.properties || {};
    node.properties.widgetRange = {};
    for (const name of ["width", "height"]) {
        const w = node.widgets.find((widget) => widget.name === name);
        if (w?.options) {
            node.properties.widgetRange[name] = {
                min: w.options.min,
                max: w.options.max,
                step: w.options.step,
                step2: w.options.step2,
            };
        }
    }
}
export function restoreWidgetRange(node) {
    const range = node.properties?.widgetRange;
    if (!range)
        return;
    for (const name of ["width", "height"]) {
        const w = node.widgets.find((widget) => widget.name === name);
        const r = range[name];
        if (w && r) {
            if (r.min !== undefined)
                w.options.min = r.min;
            if (r.max !== undefined)
                w.options.max = r.max;
            if (r.step !== undefined)
                w.options.step = r.step;
            if (r.step2 !== undefined)
                w.options.step2 = r.step2;
        }
    }
}
// ========== 2D Canvas Widget ==========
export function create2DSliderWidget(node, widgetPreset, widgetWidth, widgetHeight) {
    // DOM 结构
    const container = document.createElement("div");
    container.className = "a1r-canvas-container";
    const sliderBox = document.createElement("div");
    sliderBox.className = "a1r-canvas-slider-box";
    container.appendChild(sliderBox);
    const grid = document.createElement("div");
    grid.className = "a1r-canvas-grid";
    sliderBox.appendChild(grid);
    const minZone = document.createElement("div");
    minZone.className = "a1r-canvas-zone";
    sliderBox.appendChild(minZone);
    const selectedArea = document.createElement("div");
    selectedArea.className = "a1r-canvas-selected-area";
    sliderBox.appendChild(selectedArea);
    const lineH = document.createElement("div");
    lineH.className = "a1r-canvas-guide-line-h";
    const lineHVisual = document.createElement("div");
    lineHVisual.className = "a1r-canvas-guide-line-visual a1r-canvas-guide-line-h-visual";
    lineH.appendChild(lineHVisual);
    sliderBox.appendChild(lineH);
    const lineV = document.createElement("div");
    lineV.className = "a1r-canvas-guide-line-v";
    const lineVVisual = document.createElement("div");
    lineVVisual.className = "a1r-canvas-guide-line-visual a1r-canvas-guide-line-v-visual";
    lineV.appendChild(lineVVisual);
    sliderBox.appendChild(lineV);
    const point = document.createElement("div");
    point.className = "a1r-canvas-guide-point";
    sliderBox.appendChild(point);
    const coordTooltip = document.createElement("div");
    coordTooltip.className = "a1r-canvas-coord-tooltip";
    document.body.appendChild(coordTooltip);
    // 拖拽状态
    let isDragging = false;
    let isProgrammaticUpdate = false;
    let dragMode = null;
    let currentSliderBox = null;
    let userStepW = widgetWidth.options?.step2 ?? widgetWidth.options?.step ?? 64;
    let userStepH = widgetHeight.options?.step2 ?? widgetHeight.options?.step ?? 64;
    let isPresetTemporaryStep = false;
    function restoreOriginalStep() {
        if (isPresetTemporaryStep) {
            widgetWidth.options.step = userStepW;
            widgetWidth.options.step2 = userStepW;
            widgetHeight.options.step = userStepH;
            widgetHeight.options.step2 = userStepH;
            isPresetTemporaryStep = false;
        }
    }
    function updateDisplay() {
        const minW = widgetWidth.options?.min ?? 64;
        const maxW = widgetWidth.options?.max ?? 4096;
        const minH = widgetHeight.options?.min ?? 64;
        const maxH = widgetHeight.options?.max ?? 4096;
        let gridStepW = isPresetTemporaryStep ? userStepW : (widgetWidth.options?.step ?? 64);
        let gridStepH = isPresetTemporaryStep ? userStepH : (widgetHeight.options?.step ?? 64);
        if (!gridStepW || gridStepW <= 0)
            gridStepW = 64;
        if (!gridStepH || gridStepH <= 0)
            gridStepH = 64;
        const maxGridLines = 20;
        while (maxW / gridStepW > maxGridLines && gridStepW < maxW) {
            gridStepW *= 2;
        }
        while (maxH / gridStepH > maxGridLines && gridStepH < maxH) {
            gridStepH *= 2;
        }
        const w = widgetWidth.value;
        const h = widgetHeight.value;
        const xPercent = Math.max(0, Math.min(100, (w / maxW) * 100));
        const yPercent = Math.max(0, Math.min(100, (h / maxH) * 100));
        const minXPercent = (minW / maxW) * 100;
        const minYPercent = (minH / maxH) * 100;
        minZone.style.width = `${minXPercent}%`;
        minZone.style.height = `${minYPercent}%`;
        point.style.left = `${xPercent}%`;
        point.style.bottom = `${yPercent}%`;
        selectedArea.style.width = `${xPercent}%`;
        selectedArea.style.height = `${yPercent}%`;
        lineH.style.bottom = `${yPercent}%`;
        lineV.style.left = `${xPercent}%`;
        const gridSizeXPercent = (gridStepW / maxW) * 100;
        const gridSizeYPercent = (gridStepH / maxH) * 100;
        // const gridColor = color.secondary
        // grid.style.backgroundImage = `
        //   linear-gradient(to right, ${gridColor} 1px, transparent 1px),
        //   linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
        // `
        grid.style.backgroundSize = `${Math.max(gridSizeXPercent, 5)}% ${Math.max(gridSizeYPercent, 5)}%`;
        grid.style.backgroundPosition = "0% 100%";
    }
    function checkAndSetCustom(newW, newH) {
        const currentPreset = widgetPreset.value;
        if (currentPreset === "Custom")
            return;
        const targetSizes = SIZE_PRESETS[currentPreset];
        if (!targetSizes)
            return;
        if (newW !== targetSizes[0] || newH !== targetSizes[1]) {
            widgetPreset.value = "Custom";
        }
    }
    let color = resolveThemeToken().color;
    function updateCoordTooltip(e, mode = null) {
        const rect = sliderBox.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0)
            return;
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
        const minW = widgetWidth.options?.min ?? 64;
        const maxW = widgetWidth.options?.max ?? 4096;
        const minH = widgetHeight.options?.min ?? 64;
        const maxH = widgetHeight.options?.max ?? 4096;
        const stepW = userStepW ?? widgetWidth.options?.step2 ?? widgetWidth.options?.step ?? 64;
        const stepH = userStepH ?? widgetHeight.options?.step2 ?? widgetHeight.options?.step ?? 64;
        let w = x * maxW;
        let h = y * maxH;
        w = Math.round(w / stepW) * stepW;
        h = Math.round(h / stepH) * stepH;
        const minXPercent = minW / maxW;
        const minYPercent = minH / maxH;
        if (mode === "lineV") {
            if (x <= minXPercent)
                w = minW;
            h = widgetHeight.value;
        }
        else if (mode === "lineH") {
            if (y <= minYPercent)
                h = minH;
            w = widgetWidth.value;
        }
        else {
            if (x <= minXPercent && y <= minYPercent) {
                w = minW;
                h = minH;
            }
            else if (x <= minXPercent) {
                w = minW;
            }
            else if (y <= minYPercent) {
                h = minH;
            }
        }
        let wColor = color.text;
        let hColor = color.text;
        let commaColor = color.text;
        let wFontSize = "12px";
        let hFontSize = "12px";
        if (mode === "lineH") {
            wColor = color.background;
            commaColor = color.background;
            hFontSize = "13px";
        }
        else if (mode === "lineV") {
            hColor = color.background;
            commaColor = color.background;
            wFontSize = "13px";
        }
        else if (mode === "point") {
            wFontSize = "13px";
            hFontSize = "13px";
        }
        coordTooltip.innerHTML = `<span style="color: ${wColor}; font-size: ${wFontSize}">W:${w}</span><span style="color: ${commaColor}">, </span><span style="color: ${hColor}; font-size: ${hFontSize}">H:${h}</span>`;
        coordTooltip.style.display = "block";
        coordTooltip.style.left = `${e.clientX + 15}px`;
        coordTooltip.style.top = `${e.clientY + 15}px`;
    }
    function applyInteraction(e, mode = null) {
        const rect = sliderBox.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0)
            return;
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
        const minW = widgetWidth.options?.min ?? 64;
        const maxW = widgetWidth.options?.max ?? 4096;
        const minH = widgetHeight.options?.min ?? 64;
        const maxH = widgetHeight.options?.max ?? 4096;
        const stepW = widgetWidth.options?.step2 ?? widgetWidth.options?.step ?? 64;
        const stepH = widgetHeight.options?.step2 ?? widgetHeight.options?.step ?? 64;
        let newW = widgetWidth.value;
        let newH = widgetHeight.value;
        if (mode === "lineV") {
            newW = x * maxW;
            newW = Math.round(newW / stepW) * stepW;
            newW = Math.max(minW, Math.min(maxW, newW));
        }
        else if (mode === "lineH") {
            newH = y * maxH;
            newH = Math.round(newH / stepH) * stepH;
            newH = Math.max(minH, Math.min(maxH, newH));
        }
        else {
            newW = x * maxW;
            newH = y * maxH;
            newW = Math.round(newW / stepW) * stepW;
            newH = Math.round(newH / stepH) * stepH;
            newW = Math.max(minW, Math.min(maxW, newW));
            newH = Math.max(minH, Math.min(maxH, newH));
        }
        checkAndSetCustom(newW, newH);
        isProgrammaticUpdate = true;
        forceUpdateWidgetValue(widgetWidth, newW);
        forceUpdateWidgetValue(widgetHeight, newH);
        isProgrammaticUpdate = false;
        updateDisplay();
    }
    // 主题监听
    const unwatchTheme = watchThemeToken((token) => {
        color = token.color;
        updateDisplay();
        if (point.style.outlineWidth && point.style.outlineWidth !== "0px") {
            point.style.outlineColor = color.text;
        }
        if (lineHVisual.style.outlineWidth && lineHVisual.style.outlineWidth !== "0px") {
            lineHVisual.style.outlineColor = color.text;
        }
        if (lineVVisual.style.outlineWidth && lineVVisual.style.outlineWidth !== "0px") {
            lineVVisual.style.outlineColor = color.text;
        }
    });
    // 交互事件
    point.addEventListener("mouseenter", () => {
        if (!isDragging)
            point.style.outline = `2px solid ${color.text}`;
    });
    point.addEventListener("mouseleave", () => {
        if (!isDragging)
            point.style.outline = "none";
    });
    lineH.addEventListener("mouseenter", () => {
        if (!isDragging || dragMode !== "lineH")
            lineHVisual.style.outline = `1px solid ${color.text}`;
    });
    lineH.addEventListener("mouseleave", () => {
        if (!isDragging || dragMode !== "lineH")
            lineHVisual.style.outline = "none";
    });
    lineV.addEventListener("mouseenter", () => {
        if (!isDragging || dragMode !== "lineV")
            lineVVisual.style.outline = `1px solid ${color.text}`;
    });
    lineV.addEventListener("mouseleave", () => {
        if (!isDragging || dragMode !== "lineV")
            lineVVisual.style.outline = "none";
    });
    point.addEventListener("mousedown", (e) => {
        if (e.button !== 0)
            return;
        restoreOriginalStep();
        isDragging = true;
        dragMode = "point";
        currentSliderBox = sliderBox;
        point.style.cursor = "grabbing";
        point.style.outline = `2px solid ${color.text}`;
        updateCoordTooltip(e, dragMode);
        applyInteraction(e, dragMode);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    });
    lineH.addEventListener("mousedown", (e) => {
        if (e.button !== 0)
            return;
        restoreOriginalStep();
        isDragging = true;
        dragMode = "lineH";
        currentSliderBox = sliderBox;
        lineHVisual.style.outline = `1px solid ${color.text}`;
        document.body.style.cursor = "ns-resize";
        updateCoordTooltip(e, dragMode);
        applyInteraction(e, dragMode);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    });
    lineV.addEventListener("mousedown", (e) => {
        if (e.button !== 0)
            return;
        restoreOriginalStep();
        isDragging = true;
        dragMode = "lineV";
        currentSliderBox = sliderBox;
        lineVVisual.style.outline = `1px solid ${color.text}`;
        document.body.style.cursor = "ew-resize";
        updateCoordTooltip(e, dragMode);
        applyInteraction(e, dragMode);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    });
    sliderBox.addEventListener("mousedown", (e) => {
        if (e.button !== 0)
            return;
        if (e.target === lineH || e.target === lineV || e.target === point)
            return;
        restoreOriginalStep();
        isDragging = true;
        dragMode = "point";
        currentSliderBox = sliderBox;
        sliderBox.classList.add("dragging");
        updateCoordTooltip(e, dragMode);
        applyInteraction(e, dragMode);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    });
    sliderBox.addEventListener("mousemove", (e) => {
        if (isDragging)
            return;
        updateCoordTooltip(e, null);
    });
    sliderBox.addEventListener("mouseleave", () => {
        if (isDragging)
            return;
        coordTooltip.style.display = "none";
    });
    const handleMouseMove = (e) => {
        if (!isDragging || currentSliderBox !== sliderBox)
            return;
        updateCoordTooltip(e, dragMode);
        applyInteraction(e, dragMode);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    };
    const handleMouseUp = (e) => {
        if (!isDragging || currentSliderBox !== sliderBox)
            return;
        isDragging = false;
        currentSliderBox = null;
        dragMode = null;
        sliderBox.classList.remove("dragging");
        point.style.cursor = "grab";
        point.style.outline = "none";
        lineHVisual.style.outline = "none";
        lineVVisual.style.outline = "none";
        document.body.style.cursor = "";
        coordTooltip.style.display = "none";
        forceRefresh(node);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    };
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("mouseup", handleMouseUp, true);
    // 创建 widget
    const widget = node.addDOMWidget("canvas_2d_slider", "CANVAS_2D_SLIDER", container, {
        serialize: false,
        hideOnZoom: false,
    });
    widget.computeSize = function (width) {
        const nodeWidth = node.size?.[0] ?? 300;
        const nodeHeight = node.size?.[1] ?? 400;
        const LiteGraph = window.LiteGraph;
        const headerHeight = LiteGraph?.NODE_TITLE_HEIGHT ?? 30;
        let otherWidgetsHeight = headerHeight + 15;
        for (const w of node.widgets || []) {
            if (w === widget)
                continue;
            if (w.computeSize) {
                otherWidgetsHeight += w.computeSize(nodeWidth)[1] + 4;
            }
            else {
                otherWidgetsHeight += (LiteGraph?.NODE_WIDGET_HEIGHT ?? 20) + 4;
            }
        }
        const padding = 30;
        const availableWidth = nodeWidth - padding;
        const availableHeight = nodeHeight - otherWidgetsHeight - 30;
        const size = Math.max(100, Math.min(availableWidth, availableHeight, 400));
        sliderBox.style.width = `${size}px`;
        sliderBox.style.height = `${size}px`;
        return [width, size + 20];
    };
    const originalDraw = widget.draw;
    widget.draw = function (ctx, _node, width, y, height) {
        updateDisplay();
        if (originalDraw)
            return originalDraw.apply(this, [ctx, _node, width, y, height]);
    };
    widget.updateDisplay = updateDisplay;
    widget.isProgrammaticUpdate = () => isProgrammaticUpdate;
    widget.setPresetTemporaryStep = function () {
        if (!isPresetTemporaryStep) {
            userStepW = widgetWidth.options?.step2 ?? widgetWidth.options?.step ?? 64;
            userStepH = widgetHeight.options?.step2 ?? widgetHeight.options?.step ?? 64;
        }
        widgetWidth.options.step = 1;
        widgetWidth.options.step2 = 1;
        widgetHeight.options.step = 1;
        widgetHeight.options.step2 = 1;
        isPresetTemporaryStep = true;
    };
    widget.updateUserStep = function (stepW, stepH) {
        userStepW = stepW;
        userStepH = stepH;
    };
    widget.onRemove = function () {
        if (isDragging && currentSliderBox === sliderBox) {
            isDragging = false;
            currentSliderBox = null;
            sliderBox.classList.remove("dragging");
        }
        unwatchTheme();
        if (coordTooltip && document.body.contains(coordTooltip)) {
            document.body.removeChild(coordTooltip);
        }
        document.removeEventListener("mousemove", handleMouseMove, true);
        document.removeEventListener("mouseup", handleMouseUp, true);
    };
    updateDisplay();
    setTimeout(updateDisplay, 100);
    return widget;
}
