import { getCanvasSettingState, initCanvasSettingState } from "../data/state.js";
import { DIALOG_TYPE, DialogBuilder } from "../theme/dialog.js";
import { createContainer, createLabel, showToast } from "../theme/themeUtils.js";
export function showCanvasSettingDialog({ currentMin, currentMax, currentStep, onApply, }) {
    return new Promise((resolve) => {
        initCanvasSettingState({
            currentMin: Number(currentMin),
            currentMax: Number(currentMax),
            currentStep: Number(currentStep),
        });
        const state = getCanvasSettingState();
        const updaters = { rangeUpdateVisual: null, stepUpdateVisual: null };
        const cleanupFunctions = [];
        const content = document.createElement("div");
        content.className = "a1r-slider-content";
        const rangeSection = createRangeSection(state, cleanupFunctions, updaters);
        const stepSection = createStepSection(state, cleanupFunctions, updaters);
        content.appendChild(rangeSection);
        content.appendChild(stepSection);
        const builder = new DialogBuilder(DIALOG_TYPE.FORM)
            .setTitle("Canvas Setting")
            .setContent(content)
            .setCloseOnOverlayClick(true)
            .setCloseOnEsc(true)
            .setCloseButton(false)
            .setAutoFocus(false)
            .onClose(() => {
            cleanupFunctions.forEach(fn => fn());
        })
            .addButton("Cancel", "secondary", () => null)
            .addButton("Save", "secondary", () => {
            showToast("Canvas Saved", "success");
            return {
                min: state.rangeMinValue,
                max: state.rangeMaxValue,
                step: state.rangeStepValue,
            };
        })
            .addButton("Apply", "secondary", () => {
            showToast("Canvas Applied", "info");
            onApply?.({
                min: state.rangeMinValue,
                max: state.rangeMaxValue,
                step: state.rangeStepValue,
            });
        }, { closeAfterClick: false });
        builder.open().then(resolve);
    });
}
function createRangeSection(state, cleanupFns, updaters) {
    const container = document.createElement("div");
    container.className = "a1r-slider-section";
    const row = document.createElement("div");
    row.className = "a1r-slider-row";
    const label = createLabel("range");
    label.classList.add("a1r-slider-label");
    const wrapper = createContainer();
    wrapper.classList.add("a1r-slider-wrapper");
    const minDisplay = createLabel(state.rangeMinValue.toString());
    minDisplay.classList.add("a1r-slider-value-display");
    minDisplay.style.textAlign = "left";
    const sliderContainer = createContainer();
    sliderContainer.classList.add("a1r-slider-container");
    const track = document.createElement("div");
    track.className = "a1r-slider-track";
    const activeTrack = document.createElement("div");
    activeTrack.className = "a1r-slider-track-active";
    const minThumb = document.createElement("div");
    minThumb.className = "a1r-slider-thumb";
    const maxThumb = document.createElement("div");
    maxThumb.className = "a1r-slider-thumb";
    const maxDisplay = createLabel(state.rangeMaxValue.toString());
    maxDisplay.classList.add("a1r-slider-value-display");
    maxDisplay.style.textAlign = "right";
    sliderContainer.appendChild(track);
    sliderContainer.appendChild(activeTrack);
    sliderContainer.appendChild(minThumb);
    sliderContainer.appendChild(maxThumb);
    wrapper.appendChild(minDisplay);
    wrapper.appendChild(sliderContainer);
    wrapper.appendChild(maxDisplay);
    row.appendChild(label);
    row.appendChild(wrapper);
    const updateVisual = () => {
        minDisplay.textContent = state.rangeMinValue.toString();
        maxDisplay.textContent = state.rangeMaxValue.toString();
        const R = state.THUMB_RADIUS;
        const minPct = ((state.rangeMinValue - state.MIN_RANGE) / (state.MAX_RANGE - state.MIN_RANGE)) * 100;
        const maxPct = ((state.rangeMaxValue - state.MIN_RANGE) / (state.MAX_RANGE - state.MIN_RANGE)) * 100;
        activeTrack.style.left = `calc(${R}px + (100% - ${R * 2}px) * ${minPct / 100})`;
        activeTrack.style.right = `calc(${R}px + (100% - ${R * 2}px) * ${(100 - maxPct) / 100})`;
        minThumb.style.left = `calc(${R}px + (100% - ${R * 2}px) * ${minPct / 100})`;
        maxThumb.style.left = `calc(${R}px + (100% - ${R * 2}px) * ${maxPct / 100})`;
    };
    updaters.rangeUpdateVisual = updateVisual;
    const onMouseDown = (e) => {
        state.peakStepValue = state.rangeStepValue;
        const rect = sliderContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const stepVal = state.rangeStepValue;
        const minThumbX = valueToThumbX(state.rangeMinValue, rect, state);
        const maxThumbX = valueToThumbX(state.rangeMaxValue, rect, state);
        const nearMin = Math.abs(mouseX - minThumbX) <= state.THUMB_RADIUS + 4;
        const nearMax = Math.abs(mouseX - maxThumbX) <= state.THUMB_RADIUS + 4;
        if (nearMin || nearMax) {
            if (nearMin && nearMax) {
                state.dragTarget = (mouseX - minThumbX < maxThumbX - mouseX) ? "min" : "max";
            }
            else {
                state.dragTarget = nearMin ? "min" : "max";
            }
        }
        else {
            const clickVal = pxToValue(mouseX, rect, state);
            const midPoint = (state.rangeMinValue + state.rangeMaxValue) / 2;
            if (clickVal < midPoint) {
                state.dragTarget = "min";
                const direction = clickVal < state.rangeMinValue ? -1 : 1;
                state.rangeMinValue = snapSlider(state.rangeMinValue + direction * stepVal, stepVal, false, state);
                if (state.rangeMinValue >= state.rangeMaxValue) {
                    state.rangeMaxValue = state.rangeMinValue + stepVal;
                    if (state.rangeMaxValue > state.MAX_RANGE) {
                        state.rangeMaxValue = state.MAX_RANGE;
                        state.rangeMinValue = state.rangeMaxValue - stepVal;
                    }
                }
            }
            else {
                state.dragTarget = "max";
                const direction = clickVal < state.rangeMaxValue ? -1 : 1;
                state.rangeMaxValue = snapSlider(state.rangeMaxValue + direction * stepVal, stepVal, true, state);
                if (state.rangeMaxValue <= state.rangeMinValue) {
                    state.rangeMinValue = state.rangeMaxValue - stepVal;
                    if (state.rangeMinValue < stepVal) {
                        state.rangeMinValue = stepVal;
                        state.rangeMaxValue = state.rangeMinValue + stepVal;
                    }
                }
            }
            updateVisual();
        }
        state.isDragging = true;
        state.dragStartMouseX = mouseX;
        state.dragStartMinValue = state.rangeMinValue;
        state.dragStartMaxValue = state.rangeMaxValue;
        const activeThumb = state.dragTarget === "min" ? minThumb : maxThumb;
        activeThumb.style.transform = "translate(-50%, -50%) scale(1.2)";
        activeThumb.style.outline = "2px solid var(--a1r-color-text)";
        sliderContainer.style.cursor = "grabbing";
        e.preventDefault();
    };
    const onMouseMove = (e) => {
        if (!state.isDragging || !state.dragTarget)
            return;
        const rect = sliderContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const stepVal = state.rangeStepValue;
        const deltaX = mouseX - state.dragStartMouseX;
        const trackWidth = rect.width - state.THUMB_RADIUS * 2;
        const deltaValue = (deltaX / trackWidth) * (state.MAX_RANGE - state.MIN_RANGE);
        if (state.dragTarget === "min") {
            let newMin = snapSlider(state.dragStartMinValue + deltaValue, stepVal, false, state);
            newMin = Math.max(stepVal, newMin);
            if (newMin + stepVal > state.rangeMaxValue) {
                state.rangeMaxValue = newMin + stepVal;
                if (state.rangeMaxValue > state.MAX_RANGE) {
                    state.rangeMaxValue = state.MAX_RANGE;
                    newMin = state.rangeMaxValue - stepVal;
                }
            }
            state.rangeMinValue = newMin;
        }
        else {
            let newMax = snapSlider(state.dragStartMaxValue + deltaValue, stepVal, true, state);
            newMax = Math.min(state.MAX_RANGE, newMax);
            if (newMax < stepVal * 2)
                newMax = stepVal * 2;
            if (newMax - stepVal < state.rangeMinValue) {
                state.rangeMinValue = newMax - stepVal;
                if (state.rangeMinValue < stepVal) {
                    state.rangeMinValue = stepVal;
                    newMax = state.rangeMinValue + stepVal;
                }
            }
            state.rangeMaxValue = newMax;
        }
        updateVisual();
    };
    const onMouseUp = (e) => {
        if (!state.isDragging)
            return;
        state.isDragging = false;
        minThumb.style.transform = "translate(-50%, -50%) scale(1)";
        maxThumb.style.transform = "translate(-50%, -50%) scale(1)";
        sliderContainer.style.cursor = "pointer";
        updateHover(e);
        state.dragTarget = null;
    };
    const updateHover = (e) => {
        if (state.isDragging)
            return;
        const rect = sliderContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const minThumbX = valueToThumbX(state.rangeMinValue, rect, state);
        const maxThumbX = valueToThumbX(state.rangeMaxValue, rect, state);
        const nearMin = Math.abs(mouseX - minThumbX) <= 20;
        const nearMax = Math.abs(mouseX - maxThumbX) <= 20;
        if (nearMin || nearMax) {
            sliderContainer.style.cursor = "grab";
            minThumb.style.outline = nearMin ? "2px solid var(--a1r-color-text)" : "none";
            maxThumb.style.outline = nearMax ? "2px solid var(--a1r-color-text)" : "none";
        }
        else {
            sliderContainer.style.cursor = "pointer";
            minThumb.style.outline = "none";
            maxThumb.style.outline = "none";
        }
    };
    const onMouseLeave = () => {
        if (!state.isDragging) {
            minThumb.style.outline = "none";
            maxThumb.style.outline = "none";
            sliderContainer.style.cursor = "pointer";
        }
    };
    sliderContainer.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    sliderContainer.addEventListener("mousemove", updateHover);
    sliderContainer.addEventListener("mouseenter", updateHover);
    sliderContainer.addEventListener("mouseleave", onMouseLeave);
    cleanupFns.push(() => {
        sliderContainer.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        sliderContainer.removeEventListener("mousemove", updateHover);
        sliderContainer.removeEventListener("mouseenter", updateHover);
        sliderContainer.removeEventListener("mouseleave", onMouseLeave);
    });
    updateVisual();
    container.appendChild(row);
    return container;
}
function createStepSection(state, cleanupFns, updaters) {
    const container = document.createElement("div");
    container.className = "a1r-slider-section";
    const row = document.createElement("div");
    row.className = "a1r-slider-row";
    const label = createLabel("step");
    label.classList.add("a1r-slider-label");
    const wrapper = createContainer();
    wrapper.classList.add("a1r-slider-wrapper");
    const minDisplay = createLabel("128");
    minDisplay.classList.add("a1r-slider-value-display");
    minDisplay.style.textAlign = "left";
    const sliderContainer = createContainer();
    sliderContainer.classList.add("a1r-slider-container");
    const track = document.createElement("div");
    track.className = "a1r-slider-track";
    const activeTrack = document.createElement("div");
    activeTrack.className = "a1r-slider-track-active";
    activeTrack.style.left = "0";
    const stepThumb = document.createElement("div");
    stepThumb.className = "a1r-slider-thumb";
    stepThumb.style.zIndex = "6";
    const valueDisplay = createLabel(state.rangeStepValue.toString());
    valueDisplay.classList.add("a1r-slider-value-display");
    valueDisplay.style.textAlign = "right";
    sliderContainer.appendChild(track);
    sliderContainer.appendChild(activeTrack);
    sliderContainer.appendChild(stepThumb);
    wrapper.appendChild(minDisplay);
    wrapper.appendChild(sliderContainer);
    wrapper.appendChild(valueDisplay);
    row.appendChild(label);
    row.appendChild(wrapper);
    const updateVisual = () => {
        valueDisplay.textContent = state.rangeStepValue.toString();
        const R = state.THUMB_RADIUS;
        const stepPct = ((state.rangeStepValue - state.STEP_MIN) / (state.STEP_MAX - state.STEP_MIN)) * 100;
        activeTrack.style.right = `calc(${R}px + (100% - ${R * 2}px) * ${(100 - stepPct) / 100})`;
        stepThumb.style.left = `calc(${R}px + (100% - ${R * 2}px) * ${stepPct / 100})`;
    };
    updaters.stepUpdateVisual = updateVisual;
    const syncRangeToStep = () => {
        const stepVal = state.rangeStepValue;
        if (stepVal <= state.peakStepValue)
            return;
        state.peakStepValue = stepVal;
        if (stepVal <= state.rangeMinValue)
            return;
        if (stepVal > state.rangeMinValue) {
            state.rangeMinValue = snapSlider(state.rangeMinValue, stepVal, false, state);
        }
        if (stepVal > state.rangeMaxValue) {
            state.rangeMaxValue = snapSlider(state.rangeMaxValue, stepVal, true, state);
        }
        if (state.rangeMaxValue - state.rangeMinValue < stepVal) {
            state.rangeMaxValue = state.rangeMinValue + stepVal;
            if (state.rangeMaxValue > state.MAX_RANGE) {
                state.rangeMaxValue = state.MAX_RANGE;
                state.rangeMinValue = state.rangeMaxValue - stepVal;
            }
        }
        if (updaters.rangeUpdateVisual)
            updaters.rangeUpdateVisual();
    };
    const stepPxToValue = (mouseX, rect) => {
        const trackWidth = rect.width - state.THUMB_RADIUS * 2;
        const x = mouseX - state.THUMB_RADIUS;
        const ratio = Math.max(0, Math.min(1, x / trackWidth));
        const raw = state.STEP_MIN + ratio * (state.STEP_MAX - state.STEP_MIN);
        return Math.max(state.STEP_MIN, Math.min(state.STEP_MAX, Math.round(raw / state.STEP_MIN) * state.STEP_MIN));
    };
    const stepValueToThumbX = (val, rect) => {
        return state.THUMB_RADIUS + ((val - state.STEP_MIN) / (state.STEP_MAX - state.STEP_MIN)) * (rect.width - state.THUMB_RADIUS * 2);
    };
    const onMouseDown = (e) => {
        const rect = sliderContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const thumbX = stepValueToThumbX(state.rangeStepValue, rect);
        const nearThumb = Math.abs(mouseX - thumbX) <= state.THUMB_RADIUS + 4;
        if (!nearThumb) {
            const direction = mouseX > thumbX ? 1 : -1;
            state.rangeStepValue = Math.max(state.STEP_MIN, Math.min(state.STEP_MAX, state.rangeStepValue + direction * state.STEP_MIN));
            updateVisual();
            syncRangeToStep();
        }
        state.isStepDragging = true;
        state.stepDragStartMouseX = mouseX;
        state.stepDragStartValue = state.rangeStepValue;
        stepThumb.style.transform = "translate(-50%, -50%) scale(1.2)";
        stepThumb.style.outline = "2px solid var(--a1r-color-text)";
        sliderContainer.style.cursor = "grabbing";
        e.preventDefault();
    };
    const onMouseMove = (e) => {
        if (!state.isStepDragging)
            return;
        const rect = sliderContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const deltaX = mouseX - state.stepDragStartMouseX;
        const trackWidth = rect.width - state.THUMB_RADIUS * 2;
        const deltaValue = (deltaX / trackWidth) * (state.STEP_MAX - state.STEP_MIN);
        const newVal = Math.max(state.STEP_MIN, Math.min(state.STEP_MAX, Math.round((state.stepDragStartValue + deltaValue) / state.STEP_MIN) * state.STEP_MIN));
        if (newVal !== state.rangeStepValue) {
            state.rangeStepValue = newVal;
            updateVisual();
            syncRangeToStep();
        }
    };
    const onMouseUp = (e) => {
        if (!state.isStepDragging)
            return;
        state.isStepDragging = false;
        stepThumb.style.transform = "translate(-50%, -50%) scale(1)";
        sliderContainer.style.cursor = "pointer";
        updateHover(e);
    };
    const updateHover = (e) => {
        if (state.isStepDragging)
            return;
        const rect = sliderContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const thumbX = stepValueToThumbX(state.rangeStepValue, rect);
        if (Math.abs(mouseX - thumbX) <= 20) {
            sliderContainer.style.cursor = "grab";
            stepThumb.style.outline = "2px solid var(--a1r-color-text)";
        }
        else {
            sliderContainer.style.cursor = "pointer";
            stepThumb.style.outline = "none";
        }
    };
    const onMouseLeave = () => {
        if (!state.isStepDragging) {
            stepThumb.style.outline = "none";
            sliderContainer.style.cursor = "pointer";
        }
    };
    sliderContainer.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    sliderContainer.addEventListener("mousemove", updateHover);
    sliderContainer.addEventListener("mouseenter", updateHover);
    sliderContainer.addEventListener("mouseleave", onMouseLeave);
    cleanupFns.push(() => {
        sliderContainer.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        sliderContainer.removeEventListener("mousemove", updateHover);
        sliderContainer.removeEventListener("mouseenter", updateHover);
        sliderContainer.removeEventListener("mouseleave", onMouseLeave);
    });
    updateVisual();
    container.appendChild(row);
    return container;
}
function snapSlider(value, stepValue, snap2Max, state) {
    const snapped = Math.round(value / stepValue) * stepValue;
    if (snap2Max && snapped > state.MAX_RANGE - stepValue)
        return state.MAX_RANGE;
    return Math.max(stepValue, Math.min(state.MAX_RANGE, snapped));
}
function pxToValue(mouseX, rect, state) {
    const trackWidth = rect.width - state.THUMB_RADIUS * 2;
    const x = mouseX - state.THUMB_RADIUS;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    return state.MIN_RANGE + ratio * (state.MAX_RANGE - state.MIN_RANGE);
}
function valueToThumbX(value, rect, state) {
    return state.THUMB_RADIUS + (value - state.MIN_RANGE) / (state.MAX_RANGE - state.MIN_RANGE) * (rect.width - state.THUMB_RADIUS * 2);
}
