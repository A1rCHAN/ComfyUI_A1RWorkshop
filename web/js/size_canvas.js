import { app } from "/scripts/app.js";
import { hexToRgba } from "../theme.js";
import { ComfyThemeAdapter } from "../adapter.js";
import { custom } from "../style.js";

// ========== 抑制 PrimeVue Select 已知 bug ==========
// PrimeVue Select 组件在 onOverlayLeave 中通过 $nextTick 试图 focus 已被卸载的 filterInput.$el，
// 导致 "Cannot read properties of null (reading '$el')" 错误。
// ComfyUI 的 SelectPlus 覆盖了此方法，但在 desktop app 编译版中未生效。
// 此处捕获并抑制该特定的 unhandled promise rejection。
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
    
    /**
     * 创建遮罩层
     */
    const overlay = custom.overlay(theme);

    /**
     * 创建对话框
     */
    const dialog = custom.dialog(theme);

    /**
     * 标题
     */
    const titleEl = custom.dialogTitle("Canvas Setting", theme);
    dialog.appendChild(titleEl);
    
    // 主题适配：绑定需要跟随主题变化的元素
    adapter.bindElement(dialog, {
      background: "primary",
      color: "text",
      boxShadow: (t) => `0 4px 16px ${hexToRgba(t.shadow, 0.5)}`
    });
    adapter.bindElement(titleEl, { color: "text", background: "title" });
    adapter.onThemeChange((newTheme) => { theme = newTheme; });

    // ========== Size Range ==========
    const rangeSection = document.createElement("div");
    rangeSection.style.marginBottom = "24px";

    /**
     * Range水平容器
     */
    const rangeRow = custom.container();

    /**
     * Range标题
     */
    const rangeLabel = custom.sectionLabel("range", theme);
    rangeRow.appendChild(rangeLabel);

    /**
     * Range控件容器 (滑轨+数值的背景容器)
     */
    const rangeControlWrapper = custom.controlWrapper(theme);
    rangeRow.appendChild(rangeControlWrapper);

    /**
     * Range Min值显示
     */
    const rangeMinDisplay = custom.valueDisplay(currentMin, theme, "left");
    rangeControlWrapper.appendChild(rangeMinDisplay);

    /**
     * Range slider容器
     */
    const rangeSliderContainer = custom.sliderContainer();
    rangeControlWrapper.appendChild(rangeSliderContainer);

    /**
     * Range slider轨道
     */
    const THUMB_R = 8; // 滑块半径，用于inset计算
    const rangeTrack = custom.sliderTrack(theme);
    rangeSliderContainer.appendChild(rangeTrack);

    // Range slider活动区域
    const rangeActiveTrack = custom.activeTrack(theme);
    rangeSliderContainer.appendChild(rangeActiveTrack);

    // Min slider
    const minSlider = custom.hiddenSlider(
      { min: currentStep, max: 4096, step: currentStep, value: currentMin },
      { zIndex: "4" }
    );

    // Max slider
    const maxSlider = custom.hiddenSlider(
      { min: currentStep, max: 4096, step: currentStep, value: currentMax },
      { zIndex: "5" }
    );

    // Min 滑块
    const minThumb = custom.sliderThumb(theme);
    
    // Max 滑块
    const maxThumb = custom.sliderThumb(theme);
    
    rangeSliderContainer.appendChild(minThumb);
    rangeSliderContainer.appendChild(maxThumb);

    /**
     * 更新Range视觉显示
    */
    const MAX_RANGE = 4096;
    const MIN_RANGE = 128;

    // 当前值（脱离原生slider，自主管理）
    let rangeMinVal = currentMin;
    let rangeMaxVal = currentMax;

    const updateRangeVisual = () => {
      // 同步到隐藏 slider（供 confirm 读取）
      minSlider.value = rangeMinVal;
      maxSlider.value = rangeMaxVal;

      rangeMinDisplay.textContent = rangeMinVal;
      rangeMaxDisplay.textContent = rangeMaxVal;

      // 更新活动轨道和滑块位置
      const minPercent = ((rangeMinVal - MIN_RANGE) / (MAX_RANGE - MIN_RANGE)) * 100;
      const maxPercent = ((rangeMaxVal - MIN_RANGE) / (MAX_RANGE - MIN_RANGE)) * 100;

      rangeActiveTrack.style.left = `calc(${THUMB_R}px + (100% - ${THUMB_R * 2}px) * ${minPercent / 100})`;
      rangeActiveTrack.style.right = `calc(${THUMB_R}px + (100% - ${THUMB_R * 2}px) * ${(100 - maxPercent) / 100})`;

      minThumb.style.left = `calc(${THUMB_R}px + (100% - ${THUMB_R * 2}px) * ${minPercent / 100})`;
      maxThumb.style.left = `calc(${THUMB_R}px + (100% - ${THUMB_R * 2}px) * ${maxPercent / 100})`;
    };

    /**
     * Snap值到step的倍数，并处理最大值snap
     */
    const snapToStep = (val, stepVal, snapToMax) => {
      const snapped = Math.round(val / stepVal) * stepVal;
      if (snapToMax && snapped > MAX_RANGE - stepVal) return MAX_RANGE;
      return Math.max(stepVal, Math.min(MAX_RANGE, snapped));
    };

    /**
     * 像素位置转换为值
     */
    const pxToValue = (mouseX, rect) => {
      const trackWidth = rect.width - THUMB_R * 2;
      const x = mouseX - THUMB_R;
      const ratio = Math.max(0, Math.min(1, x / trackWidth));
      return MIN_RANGE + ratio * (MAX_RANGE - MIN_RANGE);
    };

    /**
     * 值转换为像素位置
     */
    const valueToThumbX = (val, rect) => {
      return THUMB_R + ((val - MIN_RANGE) / (MAX_RANGE - MIN_RANGE)) * (rect.width - THUMB_R * 2);
    };

    // 禁用原生 slider 交互（仅作为数据容器）
    minSlider.style.pointerEvents = "none";
    maxSlider.style.pointerEvents = "none";

    /**
     * 自定义拖拽系统
     */
    let isDragging = false;
    let dragTarget = null; // "min" | "max" | null
    let dragStartMouseX = 0;
    let dragStartMinVal = 0;
    let dragStartMaxVal = 0;

    const getStepVal = () => parseInt(stepSlider.value);

    const rangeMouseDown = (e) => {
      // 用户手动操作range，重置step水位线，允许后续step增大时正常sync
      peakStepVal = stepCurrentVal;

      const rect = rangeSliderContainer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const stepVal = getStepVal();

      const minThumbX = valueToThumbX(rangeMinVal, rect);
      const maxThumbX = valueToThumbX(rangeMaxVal, rect);

      const nearMin = Math.abs(mouseX - minThumbX) <= THUMB_R + 4;
      const nearMax = Math.abs(mouseX - maxThumbX) <= THUMB_R + 4;

      if (nearMin || nearMax) {
        // 点击在滑块上：记录偏移量，拖拽时保持相对位置
        if (nearMin && nearMax) {
          // 重叠时选距离点击更近的，相等选max
          dragTarget = (mouseX - minThumbX < maxThumbX - mouseX) ? "min" : "max";
        } else {
          dragTarget = nearMin ? "min" : "max";
        }
      } else {
        // 点击在轨道空白处：不吸附到鼠标，而是向点击方向移动一步
        const clickVal = pxToValue(mouseX, rect);
        const midPoint = (rangeMinVal + rangeMaxVal) / 2;

        if (clickVal < midPoint) {
          // 点击在min侧：min向点击方向移动一步
          dragTarget = "min";
          const direction = clickVal < rangeMinVal ? -1 : 1;
          rangeMinVal = snapToStep(rangeMinVal + direction * stepVal, stepVal, false);
          if (rangeMinVal >= rangeMaxVal) {
            rangeMaxVal = rangeMinVal + stepVal;
            if (rangeMaxVal > MAX_RANGE) {
              rangeMaxVal = MAX_RANGE;
              rangeMinVal = rangeMaxVal - stepVal;
            }
          }
        } else {
          // 点击在max侧：max向点击方向移动一步
          dragTarget = "max";
          const direction = clickVal < rangeMaxVal ? -1 : 1;
          rangeMaxVal = snapToStep(rangeMaxVal + direction * stepVal, stepVal, true);
          if (rangeMaxVal <= rangeMinVal) {
            rangeMinVal = rangeMaxVal - stepVal;
            if (rangeMinVal < stepVal) {
              rangeMinVal = stepVal;
              rangeMaxVal = rangeMinVal + stepVal;
            }
          }
        }
        updateRangeVisual();
      }

      isDragging = true;
      dragStartMouseX = mouseX;
      dragStartMinVal = rangeMinVal;
      dragStartMaxVal = rangeMaxVal;

      // 视觉反馈
      const activeThumb = dragTarget === "min" ? minThumb : maxThumb;
      activeThumb.style.transform = "translate(-50%, -50%) scale(1.2)";
      activeThumb.style.outline = `2px solid ${theme.text}`;
      rangeSliderContainer.style.cursor = "grabbing";

      e.preventDefault();
    };

    const rangeMouseMove = (e) => {
      if (!isDragging || !dragTarget) return;

      const rect = rangeSliderContainer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const stepVal = getStepVal();
      const deltaX = mouseX - dragStartMouseX;
      const trackWidth = rect.width - THUMB_R * 2;
      const deltaValue = (deltaX / trackWidth) * (MAX_RANGE - MIN_RANGE);

      if (dragTarget === "min") {
        let newMin = snapToStep(dragStartMinVal + deltaValue, stepVal, false);
        newMin = Math.max(stepVal, newMin);

        // 推动max
        if (newMin + stepVal > rangeMaxVal) {
          rangeMaxVal = newMin + stepVal;
          if (rangeMaxVal > MAX_RANGE) {
            rangeMaxVal = MAX_RANGE;
            newMin = rangeMaxVal - stepVal;
          }
        }
        rangeMinVal = newMin;
      } else {
        let newMax = snapToStep(dragStartMaxVal + deltaValue, stepVal, true);
        newMax = Math.min(MAX_RANGE, newMax);
        if (newMax < stepVal * 2) newMax = stepVal * 2;

        // 推动min
        if (newMax - stepVal < rangeMinVal) {
          rangeMinVal = newMax - stepVal;
          if (rangeMinVal < stepVal) {
            rangeMinVal = stepVal;
            newMax = rangeMinVal + stepVal;
          }
        }
        rangeMaxVal = newMax;
      }

      updateRangeVisual();
    };

    const rangeMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;

      // 重置视觉
      minThumb.style.transform = "translate(-50%, -50%) scale(1)";
      maxThumb.style.transform = "translate(-50%, -50%) scale(1)";
      rangeSliderContainer.style.cursor = "pointer";

      // 触发 hover 检测
      updateRangeHover(e);
      dragTarget = null;
    };

    /**
     * Hover光标管理
     */
    const updateRangeHover = (e) => {
      if (isDragging) return;

      const rect = rangeSliderContainer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const minThumbX = valueToThumbX(rangeMinVal, rect);
      const maxThumbX = valueToThumbX(rangeMaxVal, rect);

      const nearMin = Math.abs(mouseX - minThumbX) <= 20;
      const nearMax = Math.abs(mouseX - maxThumbX) <= 20;

      if (nearMin || nearMax) {
        rangeSliderContainer.style.cursor = "grab";
        if (nearMin) minThumb.style.outline = `2px solid ${theme.text}`;
        else minThumb.style.outline = "none";
        if (nearMax) maxThumb.style.outline = `2px solid ${theme.text}`;
        else maxThumb.style.outline = "none";
      } else {
        rangeSliderContainer.style.cursor = "pointer";
        minThumb.style.outline = "none";
        maxThumb.style.outline = "none";
      }
    };

    rangeSliderContainer.addEventListener("mousedown", rangeMouseDown);
    document.addEventListener("mousemove", rangeMouseMove);
    const handleSliderMouseUp = rangeMouseUp;
    document.addEventListener("mouseup", handleSliderMouseUp);
    rangeSliderContainer.addEventListener("mousemove", updateRangeHover);
    rangeSliderContainer.addEventListener("mouseenter", updateRangeHover);
    rangeSliderContainer.addEventListener("mouseleave", () => {
      if (!isDragging) {
        minThumb.style.outline = "none";
        maxThumb.style.outline = "none";
        rangeSliderContainer.style.cursor = "pointer";
      }
    });

    rangeSliderContainer.appendChild(minSlider);
    rangeSliderContainer.appendChild(maxSlider);

    /**
     * Range Max值显示
     */
    const rangeMaxDisplay = custom.valueDisplay(currentMax, theme, "right");
    rangeControlWrapper.appendChild(rangeMaxDisplay);

    rangeSection.appendChild(rangeRow);
    dialog.appendChild(rangeSection);

    // ========== Step Section ==========
    const stepSection = document.createElement("div");
    stepSection.style.marginBottom = "24px";

    /**
     * Step水平容器
     */
    const stepRow = custom.container();

    /**
     * Step标题
     */
    const stepLabel = custom.sectionLabel("step", theme);
    stepRow.appendChild(stepLabel);

    /**
     * Step控件容器 (滑轨+数值的背景容器)
     */
    const stepControlWrapper = custom.controlWrapper(theme);
    stepRow.appendChild(stepControlWrapper);

    /**
    * Step Min 值显示 (固定128)
     */
    const stepMinDisplay = custom.valueDisplay("128", theme, "left");
    stepControlWrapper.appendChild(stepMinDisplay);

    /**
     * Step slider容器
     */
    const stepSliderContainer = custom.sliderContainer();
    stepControlWrapper.appendChild(stepSliderContainer);

    /**
     * Step slider轨道
     */
    const stepTrack = custom.sliderTrack(theme);
    stepSliderContainer.appendChild(stepTrack);

    /**
     * Step slider活动区域
     */
    const stepActiveTrack = custom.activeTrack(theme, { left: "0" });
    stepSliderContainer.appendChild(stepActiveTrack);

    /**
    * Step slider (隐藏，仅作数据容器)
     */
    const stepSlider = custom.hiddenSlider(
      { min: 128, max: 1024, step: 128, value: currentStep }
    );

    /**
     * Step 滑块
     */
    const stepThumb = custom.sliderThumb(theme, { zIndex: "6" });
    stepSliderContainer.appendChild(stepThumb);

    stepSliderContainer.appendChild(stepSlider);

    /**
    * Step 值显示
     */
    const stepValueDisplay = custom.valueDisplay(currentStep, theme, "right");
    stepControlWrapper.appendChild(stepValueDisplay);

    /**
     * 更新Step显示
     */
    const STEP_MIN = 128;
    const STEP_MAX = 1024;
    let stepCurrentVal = currentStep;

    const updateStepVisual = () => {
      stepSlider.value = stepCurrentVal;
      stepValueDisplay.textContent = stepCurrentVal;

      // 更新活动轨道和滑块位置
      const stepPercent = ((stepCurrentVal - STEP_MIN) / (STEP_MAX - STEP_MIN)) * 100;
      stepActiveTrack.style.right = `calc(${THUMB_R}px + (100% - ${THUMB_R * 2}px) * ${(100 - stepPercent) / 100})`;
      stepThumb.style.left = `calc(${THUMB_R}px + (100% - ${THUMB_R * 2}px) * ${stepPercent / 100})`;
    };

    let peakStepVal = currentStep; // 记录step达到的历史最大值（水位线）

    const syncRangeToStep = () => {
      const stepVal = stepCurrentVal;

      // step未超过历史最大值时不改变range，避免回调后再增大时累积偏移
      if (stepVal <= peakStepVal) {
        return;
      }
      peakStepVal = stepVal;

      // step 尚未超过当前 min 时，不移动 range（step 推动 min，min 推动 max）
      if (stepVal <= rangeMinVal) {
        return;
      }

      // 重新snap当前值到新的step网格
      // min：step超过min时才推动
      if (stepVal > rangeMinVal) {
        rangeMinVal = snapToStep(rangeMinVal, stepVal, false);
      }
      // max：step 超过 max 时才推动，否则保持原位
      if (stepVal > rangeMaxVal) {
        rangeMaxVal = snapToStep(rangeMaxVal, stepVal, true);
      }

      // 确保间距（min 被推动后可能逼近 max）
      if (rangeMaxVal - rangeMinVal < stepVal) {
        rangeMaxVal = rangeMinVal + stepVal;
        if (rangeMaxVal > MAX_RANGE) {
          rangeMaxVal = MAX_RANGE;
          rangeMinVal = rangeMaxVal - stepVal;
        }
      }
      updateRangeVisual();
    };

    /**
    * Step 自定义拖拽
     */
    let isStepDragging = false;
    let stepDragStartMouseX = 0;
    let stepDragStartVal = 0;

    const stepPxToValue = (mouseX, rect) => {
      const trackWidth = rect.width - THUMB_R * 2;
      const x = mouseX - THUMB_R;
      const ratio = Math.max(0, Math.min(1, x / trackWidth));
      const raw = STEP_MIN + ratio * (STEP_MAX - STEP_MIN);
      return Math.max(STEP_MIN, Math.min(STEP_MAX, Math.round(raw / STEP_MIN) * STEP_MIN));
    };

    const stepValueToThumbX = (val, rect) => {
      return THUMB_R + ((val - STEP_MIN) / (STEP_MAX - STEP_MIN)) * (rect.width - THUMB_R * 2);
    };

    const stepMouseDown = (e) => {
      const rect = stepSliderContainer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const thumbX = stepValueToThumbX(stepCurrentVal, rect);
      const nearThumb = Math.abs(mouseX - thumbX) <= THUMB_R + 4;

      if (!nearThumb) {
        // 点击轨道空白处：向点击方向移动一步
        const direction = mouseX > thumbX ? 1 : -1;
        stepCurrentVal = Math.max(STEP_MIN, Math.min(STEP_MAX, stepCurrentVal + direction * STEP_MIN));
        updateStepVisual();
        syncRangeToStep();
      }

      isStepDragging = true;
      stepDragStartMouseX = mouseX;
      stepDragStartVal = stepCurrentVal;

      stepThumb.style.transform = "translate(-50%, -50%) scale(1.2)";
      stepThumb.style.outline = `2px solid ${theme.text}`;
      stepSliderContainer.style.cursor = "grabbing";
      e.preventDefault();
    };

    const stepMouseMove = (e) => {
      if (!isStepDragging) return;

      const rect = stepSliderContainer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const deltaX = mouseX - stepDragStartMouseX;
      const trackWidth = rect.width - THUMB_R * 2;
      const deltaValue = (deltaX / trackWidth) * (STEP_MAX - STEP_MIN);

      const newVal = Math.max(STEP_MIN, Math.min(STEP_MAX, Math.round((stepDragStartVal + deltaValue) / STEP_MIN) * STEP_MIN));
      if (newVal !== stepCurrentVal) {
        stepCurrentVal = newVal;
        updateStepVisual();
        syncRangeToStep();
      }
    };

    const handleStepMouseUp = (e) => {
      if (!isStepDragging) return;
      isStepDragging = false;

      stepThumb.style.transform = "translate(-50%, -50%) scale(1)";
      stepSliderContainer.style.cursor = "pointer";
      updateStepHover(e);
    };

    const updateStepHover = (e) => {
      if (isStepDragging) return;

      const rect = stepSliderContainer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const thumbX = stepValueToThumbX(stepCurrentVal, rect);

      if (Math.abs(mouseX - thumbX) <= 20) {
        stepSliderContainer.style.cursor = "grab";
        stepThumb.style.outline = `2px solid ${theme.text}`;
      } else {
        stepSliderContainer.style.cursor = "pointer";
        stepThumb.style.outline = "none";
      }
    };

    stepSliderContainer.addEventListener("mousedown", stepMouseDown);
    document.addEventListener("mousemove", stepMouseMove);
    document.addEventListener("mouseup", handleStepMouseUp);
    stepSliderContainer.addEventListener("mousemove", updateStepHover);
    stepSliderContainer.addEventListener("mouseenter", updateStepHover);
    stepSliderContainer.addEventListener("mouseleave", () => {
      if (!isStepDragging) {
        stepThumb.style.outline = "none";
        stepSliderContainer.style.cursor = "pointer";
      }
    });

    stepSection.appendChild(stepRow);

    // 初始化显示
    updateStepVisual();

    dialog.appendChild(stepSection);

    // ========== 按钮容器 ==========
    const buttonContainer = custom.dialogButtonBar();

    // 取消按钮
    const cancelBtn = custom.dialogButton("Cancel", theme);
    custom.buttonHover(cancelBtn, theme, 0.3);
    cancelBtn.addEventListener("click", () => {
      document.removeEventListener("mouseup", handleSliderMouseUp);
      document.removeEventListener("mousemove", rangeMouseMove);
      document.removeEventListener("mouseup", handleStepMouseUp);
      document.removeEventListener("mousemove", stepMouseMove);
      document.body.removeChild(overlay);
      adapter.destroy();
      resolve(null)
    });

    // 确认按钮
    const confirmBtn = custom.dialogButton("Apply", theme);
    custom.buttonHover(confirmBtn, theme, 0.3);
    confirmBtn.addEventListener("click", () => {
      const minVal = rangeMinVal;
      const maxVal = rangeMaxVal;
      const stepVal = stepCurrentVal;
      
      document.removeEventListener("mouseup", handleSliderMouseUp);
      document.removeEventListener("mousemove", rangeMouseMove);
      document.removeEventListener("mouseup", handleStepMouseUp);
      document.removeEventListener("mousemove", stepMouseMove);
      document.body.removeChild(overlay);
      adapter.destroy();
      resolve({ min: minVal, max: maxVal, step: stepVal });
    });

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(confirmBtn);
    dialog.appendChild(buttonContainer);

    // 绑定剩余的主题响应元素
    adapter.bindElement(rangeLabel, { color: "text" });
    adapter.bindElement(stepLabel, { color: "text" });
    adapter.bindElement(rangeControlWrapper, { background: "background" });
    adapter.bindElement(stepControlWrapper, { background: "background" });
    adapter.bindElement(cancelBtn, { background: "background", color: "text" });
    adapter.bindElement(confirmBtn, { background: "background", color: "text" });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 初始化显示
    updateRangeVisual();

    // 点击遮罩层关闭
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        document.removeEventListener("mouseup", handleSliderMouseUp);
        document.removeEventListener("mousemove", rangeMouseMove);
        document.removeEventListener("mouseup", handleStepMouseUp);
        document.removeEventListener("mousemove", stepMouseMove);
        document.body.removeChild(overlay);
        adapter.destroy();
        resolve(null);
      }
    });

    // ESC键关闭
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("mouseup", handleSliderMouseUp);
        document.removeEventListener("mousemove", rangeMouseMove);
        document.removeEventListener("mouseup", handleStepMouseUp);
        document.removeEventListener("mousemove", stepMouseMove);
        document.body.removeChild(overlay);
        adapter.destroy();
        resolve(null);
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);

    // 聚焦确认按钮
    setTimeout(() => confirmBtn.focus(), 100);
  });
};

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
};

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
};

