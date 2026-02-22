import { ComfyThemeAdapter } from "../adapter.js";
import { custom } from "../style.js";
import { hexToRgba } from "../theme.js";
import { DialogBuilder, DIALOG_TYPE } from "../dialog.js";
import { app } from "/scripts/app.js";

// ========== 抑制 PrimeVue Select 已知 bug ==========
if (!window.__pv_select_el_null_suppressed) {
  window.__pv_select_el_null_suppressed = true;
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason instanceof TypeError &&
        event.reason.message === "Cannot read properties of null (reading '$el')") {
      event.preventDefault();
    }
  });
}

// ========== 配置 ==========

const SIZE_PRESETS = {
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
  "3:4 768x1024": [768, 1024]
};

// ========== 自定义 Slider 对话框 ==========

function showCanvasSettingDialog({ currentMin, currentMax, currentStep }) {
  return new Promise((resolve) => {
    const adapter = new ComfyThemeAdapter();
    let theme = adapter.theme;

    // 状态管理对象 - 完全按照原始逻辑重构
    const state = {
      // Range 状态
      rangeMinVal: currentMin,
      rangeMaxVal: currentMax,
      isDragging: false,
      dragTarget: null,
      
      // Step 状态
      stepCurrentVal: currentStep,
      isStepDragging: false,
      stepDragStartMouseX: 0,
      stepDragStartVal: 0,
      peakStepVal: currentStep,
      
      // 拖拽起始状态
      dragStartMouseX: 0,
      dragStartMinVal: currentMin,
      dragStartMaxVal: currentMax,
      
      // 常量
      MAX_RANGE: 4096,
      MIN_RANGE: 128,
      STEP_MIN: 128,
      STEP_MAX: 1024,
      THUMB_R: 8
    };

    // 用于存储更新函数的引用，实现跨 section 通信
    const updaters = {
      rangeUpdateVisual: null,
      stepUpdateVisual: null
    };

    const cleanupFns = [];

    // 创建内容容器
    const content = document.createElement("div");
    content.style.cssText = "display: flex; flex-direction: column; gap: 16px; width: 100%;";

    // Range Section - 传入 updaters 以便注册更新函数
    const rangeSection = createRangeSection(theme, state, adapter, cleanupFns, updaters);
    content.appendChild(rangeSection);

    // Step Section - 传入 updaters 和 range 的更新函数
    const stepSection = createStepSection(theme, state, adapter, cleanupFns, updaters);
    content.appendChild(stepSection);

    // 构建对话框
    const builder = new DialogBuilder(DIALOG_TYPE.FORM)
      .setTitle("Canvas Setting")
      .setContent(content)
      .setCloseOnOverlayClick(true)
      .setCloseOnEsc(true)
      .setCloseButton(false)
      .addButton("Cancel", "secondary", () => {
        cleanupFns.forEach(fn => fn());
        return null;
      })
      .addButton("Apply", "secondary", () => {
        cleanupFns.forEach(fn => fn());
        return { 
          min: state.rangeMinVal, 
          max: state.rangeMaxVal, 
          step: state.stepCurrentVal 
        };
      }, { autoFocus: true });
    
    builder.open().then(resolve);
  });
}

// ========== Range Section ==========

