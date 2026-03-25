function createCanvasSettingState(input) {
    const { currentMin, currentMax, currentStep } = input;
    return {
        rangeMinValue: currentMin,
        rangeMaxValue: currentMax,
        isDragging: false,
        dragTarget: null,
        rangeStepValue: currentStep,
        isStepDragging: false,
        stepDragStartMouseX: 0,
        stepDragStartValue: 0,
        peakStepValue: currentStep,
        dragStartMouseX: 0,
        dragStartMinValue: currentMin,
        dragStartMaxValue: currentMax,
        MIN_RANGE: 128,
        MAX_RANGE: 4096,
        STEP_MIN: 128,
        STEP_MAX: 1024,
        THUMB_RADIUS: 8,
    };
}
const canvasSettingState = createCanvasSettingState({
    currentMin: 512,
    currentMax: 2048,
    currentStep: 256,
});
export function getCanvasSettingState() {
    return canvasSettingState;
}
export function initCanvasSettingState(input) {
    Object.assign(canvasSettingState, createCanvasSettingState(input));
}