function forceRefresh(node) {
  node.setDirtyCanvas(true, true);
  if (app.graph) app.graph.setDirtyCanvas(true, true);
  if (app.canvas) app.canvas.draw(true, true);
  const origSize = node.size;
  node.setSize([origSize[0], origSize[1]]);
  node.graph?.change?.();
};

function forceUpdateWidgetValue(widget, newValue) {
  const currentValue = widget.value;
  if (newValue === currentValue) {
    widget.value = newValue + 1;
  }
  widget.value = newValue;
  if (widget.callback) {
    widget.callback(newValue);
  }
};

// ========== 画布 Widget ==========

function create2DSliderWidget(node, widgetPreset, widgetWidth, widgetHeight) {
  const adapter = new ComfyThemeAdapter();
  let theme = adapter.theme;

  /**
   * 容器 
   */
  const container = custom.canvas2dContainer();

  /** 
  * 部件主体
  */
  const sliderBox = custom.sliderBox(theme);
  container.appendChild(sliderBox);

  /** 
   * 网格背景（按step动态生成）
  */
  const grid = custom.canvasGrid(theme);
  sliderBox.appendChild(grid);

  /** 
  * 最小值区域
  */
  const minZone = custom.canvasZone(theme, 0.6, "1");
  sliderBox.appendChild(minZone);

  /**
   * 选中区域
  */
  const selectedArea = custom.canvasSelectedArea(theme);
  sliderBox.appendChild(selectedArea);

  /** 
  * 水平辅助线
   */
  const lineH = custom.guideLineH();
  
  // 水平线的可视部分
  const lineHVisual = custom.guideLineHVisual(theme);
  lineH.appendChild(lineHVisual);
  sliderBox.appendChild(lineH);

  /** 
  * 垂直辅助线
   */
  const lineV = custom.guideLineV();
  
  // 垂直线的可视部分
  const lineVVisual = custom.guideLineVVisual(theme);
  lineV.appendChild(lineVVisual);
  sliderBox.appendChild(lineV);

  /** 
  * 点位指示器
   */
  const point = custom.guidePoint(theme);
  sliderBox.appendChild(point);
  
  /** 
  * 坐标提示
   */
  const coordTooltip = custom.coordTooltip(theme);
  document.body.appendChild(coordTooltip);

  // 更新显示函数
  function updateDisplay() {
    const minW = widgetWidth.options?.min ?? 64;
    const maxW = widgetWidth.options?.max ?? 4096;
    const minH = widgetHeight.options?.min ?? 64;
    const maxH = widgetHeight.options?.max ?? 4096;
    // 网格绘制始终使用用户步长，不使用临时步长
    const gridStepW = isPresetTemporaryStep ? userStepW : (widgetWidth.options?.step ?? 64);
    const gridStepH = isPresetTemporaryStep ? userStepH : (widgetHeight.options?.step ?? 64);
    
    // 调试：检查网格步长
    // console.log('Grid step:', gridStepW, gridStepH, 'isPreset:', isPresetTemporaryStep, 'userStep:', userStepW, userStepH);

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

    // 动态生成基于原始step的网格，确保网格始终可见
    // 网格应该覆盖整个范围，每个格子对应一个步长
    const gridCountX = Math.floor(maxW / gridStepW);
    const gridCountY = Math.floor(maxH / gridStepH);
    // 每个网格的大小（百分比）
    const gridSizeXPercent = (gridStepW / maxW) * 100;
    const gridSizeYPercent = (gridStepH / maxH) * 100;

    grid.style.backgroundImage = `
      linear-gradient(${theme.secondary} 1px, transparent 1px),
      linear-gradient(90deg, ${theme.secondary} 1px, transparent 1px)
    `;
    grid.style.backgroundSize = `${gridSizeXPercent}% ${gridSizeYPercent}%`;
    // 确保网格从左下角开始对齐
    grid.style.backgroundPosition = '0% 100%';
  }

  // 检查是否需要切换到Custom
  function checkAndSetCustom(newW, newH) {
    const currentPreset = widgetPreset.value;
    if (currentPreset === "Custom") return;

    const targetSizes = SIZE_PRESETS[currentPreset];
    if (!targetSizes) return;

    if (newW !== targetSizes[0] || newH !== targetSizes[1]) {
      widgetPreset.value = "Custom";
    }
  }
  
  // 更新坐标提示
  function updateCoordTooltip(e, mode = null) {
    const rect = sliderBox.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));

    const minW = widgetWidth.options?.min ?? 64;
    const maxW = widgetWidth.options?.max ?? 4096;
    const minH = widgetHeight.options?.min ?? 64;
    const maxH = widgetHeight.options?.max ?? 4096;
    // 坐标提示始终使用用户设置的步长，不受预设临时步长影响
    const stepW = userStepW ?? widgetWidth.options?.step2 ?? widgetWidth.options?.step ?? 64;
    const stepH = userStepH ?? widgetHeight.options?.step2 ?? widgetHeight.options?.step ?? 64;

    let w = x * maxW;
    let h = y * maxH;
    w = Math.round(w / stepW) * stepW;
    h = Math.round(h / stepH) * stepH;
    
    // 计算最小限制区域的边界
    const minXPercent = minW / maxW;
    const minYPercent = minH / maxH;
    
    // 根据拖拽模式调整显示逻辑
    if (mode === 'lineV') {
      // 垂直辅助线，只更新宽度
      if (x <= minXPercent) {
        w = minW;
      }
      // 高度显示当前值
      h = widgetHeight.value;
    } else if (mode === 'lineH') {
      // 水平辅助线，只更新高度
      if (y <= minYPercent) {
        h = minH;
      }
      // 宽度显示当前值
      w = widgetWidth.value;
    } else {
      // 点位指示器或普通移动，同时更新两个维度
      if (x <= minXPercent && y <= minYPercent) {
        w = minW;
        h = minH;
      } else if (x <= minXPercent) {
        w = minW;
      } else if (y <= minYPercent) {
        h = minH;
      }
    }

    // 根据拖拽模式设置文本颜色
    let wColor = theme.text;
    let hColor = theme.text;
    let commaColor = theme.text;
    let wFontSize = "12px";
    let hFontSize = "12px";
    
    if (mode === 'lineH') {
      // 拖拽水平辅助线时，W 不变，颜色变化
      wColor = theme.background;
      commaColor = theme.background;
      // H在变化，字号增加
      hFontSize = "13px";
    } else if (mode === 'lineV') {
      // 拖拽垂直辅助线时，H 不变，颜色变化
      hColor = theme.background;
      commaColor = theme.background;
      // W在变化，字号增加
      wFontSize = "13px";
    } else if (mode === 'point') {
      // 拖拽点位指示器时，W和H都在变化，字号都增加
      wFontSize = "13px";
      hFontSize = "13px";
    }

    coordTooltip.innerHTML = `<span style="color: ${wColor}; font-size: ${wFontSize}">W:${w}</span><span style="color: ${commaColor}">, </span><span style="color: ${hColor}; font-size: ${hFontSize}">H:${h}</span>`;
    coordTooltip.style.display = "block";
    coordTooltip.style.left = `${e.clientX + 15}px`;
    coordTooltip.style.top = `${e.clientY + 15}px`;
  }

  // ========== 交互状态 ==========
  let isDragging = false;
  let isProgrammaticUpdate = false;
  let dragMode = null; // null, 'point', 'lineH', 'lineV'
  
  // 用于标识当前拖拽的滑块实体
  let currentSliderBox = null;
  
  // 保存真正的用户步长（不是临时步长）
  let userStepW = widgetWidth.options?.step2 ?? widgetWidth.options?.step ?? 64;
  let userStepH = widgetHeight.options?.step2 ?? widgetHeight.options?.step ?? 64;
  let isPresetTemporaryStep = false; // 标记是否使用临时步长（预设选择时）

  // 恢复原始步长（从预设临时步长恢复）
  function restoreOriginalStep() {
    if (isPresetTemporaryStep) {
      widgetWidth.options.step = userStepW;
      widgetWidth.options.step2 = userStepW;
      widgetHeight.options.step = userStepH;
      widgetHeight.options.step2 = userStepH;
      isPresetTemporaryStep = false;
    }
  }

  // 计算并应用新的尺寸
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

    // 根据拖拽模式决定更新哪个维度
    if (mode === 'lineV') {
      // 只更新宽度
      newW = x * maxW;
      newW = Math.round(newW / stepW) * stepW;
      newW = Math.max(minW, Math.min(maxW, newW));
    } else if (mode === 'lineH') {
      // 只更新高度
      newH = y * maxH;
      newH = Math.round(newH / stepH) * stepH;
      newH = Math.max(minH, Math.min(maxH, newH));
    } else {
      // 同时更新宽度和高度（点位指示器或普通点击）
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
  
  // 主题适配：绑定需要跟随主题变化的元素
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
    // 条件更新：仅在已显示 outline 时同步颜色
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

  // ========== 鼠标事件 ==========
  
  // hover 效果 - 点位指示器
  point.addEventListener("mouseenter", () => {
    if (!isDragging) {
      point.style.outline = `2px solid ${theme.text}`;
    }
  });
  
  point.addEventListener("mouseleave", () => {
    if (!isDragging) {
      point.style.outline = "none";
    }
  });
  
  // hover 效果 - 水平辅助线
  lineH.addEventListener("mouseenter", () => {
    if (!isDragging || dragMode !== 'lineH') {
      lineHVisual.style.outline = `1px solid ${theme.text}`;
    }
  });
  
  lineH.addEventListener("mouseleave", () => {
    if (!isDragging || dragMode !== 'lineH') {
      lineHVisual.style.outline = "none";
    }
  });
  
  // hover 效果 - 垂直辅助线
  lineV.addEventListener("mouseenter", () => {
    if (!isDragging || dragMode !== 'lineV') {
      lineVVisual.style.outline = `1px solid ${theme.text}`;
    }
  });
  
  lineV.addEventListener("mouseleave", () => {
    if (!isDragging || dragMode !== 'lineV') {
      lineVVisual.style.outline = "none";
    }
  });
  
  // 点位指示器拖拽
  point.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    
    // 恢复原始步长（如果是从预设临时步长状态）
    restoreOriginalStep();
    
    isDragging = true;
    dragMode = 'point';
    currentSliderBox = sliderBox;
    point.style.cursor = "grabbing";
    point.style.outline = `2px solid ${theme.text}`;
    
    // 显示坐标提示
    updateCoordTooltip(e, dragMode);
    
    applyInteraction(e, dragMode);
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  });
  
  // 水平辅助线拖拽
  lineH.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    
    // 恢复原始步长（如果是从预设临时步长状态）
    restoreOriginalStep();
    
    isDragging = true;
    dragMode = 'lineH';
    currentSliderBox = sliderBox;
    lineHVisual.style.outline = `1px solid ${theme.text}`;
    // 锁定光标样式，防止闪烁
    document.body.style.cursor = "ns-resize";
    
    // 显示坐标提示
    updateCoordTooltip(e, dragMode);
    
    applyInteraction(e, dragMode);
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  });
  
  // 垂直辅助线拖拽
  lineV.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    
    // 恢复原始步长（如果是从预设临时步长状态）
    restoreOriginalStep();
    
    isDragging = true;
    dragMode = 'lineV';
    currentSliderBox = sliderBox;
    lineVVisual.style.outline = `1px solid ${theme.text}`;
    // 锁定光标样式，防止闪烁
    document.body.style.cursor = "ew-resize";
    
    // 显示坐标提示
    updateCoordTooltip(e, dragMode);
    
    applyInteraction(e, dragMode);
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  });
  
  // mousedown: 开始拖拽（在空白区域点击）
  sliderBox.addEventListener("mousedown", (e) => {
    // 只处理左键点击
    if (e.button !== 0) return;
    
    // 如果点击的是辅助线或点位指示器，不处理
    if (e.target === lineH || e.target === lineV || e.target === point) return;
    
    // 恢复原始步长（如果是从预设临时步长状态）
    restoreOriginalStep();
    
    isDragging = true;
    dragMode = 'point';
    currentSliderBox = sliderBox;
    sliderBox.classList.add("dragging");
    
    // 显示坐标提示
    updateCoordTooltip(e, dragMode);
    
    // 立即设置点位
    applyInteraction(e, dragMode);

    // 阻止事件传播到canvas
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  });

  // sliderBox鼠标移动 - 显示坐标提示
  sliderBox.addEventListener("mousemove", (e) => {
    // 如果正在拖拽，不处理（由 handleMouseMove 处理）
    if (isDragging) return;
    updateCoordTooltip(e, null);
  });
  
  // sliderBox鼠标离开 - 隐藏坐标提示
  sliderBox.addEventListener("mouseleave", () => {
    // 如果正在拖拽，不隐藏
    if (isDragging) return;
    coordTooltip.style.display = "none";
  });
  
  // mousemove: 只在当前 sliderBox 拖拽时更新
  const handleMouseMove = (e) => {
    // 关键：只有当isDragging为true且是当前sliderBox时才更新
    if (!isDragging || currentSliderBox !== sliderBox) return;
    
    // 更新坐标提示
    updateCoordTooltip(e, dragMode);
    
    applyInteraction(e, dragMode);
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  // mouseup: 结束拖拽
  const handleMouseUp = (e) => {
    if (!isDragging || currentSliderBox !== sliderBox) return;
    
    const lastDragMode = dragMode;
    
    isDragging = false;
    currentSliderBox = null;
    dragMode = null;
    sliderBox.classList.remove("dragging");
    
    // 恢复光标和边框
    point.style.cursor = "grab";
    point.style.outline = "none";
    lineHVisual.style.outline = "none";
    lineVVisual.style.outline = "none";
    document.body.style.cursor = "";
    
    // 隐藏坐标提示
    coordTooltip.style.display = "none";
    
    forceRefresh(node);
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  // 使用捕获阶段来确保能够拦截所有相关事件
  document.addEventListener("mousemove", handleMouseMove, true);
  document.addEventListener("mouseup", handleMouseUp, true);

  // 创建 DOM Widget
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
    if (originalDraw) {
      return originalDraw.apply(this, arguments);
    }
  };

  widget.updateDisplay = updateDisplay;
  widget.isProgrammaticUpdate = () => isProgrammaticUpdate;
  
  // 设置预设临时步长（供 preset callback 调用）
  widget.setPresetTemporaryStep = function() {
    // 保存当前的用户步长（如果不是临时步长状态）
    if (!isPresetTemporaryStep) {
      userStepW = widgetWidth.options?.step2 ?? widgetWidth.options?.step ?? 64;
      userStepH = widgetHeight.options?.step2 ?? widgetHeight.options?.step ?? 64;
    }
    
    // 设置临时步长
    widgetWidth.options.step = 1;
    widgetWidth.options.step2 = 1;
    widgetHeight.options.step = 1;
    widgetHeight.options.step2 = 1;
    isPresetTemporaryStep = true;
  };
  
  // 更新用户步长（供 Canvas Setting 调用）
  widget.updateUserStep = function(stepW, stepH) {
    userStepW = stepW;
    userStepH = stepH;
  };

  widget.onRemove = function() {
    // 清理拖拽状态
    if (isDragging && currentSliderBox === sliderBox) {
      isDragging = false;
      currentSliderBox = null;
      sliderBox.classList.remove("dragging");
    }
    
    // 从适配器中移除
    adapter.destroy();
    
    // 移除坐标提示
    if (coordTooltip && document.body.contains(coordTooltip)) {
      document.body.removeChild(coordTooltip);
    }
    
    // 移除事件监听
    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("mouseup", handleMouseUp, true);
  };

  // 立即执行一次显示更新，确保初次渲染正确
  updateDisplay();
  // 延迟再执行一次，确保DOM完全就绪
  setTimeout(updateDisplay, 100);

  return widget;
};

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
      if (originalOnConfigure) {
        originalOnConfigure.apply(this, arguments);
      };
      restoreWidgetRange(this);
      
      if (slider2D && typeof slider2D.updateDisplay === 'function') {
        try {
          slider2D.updateDisplay();
        } catch (err) {
          console.warn("Failed to update display in onConfigure:", err);
        }
      }
      
      forceRefresh(this);
    };

    const originalOnSerialize = node.onSerialize;
    node.onSerialize = function(info) {
      if (originalOnSerialize) {
        originalOnSerialize.apply(this, arguments);
      };
      
      saveWidgetRange(this);

      if (info.properties) {
        info.properties.widgetRange = this.properties?.widgetRange;
      }
    };

    setTimeout(() => {
      restoreWidgetRange(node);
      if (slider2D && typeof slider2D.updateDisplay === 'function') {
        try {
          slider2D.updateDisplay();
        } catch (err) {
          console.warn("Failed to update display in setTimeout:", err);
        };
      }
    }, 500);

    let isProgrammaticChange = false;
    let isPresetChanging = false; // 标记正在改变preset，用于避免nodes2.0的Vue更新冲突

    const onPresetChange = (value) => {
      if (value === "Custom") return;

      const size = SIZE_PRESETS[value];
      if (size) {
        isPresetChanging = true;
        
        // 设置临时步长，允许预设值不严格对齐网格
        try {
          if (slider2D && typeof slider2D.setPresetTemporaryStep === 'function') {
            slider2D.setPresetTemporaryStep();
          }
        } catch (err) {
          console.warn("Failed to set preset temporary step:", err);
        }
        
        isProgrammaticChange = true;
        forceUpdateWidgetValue(widgetWidth, size[0]);
        forceUpdateWidgetValue(widgetHeight, size[1]);
        isProgrammaticChange = false;
        isPresetChanging = false;
        
        try {
          if (slider2D && typeof slider2D.updateDisplay === 'function') {
            slider2D.updateDisplay();
          }
        } catch (err) {
          console.warn("Failed to update display:", err);
        }
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
          try {
            slider2D.updateDisplay();
          } catch (err) {
            console.warn("Failed to update display in checkCustomState:", err);
          }
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
      // 在preset改变期间跳过updateDisplay，避免nodes2.0的Vue冲突
      if (!isPresetChanging && slider2D && typeof slider2D.updateDisplay === 'function') {
        try {
          slider2D.updateDisplay();
        } catch (err) {
          console.warn("Failed to update display in width callback:", err);
        }
      }
      return r;
    };

    const originalHeightCallback = widgetHeight.callback;
    widgetHeight.callback = function (value) {
      const r = originalHeightCallback ? originalHeightCallback.apply(this, arguments) : undefined;
      checkCustomState();
      // 在preset改变期间跳过updateDisplay，避免nodes2.0的Vue冲突
      if (!isPresetChanging && slider2D && typeof slider2D.updateDisplay === 'function') {
        try {
          slider2D.updateDisplay();
        } catch (err) {
          console.warn("Failed to update display in height callback:", err);
        }
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

      const result = await showCanvasSettingDialog({
        currentMin,
        currentMax,
        currentStep
      });

      if (result === null) return;

      const { min, max, step } = result;

      targetWidgets.forEach(w => {
        w.options.min = min;
        w.options.max = max;
        w.options.step = step;
        w.options.step2 = step;

        // 调整当前值以符合新的范围
        let newValue = w.value;
        if (newValue < min) newValue = min;
        if (newValue > max) newValue = max;
        
        // 对齐到step
        newValue = Math.round(newValue / step) * step;
        if (newValue < min) newValue = min;
        if (newValue > max) newValue = max;

        forceUpdateWidgetValue(w, newValue);
      });
      
      // 更新 slider2D 的用户步长
      const slider2D = node.widgets.find(w => w.name === "canvas_2d_slider");
      if (slider2D && typeof slider2D.updateUserStep === 'function') {
        slider2D.updateUserStep(step, step);
      }

      saveWidgetRange(node);
      forceRefresh(node);
      
      if (slider2D?.updateDisplay) slider2D.updateDisplay();
      
      setTimeout(() => forceRefresh(node), 50);
    };

    const showCurrentConfig = async () => {
      const w = node.widgets.find(w => w.name === "width");
      if (!w || !w.options) {
        if (app.extensionManager?.dialog) {
          await app.extensionManager.dialog.prompt({
            title: "Configuration",
            message: "No configuration found.",
            defaultValue: ""
          });
        } else {
          alert("No configuration found.");
        }
        return;
      }
      const opts = w.options;
      const configMessage = 
        `Min: ${opts.min}\n` +
        `Max: ${opts.max}\n` +
        `Step: ${opts.step}\n` +
        `Step2: ${opts.step2}\n` +
        `Current Value: ${w.value}`;
      
      if (app.extensionManager?.dialog) {
        await app.extensionManager.dialog.prompt({
          title: "Current Configuration",
          message: configMessage,
          defaultValue: ""
        });
      } else {
        alert(`Current Config:\n\n${configMessage}`);
      }
    };

    const resetToDefault = async () => {
      let confirmed = false;
      
      if (app.extensionManager?.dialog) {
        confirmed = await app.extensionManager.dialog.confirm({
          title: "Reset to Default",
          message: "Are you sure you want to reset all range settings to default values?\n\nMin: 128, Max: 4096, Step: 128",
          type: "default"
        });
      } else {
        confirmed = confirm("Are you sure you want to reset all range settings to default values?\n\nMin: 128, Max: 4096, Step: 128");
      }
      
      if (!confirmed) return;
      
      const widgetWidth = node.widgets.find(w => w.name === "width");
      const widgetHeight = node.widgets.find(w => w.name === "height");
      
      [widgetWidth, widgetHeight].forEach(w => {
        if (w) {
          w.options.min = 128;
          w.options.max = 4096;
          w.options.step = 128;
          w.options.step2 = 128;
          forceUpdateWidgetValue(w, Math.max(128, Math.min(4096, w.value)));
        }
      });
      
      saveWidgetRange(node);
      forceRefresh(node);
      
      const slider2D = node.widgets.find(w => w.name === "canvas_2d_slider");
      if (slider2D?.updateDisplay) slider2D.updateDisplay();
    };

    return [
      null,
      {
        content: "Canvas Range",
        has_submenu: true,
        submenu: {
          options: [
            { content: "Canvas Setting", callback: openCanvasSetting },
            { content: "Show Current", callback: showCurrentConfig },
            { content: "Reset", callback: resetToDefault }
          ]
        }
      }
    ];
  }
});