function createRangeSection(theme, state, adapter, cleanupFns, updaters) {
  const section = document.createElement("div");
  section.style.marginBottom = "8px";

  const row = custom.container(theme);
  const label = custom.sectionLabel("range", theme);
  row.appendChild(label);

  const controlWrapper = custom.controlWrapper(theme);
  row.appendChild(controlWrapper);

  const minDisplay = custom.valueDisplay(state.rangeMinVal, theme, "left");
  minDisplay.style.paddingLeft = "6px";
  controlWrapper.appendChild(minDisplay);

  const sliderContainer = custom.sliderContainer();
  controlWrapper.appendChild(sliderContainer);

  const track = custom.sliderTrack(theme);
  sliderContainer.appendChild(track);

  const activeTrack = custom.activeTrack(theme);
  sliderContainer.appendChild(activeTrack);

  const minSlider = custom.hiddenSlider({
    min: state.stepCurrentVal,
    max: state.MAX_RANGE,
    step: state.stepCurrentVal,
    value: state.rangeMinVal
  }, { zIndex: "4" });
  
  const maxSlider = custom.hiddenSlider({
    min: state.stepCurrentVal,
    max: state.MAX_RANGE,
    step: state.stepCurrentVal,
    value: state.rangeMaxVal
  }, { zIndex: "5" });

  const minThumb = custom.sliderThumb(theme);
  const maxThumb = custom.sliderThumb(theme);

  sliderContainer.appendChild(minThumb);
  sliderContainer.appendChild(maxThumb);
  sliderContainer.appendChild(minSlider);
  sliderContainer.appendChild(maxSlider);

  const maxDisplay = custom.valueDisplay(state.rangeMaxVal, theme, "right");
  maxDisplay.style.paddingRight = "6px";
  controlWrapper.appendChild(maxDisplay);

  // 工具函数
  const snapToStep = (val, stepVal, snapToMax) => {
    const snapped = Math.round(val / stepVal) * stepVal;
    if (snapToMax && snapped > state.MAX_RANGE - stepVal) return state.MAX_RANGE;
    return Math.max(stepVal, Math.min(state.MAX_RANGE, snapped));
  };

  const pxToValue = (mouseX, rect) => {
    const trackWidth = rect.width - state.THUMB_R * 2;
    const x = mouseX - state.THUMB_R;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    return state.MIN_RANGE + ratio * (state.MAX_RANGE - state.MIN_RANGE);
  };

  const valueToThumbX = (val, rect) => {
    return state.THUMB_R + ((val - state.MIN_RANGE) / (state.MAX_RANGE - state.MIN_RANGE)) * (rect.width - state.THUMB_R * 2);
  };

  const getStepVal = () => state.stepCurrentVal;

  // 视觉更新函数 - 注册到 updaters 供外部调用
  const updateVisual = () => {
    minSlider.value = state.rangeMinVal;
    maxSlider.value = state.rangeMaxVal;
    minDisplay.textContent = state.rangeMinVal;
    maxDisplay.textContent = state.rangeMaxVal;

    const minPercent = ((state.rangeMinVal - state.MIN_RANGE) / (state.MAX_RANGE - state.MIN_RANGE)) * 100;
    const maxPercent = ((state.rangeMaxVal - state.MIN_RANGE) / (state.MAX_RANGE - state.MIN_RANGE)) * 100;

    activeTrack.style.left = `calc(${state.THUMB_R}px + (100% - ${state.THUMB_R * 2}px) * ${minPercent / 100})`;
    activeTrack.style.right = `calc(${state.THUMB_R}px + (100% - ${state.THUMB_R * 2}px) * ${(100 - maxPercent) / 100})`;

    minThumb.style.left = `calc(${state.THUMB_R}px + (100% - ${state.THUMB_R * 2}px) * ${minPercent / 100})`;
    maxThumb.style.left = `calc(${state.THUMB_R}px + (100% - ${state.THUMB_R * 2}px) * ${maxPercent / 100})`;
  };

  // 注册更新函数到 updaters 对象
  updaters.rangeUpdateVisual = updateVisual;

  // 事件处理函数
  const rangeMouseDown = (e) => {
    state.peakStepVal = state.stepCurrentVal;

    const rect = sliderContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const stepVal = getStepVal();

    const minThumbX = valueToThumbX(state.rangeMinVal, rect);
    const maxThumbX = valueToThumbX(state.rangeMaxVal, rect);

    const nearMin = Math.abs(mouseX - minThumbX) <= state.THUMB_R + 4;
    const nearMax = Math.abs(mouseX - maxThumbX) <= state.THUMB_R + 4;

    if (nearMin || nearMax) {
      if (nearMin && nearMax) {
        state.dragTarget = (mouseX - minThumbX < maxThumbX - mouseX) ? "min" : "max";
      } else {
        state.dragTarget = nearMin ? "min" : "max";
      }
    } else {
      const clickVal = pxToValue(mouseX, rect);
      const midPoint = (state.rangeMinVal + state.rangeMaxVal) / 2;

      if (clickVal < midPoint) {
        state.dragTarget = "min";
        const direction = clickVal < state.rangeMinVal ? -1 : 1;
        state.rangeMinVal = snapToStep(state.rangeMinVal + direction * stepVal, stepVal, false);
        if (state.rangeMinVal >= state.rangeMaxVal) {
          state.rangeMaxVal = state.rangeMinVal + stepVal;
          if (state.rangeMaxVal > state.MAX_RANGE) {
            state.rangeMaxVal = state.MAX_RANGE;
            state.rangeMinVal = state.rangeMaxVal - stepVal;
          }
        }
      } else {
        state.dragTarget = "max";
        const direction = clickVal < state.rangeMaxVal ? -1 : 1;
        state.rangeMaxVal = snapToStep(state.rangeMaxVal + direction * stepVal, stepVal, true);
        if (state.rangeMaxVal <= state.rangeMinVal) {
          state.rangeMinVal = state.rangeMaxVal - stepVal;
          if (state.rangeMinVal < stepVal) {
            state.rangeMinVal = stepVal;
            state.rangeMaxVal = state.rangeMinVal + stepVal;
          }
        }
      }
      updateVisual();
    }

    state.isDragging = true;
    state.dragStartMouseX = mouseX;
    state.dragStartMinVal = state.rangeMinVal;
    state.dragStartMaxVal = state.rangeMaxVal;

    const activeThumb = state.dragTarget === "min" ? minThumb : maxThumb;
    activeThumb.style.transform = "translate(-50%, -50%) scale(1.2)";
    activeThumb.style.outline = `2px solid ${theme.text}`;
    sliderContainer.style.cursor = "grabbing";

    e.preventDefault();
  };

  const rangeMouseMove = (e) => {
    if (!state.isDragging || !state.dragTarget) return;

    const rect = sliderContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const stepVal = getStepVal();
    const deltaX = mouseX - state.dragStartMouseX;
    const trackWidth = rect.width - state.THUMB_R * 2;
    const deltaValue = (deltaX / trackWidth) * (state.MAX_RANGE - state.MIN_RANGE);

    if (state.dragTarget === "min") {
      let newMin = snapToStep(state.dragStartMinVal + deltaValue, stepVal, false);
      newMin = Math.max(stepVal, newMin);

      if (newMin + stepVal > state.rangeMaxVal) {
        state.rangeMaxVal = newMin + stepVal;
        if (state.rangeMaxVal > state.MAX_RANGE) {
          state.rangeMaxVal = state.MAX_RANGE;
          newMin = state.rangeMaxVal - stepVal;
        }
      }
      state.rangeMinVal = newMin;
    } else {
      let newMax = snapToStep(state.dragStartMaxVal + deltaValue, stepVal, true);
      newMax = Math.min(state.MAX_RANGE, newMax);
      if (newMax < stepVal * 2) newMax = stepVal * 2;

      if (newMax - stepVal < state.rangeMinVal) {
        state.rangeMinVal = newMax - stepVal;
        if (state.rangeMinVal < stepVal) {
          state.rangeMinVal = stepVal;
          newMax = state.rangeMinVal + stepVal;
        }
      }
      state.rangeMaxVal = newMax;
    }

    updateVisual();
  };

  const rangeMouseUp = (e) => {
    if (!state.isDragging) return;
    state.isDragging = false;

    minThumb.style.transform = "translate(-50%, -50%) scale(1)";
    maxThumb.style.transform = "translate(-50%, -50%) scale(1)";
    sliderContainer.style.cursor = "pointer";

    updateRangeHover(e);
    state.dragTarget = null;
  };

  const updateRangeHover = (e) => {
    if (state.isDragging) return;

    const rect = sliderContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const minThumbX = valueToThumbX(state.rangeMinVal, rect);
    const maxThumbX = valueToThumbX(state.rangeMaxVal, rect);

    const nearMin = Math.abs(mouseX - minThumbX) <= 20;
    const nearMax = Math.abs(mouseX - maxThumbX) <= 20;

    if (nearMin || nearMax) {
      sliderContainer.style.cursor = "grab";
      if (nearMin) minThumb.style.outline = `2px solid ${theme.text}`;
      else minThumb.style.outline = "none";
      if (nearMax) maxThumb.style.outline = `2px solid ${theme.text}`;
      else maxThumb.style.outline = "none";
    } else {
      sliderContainer.style.cursor = "pointer";
      minThumb.style.outline = "none";
      maxThumb.style.outline = "none";
    }
  };

  // 绑定事件
  sliderContainer.addEventListener("mousedown", rangeMouseDown);
  document.addEventListener("mousemove", rangeMouseMove);
  document.addEventListener("mouseup", rangeMouseUp);
  sliderContainer.addEventListener("mousemove", updateRangeHover);
  sliderContainer.addEventListener("mouseenter", updateRangeHover);
  
  const mouseLeaveHandler = () => {
    if (!state.isDragging) {
      minThumb.style.outline = "none";
      maxThumb.style.outline = "none";
      sliderContainer.style.cursor = "pointer";
    }
  };
  sliderContainer.addEventListener("mouseleave", mouseLeaveHandler);

  // 注册清理函数
  cleanupFns.push(() => {
    sliderContainer.removeEventListener("mousedown", rangeMouseDown);
    document.removeEventListener("mousemove", rangeMouseMove);
    document.removeEventListener("mouseup", rangeMouseUp);
    sliderContainer.removeEventListener("mousemove", updateRangeHover);
    sliderContainer.removeEventListener("mouseenter", updateRangeHover);
    sliderContainer.removeEventListener("mouseleave", mouseLeaveHandler);
  });

  // 禁用原生 slider 交互
  minSlider.style.pointerEvents = "none";
  maxSlider.style.pointerEvents = "none";

  updateVisual();
  section.appendChild(row);
  return section;
}

