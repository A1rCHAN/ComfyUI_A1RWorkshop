import { app } from "/scripts/app.js";
import { showCanvasSettingDialog } from "../helper/canvas_setting.js";
import { SIZE_PRESETS, create2DSliderWidget, forceRefresh, forceUpdateWidgetValue, restoreWidgetRange, saveWidgetRange, } from "../helper/canvas_widget.js";
import { initGlobalThemeCSSVar, injectCSS } from "../theme/themeWatcher.js";
export const openCanvasSetting = async (node) => {
    const widgetWidth = node.widgets.find((w) => w.name === "width");
    const widgetHeight = node.widgets.find((w) => w.name === "height");
    const targetWidgets = [widgetWidth, widgetHeight].filter((w) => w);
    if (!widgetWidth)
        return;
    const currentMin = widgetWidth.options.min ?? 128;
    const currentMax = widgetWidth.options.max ?? 4096;
    const slider2DWidget = node.widgets.find((w) => w.name === "canvas_2d_slider");
    const realStep = slider2DWidget?.getUserStep?.()?.stepW;
    const currentStep = realStep ?? widgetWidth.options.step2 ?? widgetWidth.options.step ?? 128;
    const result = await showCanvasSettingDialog({ currentMin, currentMax, currentStep });
    if (result === null)
        return;
    const { min, max, step } = result;
    targetWidgets.forEach((w) => {
        w.options.min = min;
        w.options.max = max;
        w.options.step2 = step;
        w.options.step = step;
        let newValue = w.value;
        if (newValue < min)
            newValue = min;
        if (newValue > max)
            newValue = max;
        newValue = Math.round(newValue / step) * step;
        if (newValue < min)
            newValue = min;
        if (newValue > max)
            newValue = max;
        forceUpdateWidgetValue(w, newValue);
    });
    const slider2D = node.widgets.find((w) => w.name === "canvas_2d_slider");
    if (slider2D && typeof slider2D.updateUserStep === "function") {
        slider2D.updateUserStep(step, step);
    }
    saveWidgetRange(node);
    forceRefresh(node);
    if (slider2D?.updateDisplay)
        slider2D.updateDisplay();
    setTimeout(() => forceRefresh(node), 50);
};
app.registerExtension({
    name: "a1rworkshop.sizecanvas",
    async setup() {
        initGlobalThemeCSSVar();
        injectCSS("../../css/a1r-slider.css", import.meta.url);
        injectCSS("../../css/a1r-canvas.css", import.meta.url);
    },
    async nodeCreated(node) {
        if (node.comfyClass !== "SizeCanvas")
            return;
        const widgetPreset = node.widgets.find((w) => w.name === "preset");
        const widgetWidth = node.widgets.find((w) => w.name === "width");
        const widgetHeight = node.widgets.find((w) => w.name === "height");
        if (!widgetPreset || !widgetWidth || !widgetHeight)
            return;
        node.properties = node.properties || {};
        restoreWidgetRange(node);
        const slider2D = create2DSliderWidget(node, widgetPreset, widgetWidth, widgetHeight);
        const minNodeWidth = 250;
        const minNodeHeight = 380;
        if (node.size[0] < minNodeWidth)
            node.size[0] = minNodeWidth;
        if (node.size[1] < minNodeHeight)
            node.size[1] = minNodeHeight;
        const originalOnRemoved = node.onRemoved;
        node.onRemoved = function () {
            if (slider2D.onRemove)
                slider2D.onRemove();
            if (originalOnRemoved)
                originalOnRemoved.apply(this, arguments);
        };
        const originalOnConfigure = node.onConfigure;
        node.onConfigure = function (info) {
            if (originalOnConfigure)
                originalOnConfigure.apply(this, [info]);
            restoreWidgetRange(this);
            if (slider2D?.updateDisplay) {
                try {
                    slider2D.updateDisplay();
                }
                catch (err) {
                    console.warn("Failed to update display in onConfigure:", err);
                }
            }
            forceRefresh(this);
        };
        const originalOnSerialize = node.onSerialize;
        node.onSerialize = function (info) {
            if (originalOnSerialize)
                originalOnSerialize.apply(this, [info]);
            saveWidgetRange(this);
            if (info.properties)
                info.properties.widgetRange = this.properties?.widgetRange;
        };
        setTimeout(() => {
            restoreWidgetRange(node);
            if (slider2D?.updateDisplay) {
                try {
                    slider2D.updateDisplay();
                }
                catch (err) {
                    console.warn("Failed to update display in setTimeout:", err);
                }
            }
        }, 500);
        let isProgrammaticChange = false;
        let isPresetChanging = false;
        const onPresetChange = (value) => {
            if (value === "Custom")
                return;
            const size = SIZE_PRESETS[value];
            if (size) {
                isPresetChanging = true;
                try {
                    if (typeof slider2D.setPresetTemporaryStep === "function") {
                        slider2D.setPresetTemporaryStep();
                    }
                }
                catch (err) {
                    console.warn("Failed to set preset temporary step:", err);
                }
                isProgrammaticChange = true;
                forceUpdateWidgetValue(widgetWidth, size[0]);
                forceUpdateWidgetValue(widgetHeight, size[1]);
                isProgrammaticChange = false;
                isPresetChanging = false;
                try {
                    if (typeof slider2D.updateDisplay === "function")
                        slider2D.updateDisplay();
                }
                catch (err) {
                    console.warn("Failed to update display:", err);
                }
            }
        };
        const checkCustomState = () => {
            if (isProgrammaticChange)
                return;
            if (slider2D?.isProgrammaticUpdate?.())
                return;
            const currentPreset = widgetPreset.value;
            if (currentPreset === "Custom")
                return;
            const targetSizes = SIZE_PRESETS[currentPreset];
            if (!targetSizes)
                return;
            if (widgetWidth.value !== targetSizes[0] || widgetHeight.value !== targetSizes[1]) {
                widgetPreset.value = "Custom";
                if (typeof slider2D.updateDisplay === "function") {
                    try {
                        slider2D.updateDisplay();
                    }
                    catch (err) {
                        console.warn("Failed to update display in checkCustomState:", err);
                    }
                }
                forceRefresh(node);
            }
        };
        const originalPresetCallback = widgetPreset.callback;
        widgetPreset.callback = function (value) {
            onPresetChange(value);
            return originalPresetCallback ? originalPresetCallback.apply(this, [value]) : undefined;
        };
        const originalWidthCallback = widgetWidth.callback;
        widgetWidth.callback = function (value) {
            const r = originalWidthCallback ? originalWidthCallback.apply(this, [value]) : undefined;
            checkCustomState();
            if (!isPresetChanging && typeof slider2D.updateDisplay === "function") {
                try {
                    slider2D.updateDisplay();
                }
                catch (err) {
                    console.warn("Failed to update display in width callback:", err);
                }
            }
            return r;
        };
        const originalHeightCallback = widgetHeight.callback;
        widgetHeight.callback = function (value) {
            const r = originalHeightCallback ? originalHeightCallback.apply(this, [value]) : undefined;
            checkCustomState();
            if (!isPresetChanging && typeof slider2D.updateDisplay === "function") {
                try {
                    slider2D.updateDisplay();
                }
                catch (err) {
                    console.warn("Failed to update display in height callback:", err);
                }
            }
            return r;
        };
    },
});