// ========== Step Section ==========

function createStepSection(theme, state, adapter, cleanupFns, updaters) {
  const section = document.createElement("div");
  section.style.marginBottom = "8px";

  const row = custom.container(theme);
  const label = custom.sectionLabel("step", theme);
  row.appendChild(label);

  const controlWrapper = custom.controlWrapper(theme);
  row.appendChild(controlWrapper);

  const minDisplay = custom.valueDisplay("128", theme, "left");
  minDisplay.style.paddingLeft = "6px";
  controlWrapper.appendChild(minDisplay);

  const sliderContainer = custom.sliderContainer();
  controlWrapper.appendChild(sliderContainer);

  const track = custom.sliderTrack(theme);
  sliderContainer.appendChild(track);

  const activeTrack = custom.activeTrack(theme, { left: "0" });
  sliderContainer.appendChild(activeTrack);

  const stepSlider = custom.hiddenSlider({ 
    min: 128, 
    max: 1024, 
    step: 128, 
    value: state.stepCurrentVal 
  });
  
  const stepThumb = custom.sliderThumb(theme, { zIndex: "6" });

  sliderContainer.appendChild(stepThumb);
  sliderContainer.appendChild(stepSlider);

  const valueDisplay = custom.valueDisplay(state.stepCurrentVal, theme, "right");
  valueDisplay.style.paddingRight = "6px";
  controlWrapper.appendChild(valueDisplay);

  // 视觉更新函数 - 注册到 updaters
  const updateVisual = () => {
    stepSlider.value = state.stepCurrentVal;
    valueDisplay.textContent = state.stepCurrentVal;

    const stepPercent = ((state.stepCurrentVal - state.STEP_MIN) / (state.STEP_MAX - state.STEP_MIN)) * 100;
    activeTrack.style.right = `calc(${state.THUMB_R}px + (100% - ${state.THUMB_R * 2}px) * ${(100 - stepPercent) / 100})`;
    stepThumb.style.left = `calc(${state.THUMB_R}px + (100% - ${state.THUMB_R * 2}px) * ${stepPercent / 100})`;
  };

  updaters.stepUpdateVisual = updateVisual;

  // 同步 range 到 step - 关键修复：同步后调用 range 的更新函数
  const syncRangeToStep = () => {
    const stepVal = state.stepCurrentVal;

    if (stepVal <= state.peakStepVal) {
      return;
    }
    state.peakStepVal = stepVal;

    if (stepVal <= state.rangeMinVal) {
      return;
    }

    const snapToStep = (val, step, snapToMax) => {
      const snapped = Math.round(val / step) * step;
      if (snapToMax && snapped > state.MAX_RANGE - step) return state.MAX_RANGE;
      return Math.max(step, Math.min(state.MAX_RANGE, snapped));
    };

    if (stepVal > state.rangeMinVal) {
      state.rangeMinVal = snapToStep(state.rangeMinVal, stepVal, false);
    }
    
    if (stepVal > state.rangeMaxVal) {
      state.rangeMaxVal = snapToStep(state.rangeMaxVal, stepVal, true);
    }

    if (state.rangeMaxVal - state.rangeMinVal < stepVal) {
      state.rangeMaxVal = state.rangeMinVal + stepVal;
      if (state.rangeMaxVal > state.MAX_RANGE) {
        state.rangeMaxVal = state.MAX_RANGE;
        state.rangeMinVal = state.rangeMaxVal - stepVal;
      }
    }

    // 关键修复：触发 range section 的视觉更新
    if (updaters.rangeUpdateVisual) {
      updaters.rangeUpdateVisual();
    }
  };

  // 工具函数
  const stepPxToValue = (mouseX, rect) => {
    const trackWidth = rect.width - state.THUMB_R * 2;
    const x = mouseX - state.THUMB_R;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    const raw = state.STEP_MIN + ratio * (state.STEP_MAX - state.STEP_MIN);
    return Math.max(state.STEP_MIN, Math.min(state.STEP_MAX, Math.round(raw / state.STEP_MIN) * state.STEP_MIN));
  };

  const stepValueToThumbX = (val, rect) => {
    return state.THUMB_R + ((val - state.STEP_MIN) / (state.STEP_MAX - state.STEP_MIN)) * (rect.width - state.THUMB_R * 2);
  };

  // 事件处理函数
  const stepMouseDown = (e) => {
    const rect = sliderContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const thumbX = stepValueToThumbX(state.stepCurrentVal, rect);
    const nearThumb = Math.abs(mouseX - thumbX) <= state.THUMB_R + 4;

    if (!nearThumb) {
      const direction = mouseX > thumbX ? 1 : -1;
      state.stepCurrentVal = Math.max(state.STEP_MIN, Math.min(state.STEP_MAX, state.stepCurrentVal + direction * state.STEP_MIN));
      updateVisual();
      syncRangeToStep(); // 这会触发 range 更新
    }

    state.isStepDragging = true;
    state.stepDragStartMouseX = mouseX;
    state.stepDragStartVal = state.stepCurrentVal;

    stepThumb.style.transform = "translate(-50%, -50%) scale(1.2)";
    stepThumb.style.outline = `2px solid ${theme.text}`;
    sliderContainer.style.cursor = "grabbing";
    e.preventDefault();
  };

  const stepMouseMove = (e) => {
    if (!state.isStepDragging) return;

    const rect = sliderContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const deltaX = mouseX - state.stepDragStartMouseX;
    const trackWidth = rect.width - state.THUMB_R * 2;
    const deltaValue = (deltaX / trackWidth) * (state.STEP_MAX - state.STEP_MIN);

    const newVal = Math.max(state.STEP_MIN, Math.min(state.STEP_MAX, Math.round((state.stepDragStartVal + deltaValue) / state.STEP_MIN) * state.STEP_MIN));
    if (newVal !== state.stepCurrentVal) {
      state.stepCurrentVal = newVal;
      updateVisual();
      syncRangeToStep(); // 这会触发 range 更新
    }
  };

  const stepMouseUp = (e) => {
    if (!state.isStepDragging) return;
    state.isStepDragging = false;

    stepThumb.style.transform = "translate(-50%, -50%) scale(1)";
    sliderContainer.style.cursor = "pointer";
    updateStepHover(e);
  };

  const updateStepHover = (e) => {
    if (state.isStepDragging) return;

    const rect = sliderContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const thumbX = stepValueToThumbX(state.stepCurrentVal, rect);

    if (Math.abs(mouseX - thumbX) <= 20) {
      sliderContainer.style.cursor = "grab";
      stepThumb.style.outline = `2px solid ${theme.text}`;
    } else {
      sliderContainer.style.cursor = "pointer";
      stepThumb.style.outline = "none";
    }
  };

  // 绑定事件
  sliderContainer.addEventListener("mousedown", stepMouseDown);
  document.addEventListener("mousemove", stepMouseMove);
  document.addEventListener("mouseup", stepMouseUp);
  sliderContainer.addEventListener("mousemove", updateStepHover);
  sliderContainer.addEventListener("mouseenter", updateStepHover);
  
  const mouseLeaveHandler = () => {
    if (!state.isStepDragging) {
      stepThumb.style.outline = "none";
      sliderContainer.style.cursor = "pointer";
    }
  };
  sliderContainer.addEventListener("mouseleave", mouseLeaveHandler);

  // 注册清理函数
  cleanupFns.push(() => {
    sliderContainer.removeEventListener("mousedown", stepMouseDown);
    document.removeEventListener("mousemove", stepMouseMove);
    document.removeEventListener("mouseup", stepMouseUp);
    sliderContainer.removeEventListener("mousemove", updateStepHover);
    sliderContainer.removeEventListener("mouseenter", updateStepHover);
    sliderContainer.removeEventListener("mouseleave", mouseLeaveHandler);
  });

  updateVisual();
  section.appendChild(row);
  return section;
}

// ========== 辅助函数 ==========

function saveWidgetRange(node) {
  node.properties = node.properties || {};
  node.properties.widgetRange = {};

  ["width", "height"].forEach(name => {
    const w = node.widgets.find(widget => widget.name === name);
    if (w && w.options) {
      node.properties.widgetRange[name] = {
        min: w.options.min,
        max: w.options.max,
        step: w.options.step,
        step2: w.options.step2
      };
    }
  });
}

function restoreWidgetRange(node) {
  const range = node.properties?.widgetRange;
  if (!range) return;

  ["width", "height"].forEach(name => {
    const w = node.widgets.find(widget => widget.name === name);
    const r = range[name];
    if (w && r) {
      if (r.min !== undefined) w.options.min = r.min;
      if (r.max !== undefined) w.options.max = r.max;
      if (r.step !== undefined) w.options.step = r.step;
      if (r.step2 !== undefined) w.options.step2 = r.step2;
    }
  });
}

function forceRefresh(node) {
  node.setDirtyCanvas(true, true);
  if (app.graph) app.graph.setDirtyCanvas(true, true);
  if (app.canvas) app.canvas.draw(true, true);
  const origSize = node.size;
  node.setSize([origSize[0], origSize[1]]);
  node.graph?.change?.();
}

function forceUpdateWidgetValue(widget, newValue) {
  const currentValue = widget.value;
  if (newValue === currentValue) {
    widget.value = newValue + 1;
  }
  widget.value = newValue;
  if (widget.callback) {
    widget.callback(newValue);
  }
}

// ========== 画布 Widget ==========

function create2DSliderWidget(node, widgetPreset, widgetWidth, widgetHeight) {
  const adapter = new ComfyThemeAdapter();
  let theme = adapter.theme;

  const container = custom.canvas2dContainer();
  const sliderBox = custom.sliderBox(theme);
  container.appendChild(sliderBox);

  const grid = custom.canvasGrid(theme);
  sliderBox.appendChild(grid);

  const minZone = custom.canvasZone(theme, 0.6, "1");
  sliderBox.appendChild(minZone);

  const selectedArea = custom.canvasSelectedArea(theme);
  sliderBox.appendChild(selectedArea);

  const lineH = custom.guideLineH();
  const lineHVisual = custom.guideLineHVisual(theme);
  lineH.appendChild(lineHVisual);
  sliderBox.appendChild(lineH);

  const lineV = custom.guideLineV();
  const lineVVisual = custom.guideLineVVisual(theme);
  lineV.appendChild(lineVVisual);
  sliderBox.appendChild(lineV);

  const point = custom.guidePoint(theme);
  sliderBox.appendChild(point);
  
  const coordTooltip = custom.coordTooltip(theme);
  document.body.appendChild(coordTooltip);

  function updateDisplay() {
    const minW = widgetWidth.options?.min ?? 64;
    const maxW = widgetWidth.options?.max ?? 4096;
    const minH = widgetHeight.options?.min ?? 64;
    const maxH = widgetHeight.options?.max ?? 4096;
    
    let gridStepW = isPresetTemporaryStep ? userStepW : (widgetWidth.options?.step ?? 64);
    let gridStepH = isPresetTemporaryStep ? userStepH : (widgetHeight.options?.step ?? 64);

    if (!gridStepW || gridStepW <= 0) gridStepW = 64;
    if (!gridStepH || gridStepH <= 0) gridStepH = 64;

    const maxGridLines = 20;
    while (maxW / gridStepW > maxGridLines && gridStepW < maxW) { gridStepW *= 2 }
    while (maxH / gridStepH > maxGridLines && gridStepH < maxH) { gridStepH *= 2 }

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

    const gridColor = theme.secondary;

    grid.style.backgroundImage = `
      linear-gradient(to right, ${gridColor} 1px, transparent 1px),
      linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
    `;
    grid.style.backgroundSize = `${Math.max(gridSizeXPercent, 5)}% ${Math.max(gridSizeYPercent, 5)}%`;
    grid.style.backgroundPosition = '0% 100%';
  }

  function checkAndSetCustom(newW, newH) {
    const currentPreset = widgetPreset.value;
    if (currentPreset === "Custom") return;

    const targetSizes = SIZE_PRESETS[currentPreset];
    if (!targetSizes) return;

    if (newW !== targetSizes[0] || newH !== targetSizes[1]) {
      widgetPreset.value = "Custom";
    }
  }
  
  function updateCoordTooltip(e, mode = null) {
    const rect = sliderBox.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

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
    
    if (mode === 'lineV') {
      if (x <= minXPercent) w = minW;
      h = widgetHeight.value;
    } else if (mode === 'lineH') {
      if (y <= minYPercent) h = minH;
      w = widgetWidth.value;
    } else {
      if (x <= minXPercent && y <= minYPercent) {
        w = minW;
        h = minH;
      } else if (x <= minXPercent) {
        w = minW;
      } else if (y <= minYPercent) {
        h = minH;
      }
    }

    let wColor = theme.text;
    let hColor = theme.text;
    let commaColor = theme.text;
    let wFontSize = "12px";
    let hFontSize = "12px";
    
    if (mode === 'lineH') {
      wColor = theme.background;
      commaColor = theme.background;
      hFontSize = "13px";
    } else if (mode === 'lineV') {
      hColor = theme.background;
      commaColor = theme.background;
      wFontSize = "13px";
    } else if (mode === 'point') {
      wFontSize = "13px";
      hFontSize = "13px";
    }

    coordTooltip.innerHTML = `<span style="color: ${wColor}; font-size: ${wFontSize}">W:${w}</span><span style="color: ${commaColor}">, </span><span style="color: ${hColor}; font-size: ${hFontSize}">H:${h}</span>`;
    coordTooltip.style.display = "block";
    coordTooltip.style.left = `${e.clientX + 15}px`;
    coordTooltip.style.top = `${e.clientY + 15}px`;
  }

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

  function applyInteraction(e, mode = null) {
    const rect = sliderBox.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

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

    if (mode === 'lineV') {
      newW = x * maxW;
      newW = Math.round(newW / stepW) * stepW;
      newW = Math.max(minW, Math.min(maxW, newW));
    } else if (mode === 'lineH') {
      newH = y * maxH;
      newH = Math.round(newH / stepH) * stepH;
      newH = Math.max(minH, Math.min(maxH, newH));
    } else {
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
  
  adapter.bindElement(sliderBox, { background: "background" });
  adapter.bindElement(grid, {
    boxShadow: (t) => `inset 0 0 0 1px ${t.background}`
  });
  adapter.bindElement(lineHVisual, { background: "border" });
  adapter.bindElement(lineVVisual, { background: "border" });
  adapter.bindElement(point, { background: "border" });
  adapter.bindElement(coordTooltip, {
    background: "primary",
    color: "text",
    boxShadow: (t) => `0 2px 8px ${hexToRgba(t.shadow, 0.3)}`
  });
  adapter.bindElement(selectedArea, { background: ["border", 0.5] });
  adapter.bindElement(minZone, { background: ["primary", 0.6] });
  
  adapter.onThemeChange((newTheme) => {
    theme = newTheme;
    updateDisplay();
    if (point.style.outlineWidth && point.style.outlineWidth !== "0px") {
      point.style.outlineColor = theme.text;
    }
    if (lineHVisual.style.outlineWidth && lineHVisual.style.outlineWidth !== "0px") {
      lineHVisual.style.outlineColor = theme.text;
    }
    if (lineVVisual.style.outlineWidth && lineVVisual.style.outlineWidth !== "0px") {
      lineVVisual.style.outlineColor = theme.text;
    }
  });

  point.addEventListener("mouseenter", () => {
    if (!isDragging) point.style.outline = `2px solid ${theme.text}`;
  });
  
  point.addEventListener("mouseleave", () => {
    if (!isDragging) point.style.outline = "none";
  });
  
  lineH.addEventListener("mouseenter", () => {
    if (!isDragging || dragMode !== 'lineH') lineHVisual.style.outline = `1px solid ${theme.text}`;
  });
  
  lineH.addEventListener("mouseleave", () => {
    if (!isDragging || dragMode !== 'lineH') lineHVisual.style.outline = "none";
  });
  
  lineV.addEventListener("mouseenter", () => {
    if (!isDragging || dragMode !== 'lineV') lineVVisual.style.outline = `1px solid ${theme.text}`;
  });
  
  lineV.addEventListener("mouseleave", () => {
    if (!isDragging || dragMode !== 'lineV') lineVVisual.style.outline = "none";
  });
  
  point.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    restoreOriginalStep();
    isDragging = true;
    dragMode = 'point';
    currentSliderBox = sliderBox;
    point.style.cursor = "grabbing";
    point.style.outline = `2px solid ${theme.text}`;
    updateCoordTooltip(e, dragMode);
    applyInteraction(e, dragMode);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  });
  
  lineH.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    restoreOriginalStep();
    isDragging = true;
    dragMode = 'lineH';
    currentSliderBox = sliderBox;
    lineHVisual.style.outline = `1px solid ${theme.text}`;
    document.body.style.cursor = "ns-resize";
    updateCoordTooltip(e, dragMode);
    applyInteraction(e, dragMode);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  });
  
  lineV.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    restoreOriginalStep();
    isDragging = true;
    dragMode = 'lineV';
    currentSliderBox = sliderBox;
    lineVVisual.style.outline = `1px solid ${theme.text}`;
    document.body.style.cursor = "ew-resize";
    updateCoordTooltip(e, dragMode);
    applyInteraction(e, dragMode);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  });
  
  sliderBox.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (e.target === lineH || e.target === lineV || e.target === point) return;
    restoreOriginalStep();
    isDragging = true;
    dragMode = 'point';
    currentSliderBox = sliderBox;
    sliderBox.classList.add("dragging");
    updateCoordTooltip(e, dragMode);
    applyInteraction(e, dragMode);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  });

  sliderBox.addEventListener("mousemove", (e) => {
    if (isDragging) return;
    updateCoordTooltip(e, null);
  });
  
  sliderBox.addEventListener("mouseleave", () => {
    if (isDragging) return;
    coordTooltip.style.display = "none";
  });
  
  const handleMouseMove = (e) => {
    if (!isDragging || currentSliderBox !== sliderBox) return;
    updateCoordTooltip(e, dragMode);
    applyInteraction(e, dragMode);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  const handleMouseUp = (e) => {
    if (!isDragging || currentSliderBox !== sliderBox) return;
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

  const widget = node.addDOMWidget("canvas_2d_slider", "CANVAS_2D_SLIDER", container, {
    serialize: false,
    hideOnZoom: false
  });

  widget.computeSize = function(width) {
    const nodeWidth = node.size?.[0] ?? 300;
    const nodeHeight = node.size?.[1] ?? 400;
    const headerHeight = LiteGraph.NODE_TITLE_HEIGHT ?? 30;
    let otherWidgetsHeight = headerHeight + 15;

    for (const w of node.widgets || []) {
      if (w === widget) continue;
      if (w.computeSize) {
        otherWidgetsHeight += w.computeSize(nodeWidth)[1] + 4;
      } else {
        otherWidgetsHeight += (LiteGraph.NODE_WIDGET_HEIGHT ?? 20) + 4;
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
  widget.draw = function(ctx, node, width, y, height) {
    updateDisplay();
    if (originalDraw) return originalDraw.apply(this, arguments);
  };

  widget.updateDisplay = updateDisplay;
  widget.isProgrammaticUpdate = () => isProgrammaticUpdate;
  
  widget.setPresetTemporaryStep = function() {
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
  
  widget.updateUserStep = function(stepW, stepH) {
    userStepW = stepW;
    userStepH = stepH;
  };

  widget.onRemove = function() {
    if (isDragging && currentSliderBox === sliderBox) {
      isDragging = false;
      currentSliderBox = null;
      sliderBox.classList.remove("dragging");
    }
    adapter.destroy();
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

// ========== 主扩展 ==========

app.registerExtension({
  name: "a1rworkshop.sizecanvas",

  async nodeCreated(node, app) {
    if (node.comfyClass !== "SizeCanvas") return;

    const widgetPreset = node.widgets.find(w => w.name === "preset");
    const widgetWidth = node.widgets.find(w => w.name === "width");
    const widgetHeight = node.widgets.find(w => w.name === "height");
    if (!widgetPreset || !widgetWidth || !widgetHeight) return;

    node.properties = node.properties || {};
    restoreWidgetRange(node);

    const slider2D = create2DSliderWidget(node, widgetPreset, widgetWidth, widgetHeight);

    const minNodeWidth = 250;
    const minNodeHeight = 380;
    if (node.size[0] < minNodeWidth) node.size[0] = minNodeWidth;
    if (node.size[1] < minNodeHeight) node.size[1] = minNodeHeight;

    const originalOnRemoved = node.onRemoved;
    node.onRemoved = function() {
      if (slider2D.onRemove) slider2D.onRemove();
      if (originalOnRemoved) originalOnRemoved.apply(this, arguments);
    };

    const originalOnConfigure = node.onConfigure;
    node.onConfigure = function(info) {
      if (originalOnConfigure) originalOnConfigure.apply(this, arguments);
      restoreWidgetRange(this);
      if (slider2D && typeof slider2D.updateDisplay === 'function') {
        try { slider2D.updateDisplay(); } 
        catch (err) { console.warn("Failed to update display in onConfigure:", err); }
      }
      forceRefresh(this);
    };

    const originalOnSerialize = node.onSerialize;
    node.onSerialize = function(info) {
      if (originalOnSerialize) originalOnSerialize.apply(this, arguments);
      saveWidgetRange(this);
      if (info.properties) info.properties.widgetRange = this.properties?.widgetRange;
    };

    setTimeout(() => {
      restoreWidgetRange(node);
      if (slider2D && typeof slider2D.updateDisplay === 'function') {
        try { slider2D.updateDisplay(); } 
        catch (err) { console.warn("Failed to update display in setTimeout:", err); }
      }
    }, 500);

    let isProgrammaticChange = false;
    let isPresetChanging = false;

    const onPresetChange = (value) => {
      if (value === "Custom") return;
      const size = SIZE_PRESETS[value];
      if (size) {
        isPresetChanging = true;
        try {
          if (slider2D && typeof slider2D.setPresetTemporaryStep === 'function') {
            slider2D.setPresetTemporaryStep();
          }
        } catch (err) { console.warn("Failed to set preset temporary step:", err); }
        
        isProgrammaticChange = true;
        forceUpdateWidgetValue(widgetWidth, size[0]);
        forceUpdateWidgetValue(widgetHeight, size[1]);
        isProgrammaticChange = false;
        isPresetChanging = false;
        
        try {
          if (slider2D && typeof slider2D.updateDisplay === 'function') slider2D.updateDisplay();
        } catch (err) { console.warn("Failed to update display:", err); }
      }
    };

    const checkCustomState = () => {
      if (isProgrammaticChange) return;
      if (slider2D && slider2D.isProgrammaticUpdate && slider2D.isProgrammaticUpdate()) return;
      const currentPreset = widgetPreset.value;
      if (currentPreset === "Custom") return;
      const targetSizes = SIZE_PRESETS[currentPreset];
      if (!targetSizes) return;
      if (widgetWidth.value !== targetSizes[0] || widgetHeight.value !== targetSizes[1]) {
        widgetPreset.value = "Custom";
        if (slider2D && typeof slider2D.updateDisplay === 'function') {
          try { slider2D.updateDisplay(); } 
          catch (err) { console.warn("Failed to update display in checkCustomState:", err); }
        }
        forceRefresh(node);
      }
    };

    const originalPresetCallback = widgetPreset.callback;
    widgetPreset.callback = function (value) {
      onPresetChange(value);
      return originalPresetCallback ? originalPresetCallback.apply(this, arguments) : undefined;
    };

    const originalWidthCallback = widgetWidth.callback;
    widgetWidth.callback = function (value) {
      const r = originalWidthCallback ? originalWidthCallback.apply(this, arguments) : undefined;
      checkCustomState();
      if (!isPresetChanging && slider2D && typeof slider2D.updateDisplay === 'function') {
        try { slider2D.updateDisplay(); } 
        catch (err) { console.warn("Failed to update display in width callback:", err); }
      }
      return r;
    };

    const originalHeightCallback = widgetHeight.callback;
    widgetHeight.callback = function (value) {
      const r = originalHeightCallback ? originalHeightCallback.apply(this, arguments) : undefined;
      checkCustomState();
      if (!isPresetChanging && slider2D && typeof slider2D.updateDisplay === 'function') {
        try { slider2D.updateDisplay(); } 
        catch (err) { console.warn("Failed to update display in height callback:", err); }
      }
      return r;
    };
  },

  getNodeMenuItems(node) {
    if (node.comfyClass !== "SizeCanvas") return [];

    const openCanvasSetting = async () => {
      const widgetWidth = node.widgets.find(w => w.name === "width");
      const widgetHeight = node.widgets.find(w => w.name === "height");
      const targetWidgets = [widgetWidth, widgetHeight].filter(w => w);
      if (!widgetWidth) return;

      const currentMin = widgetWidth.options.min ?? 128;
      const currentMax = widgetWidth.options.max ?? 4096;
      const currentStep = widgetWidth.options.step2 ?? widgetWidth.options.step ?? 128;

      const result = await showCanvasSettingDialog({ currentMin, currentMax, currentStep });
      if (result === null) return;

      const { min, max, step } = result;

      targetWidgets.forEach(w => {
        w.options.min = min;
        w.options.max = max;
        w.options.step = step;
        w.options.step2 = step;

        let newValue = w.value;
        if (newValue < min) newValue = min;
        if (newValue > max) newValue = max;
        newValue = Math.round(newValue / step) * step;
        if (newValue < min) newValue = min;
        if (newValue > max) newValue = max;

        forceUpdateWidgetValue(w, newValue);
      });
      
      const slider2D = node.widgets.find(w => w.name === "canvas_2d_slider");
      if (slider2D && typeof slider2D.updateUserStep === 'function') {
        slider2D.updateUserStep(step, step);
      }

      saveWidgetRange(node);
      forceRefresh(node);
      if (slider2D?.updateDisplay) slider2D.updateDisplay();
      setTimeout(() => forceRefresh(node), 50);
    };

    return [null, { content: "Canvas Setting", callback: openCanvasSetting }];
  }
});