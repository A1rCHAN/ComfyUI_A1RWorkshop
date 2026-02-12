// ========== Embedding Tags Editor - ComfyUI Nodes 2.0 兼容版本 ==========

import { app } from "/scripts/app.js";
import { ComfyThemeAdapter } from "../adapter.js";
import { custom } from "../style.js";
import { hexToRgba } from "../theme.js";

// ========== 配置 ==========

const MODEL_LOADER_CLASSES = [
  "CheckpointLoaderSimple",
  "CheckpointLoader",
  "UNETLoader",
  "CLIPLoader",
  "VAELoader",
  "LoraLoader",
  "LoraLoaderModelOnly",
  "ControlNetLoader",
  "DiffControlNetLoader",
  "StyleModelLoader",
  "CLIPVisionLoader",
  "IPAdapterModelLoader",
  "UpscaleModelLoader",
  "UNETLoaderGGUF",
  "DualCLIPLoader",
  "TripleCLIPLoader",
  "UNETLoaderINPAINT",
  "VideoLinearCFGGuidance",
  "ImageOnlyCheckpointLoader",
  "SVD_img2vid_Conditioning",
  "InpaintModelConditioning",
  "LoadDiffusionModel",
  "LoadCLIP",
  "LoadVAE",
  "LoadLoRA",
  "LoadCheckpoint",
];

// 硬编码配置文件路径（ComfyUI V3 标准路径）
const CONFIG_PATH = "custom_nodes/ComfyUI_A1RWorkshop/config.json";
const CONFIG_FILENAME = "config.json";

// 全局 tags 数据库
// 新结构: { "checkpoints": { "1": { "Model": "...", "Tags": "..." } }, "loras": { ... } }
let globalTagsDatabase = {};
let nextIds = {}; // 每个类别的下一个ID

// ========== 工具函数 ==========

function getBaseModelName(fullName) {
  if (!fullName) return "";
  const parts = fullName.split(/[\/\\]/);
  return parts[parts.length - 1];
}

function getModelCategory(modelPath) {
  if (!modelPath) return "others";
  
  // 提取第一级目录名（ComfyUI 模型分类标准）
  const parts = modelPath.split(/[\/\\]/);
  const firstDir = parts[0]?.toLowerCase() || "";
  
  // 根据第一级目录名判断类别
  if (firstDir.includes("lora") || firstDir.includes("lycoris")) return "loras";
  if (firstDir.includes("checkpoint")) return "checkpoints";
  if (firstDir.includes("unet")) return "unets";
  if (firstDir.includes("vae")) return "vaes";
  if (firstDir.includes("clip")) return "clips";
  if (firstDir.includes("controlnet")) return "controlnets";
  if (firstDir.includes("ipadapter")) return "ipadapters";
  if (firstDir.includes("upscale")) return "upscalers";

  const lower = modelPath.toLowerCase();
  if (lower.includes("lora") || lower.includes("lycoris")) return "loras";
  if (lower.includes("checkpoint") || lower.includes("checkpoints")) return "checkpoints";
  if (lower.includes("unet")) return "unets";
  if (lower.includes("vae")) return "vaes";
  if (lower.includes("clip")) return "clips";
  if (lower.includes("controlnet")) return "controlnets";
  if (lower.includes("ipadapter")) return "ipadapters";
  if (lower.includes("upscale")) return "upscalers";
  return "others";
}

function getCurrentModelFromNode(node) {
  const modelWidget = node.widgets?.find(w => 
    w.type === "combo" && 
    (w.name === "ckpt_name" || 
      w.name === "model_name" || 
      w.name === "lora_name" ||
      w.name === "unet_name" ||
      w.name === "clip_name" ||
      w.name === "vae_name" ||
      w.name.includes("model") ||
      w.name.includes("checkpoint"))
  );
  
  return modelWidget?.value || "";
}

function getModelListFromNode(node) {
  const modelWidget = node.widgets?.find(w => 
    w.type === "combo" && 
    (w.name === "ckpt_name" || 
      w.name === "model_name" || 
      w.name === "lora_name" ||
      w.name === "unet_name" ||
      w.name === "clip_name" ||
      w.name === "vae_name" ||
      w.name.includes("model") ||
      w.name.includes("checkpoint"))
  );
  
  if (modelWidget?.options?.values) {
    const values = Array.isArray(modelWidget.options.values) 
      ? modelWidget.options.values 
      : modelWidget.options.values();
    return values;
  }
  
  return [];
}

function isModelLoaderNode(node) {
  if (!node) return false;
  
  if (MODEL_LOADER_CLASSES.includes(node.comfyClass)) return true;
  if (MODEL_LOADER_CLASSES.includes(node.type)) return true;
  
  const hasModelOutput = node.outputs?.some(output => 
    ["MODEL", "CLIP", "VAE", "CHECKPOINT", "UNET", "LORA"].includes(output.type)
  );
  
  const hasModelInput = node.inputs?.some(input => 
    ["MODEL", "CLIP", "VAE", "CHECKPOINT", "UNET"].includes(input.type)
  );
  
  return hasModelOutput || hasModelInput;
}

// ========== 数据管理 ==========

/**
 * 加载配置文件
 */
async function loadConfig() {
  try {
    const response = await fetch(`/api/a1rworkshop/config`);
    
    if (response.ok) {
      const data = await response.json();
      globalTagsDatabase = data.EmbeddingTags || {};
      
      // 初始化每个类别的 nextId
      Object.keys(globalTagsDatabase).forEach(category => {
        const ids = Object.keys(globalTagsDatabase[category] || {}).map(Number).filter(n => !isNaN(n));
        nextIds[category] = ids.length > 0 ? Math.max(...ids) + 1 : 1;
      });
      
      console.log(`[Embedding Tags] Loaded config with ${Object.keys(globalTagsDatabase).length} categories`);
      return true;
    }
  } catch (e) {
    console.warn("[Embedding Tags] No existing config found, starting fresh");
  }
  
  globalTagsDatabase = {};
  nextIds = {};
  return false;
}

/**
 * 保存配置文件 - 静默保存到硬编码路径
 */
async function saveConfig() {
  try {
    const config = {
      EmbeddingTags: globalTagsDatabase
    };
    
    // 使用 ComfyUI V3 API 保存到指定路径
    const response = await fetch(`/api/a1rworkshop/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config)
    });
    
    if (response.ok) {
      return true;
    } else {
      throw new Error(`Save failed: ${response.status}`);
    }
  } catch (e) {
    // 静默失败，只显示提示
    console.error("[Embedding Tags] Save failed:", e);
    showToast("Save failed - check console", "error");
    return false;
  }
}

/**
 * 添加新的 tag 条目
 */
function addTagEntry(category, modelName, tagsText) {
  if (!category) category = getModelCategory(modelName);
  if (!globalTagsDatabase[category]) {
    globalTagsDatabase[category] = {};
    nextIds[category] = 1;
  }
  
  const baseName = getBaseModelName(modelName);
  if (!baseName) return null;
  
  const id = String(nextIds[category]++);
  globalTagsDatabase[category][id] = {
    Model: modelName,
    Tags: tagsText.trim()
  };
  
  return { id, category, entry: globalTagsDatabase[category][id] };
}

/**
 * 更新 tag 条目
 */
function updateTagEntry(category, id, modelName, tagsText) {
  if (!globalTagsDatabase[category]?.[id]) return false;
  
  globalTagsDatabase[category][id] = {
    Model: modelName,
    Tags: tagsText.trim()
  };
  
  return true;
}

/**
 * 查找已存在的模型条目
 */
function findTagEntryByModel(modelName) {
  const baseName = getBaseModelName(modelName);
  const category = getModelCategory(modelName);
  
  // 优先在预测的类别中查找
  if (globalTagsDatabase[category]) {
    for (const [id, entry] of Object.entries(globalTagsDatabase[category])) {
      if (getBaseModelName(entry.Model) === baseName) {
        return { id, category, entry };
      }
    }
  }
  
  // 全局搜索
  for (const [cat, entries] of Object.entries(globalTagsDatabase)) {
    for (const [id, entry] of Object.entries(entries)) {
      if (getBaseModelName(entry.Model) === baseName) {
        return { id, category: cat, entry };
      }
    }
  }
  
  return null;
}

/**
 * 删除 tag 条目
 */
function deleteTagEntry(category, id) {
  if (globalTagsDatabase[category]) {
    delete globalTagsDatabase[category][id];
  }
}

/**
 * 获取或创建 tag 条目
 */
function getOrCreateTagEntry(modelName) {
  const existing = findTagEntryByModel(modelName);
  if (existing) {
    return existing;
  }
  
  const category = getModelCategory(modelName);
  const result = addTagEntry(category, modelName, "");
  return result;
}

// ========== UI 辅助函数 ==========

function showToast(message, type = "success") {
  const adapter = new ComfyThemeAdapter();
  const theme = adapter.theme;
  
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    border-radius: 6px;
    background: ${type === "error" ? "#ef4444" : type === "info" ? "#3b82f6" : "#22c55e"};
    color: white;
    font-size: 13px;
    font-weight: 500;
    z-index: 10000;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
    box-shadow: 0 4px 12px ${hexToRgba(theme.shadow, 0.15)};
  `;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = "1");
  
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
  
  // 清理适配器
  setTimeout(() => adapter.destroy(), 3000);
}

// ========== 对话框实现 ==========

class EmbeddingTagsDialog {
  constructor(node) {
    this.node = node;
    this.currentModel = getCurrentModelFromNode(node);
    this.modelList = getModelListFromNode(node) || [];
    this.currentCategory = getModelCategory(this.currentModel);
    
    // 获取当前数据
    const tagData = getOrCreateTagEntry(this.currentModel);
    this.currentEntry = tagData;
    
    this.adapter = new ComfyThemeAdapter();
    this.theme = this.adapter.theme;
  }

  show() {
    let theme = this.adapter.theme;
    
    // 创建遮罩层
    const overlay = custom.overlay(theme);
    
    // 创建对话框
    const dialog = custom.dialog(theme);
    dialog.style.width = "520px";
    dialog.style.maxWidth = "90vw";
    
    // 绑定主题
    this.adapter.bindElement(dialog, {
      background: "primary",
      color: "text",
      boxShadow: (t) => `0 4px 16px ${hexToRgba(t.shadow, 0.5)}`
    });
    
    // 主题变化监听
    this.adapter.onThemeChange((newTheme) => {
      theme = newTheme;
      this.theme = newTheme;
    });

    // 标题栏
    const titleEl = custom.dialogTitle("Embedding Tags Editor", theme);
    this.adapter.bindElement(titleEl, { color: "text", background: "title" });
    titleEl.style.position = "relative";
    titleEl.style.overflow = "visible";
    titleEl.style.paddingRight = "140px";

    // 标题栏右侧按钮容器
    const titleControls = document.createElement("div");
    titleControls.style.cssText = 'position:absolute;right:12px;top:0;bottom:0;display:flex;align-items:center;gap:8px;z-index:10;pointer-events:auto;';

    // Open Editor 按钮
    const openEditorBtn = custom.dialogButton("Open Editor", this.theme);
    openEditorBtn.style.flex = "0 0 auto";
    openEditorBtn.style.padding = "6px 12px";
    openEditorBtn.style.fontSize = "11px";
    this.adapter.bindElement(openEditorBtn, { background: "background", color: "text" });
    custom.buttonHover(openEditorBtn, this.theme, 0.2);
    openEditorBtn.addEventListener("click", () => {
      new TagsEditorWindow().show();
    });

    titleControls.appendChild(openEditorBtn);
    titleEl.appendChild(titleControls);
    dialog.appendChild(titleEl);

    // Model Selection
    const modelSection = this.createModelSection();
    dialog.appendChild(modelSection);

    // Tags Section
    const tagsSection = this.createTagsSection();
    dialog.appendChild(tagsSection);

    // 按钮栏
    const bottomBar = this.createButtonBar(overlay);
    dialog.appendChild(bottomBar);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 点击遮罩关闭
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.close(overlay);
      }
    });

    // ESC键关闭
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        this.close(overlay);
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);

    // 聚焦文本框
    setTimeout(() => {
      this.tagsTextarea.focus();
      this.tagsTextarea.setSelectionRange(this.tagsTextarea.value.length, this.tagsTextarea.value.length);
    }, 100);
  }

  createInfoSection() {
    const infoSection = document.createElement("div");
    infoSection.style.cssText = `
      margin-bottom: 20px;
      padding: 12px 16px;
      border-radius: 10px;
      background: ${hexToRgba(this.theme.prompt, 0.1)};
      border-left: 3px solid ${this.theme.prompt};
    `;

    const infoTitle = document.createElement("div");
    infoTitle.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: ${this.theme.prompt};
      margin-bottom: 8px;
    `;
    infoTitle.textContent = "How it works:";

    const infoList = document.createElement("div");
    infoList.style.cssText = `
      font-size: 12px;
      line-height: 1.6;
      color: ${this.theme.text};
      opacity: 0.8;
    `;
    infoList.innerHTML = `
      • Tags are saved to config.json<br>
      • Matched by model filename<br>
      • Auto-injected when queuing
    `;

    infoSection.appendChild(infoTitle);
    infoSection.appendChild(infoList);

    this.adapter.bindElement(infoSection, {
      background: (t) => hexToRgba(t.prompt, 0.1),
      borderLeft: (t) => `3px solid ${t.prompt}`
    });
    this.adapter.bindElement(infoTitle, { color: "prompt" });
    this.adapter.bindElement(infoList, { color: "text" });

    return infoSection;
  }

  createModelSection() {
    const section = document.createElement("div");
    section.style.cssText = `
      margin-bottom: 24px;
    `;

    const row = custom.row();
    const label = custom.sectionLabel("model", this.theme);
    this.adapter.bindElement(label, { color: "text" });

    const controlWrapper = custom.controlWrapper(this.theme);

    const select = document.createElement("select");
    select.style.cssText = `
      width: 100%;
      height: 36px;
      padding: 0 12px;
      border: 1px solid ${this.theme.border};
      border-radius: 6px;
      background: ${this.theme.background};
      color: ${this.theme.text};
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='${encodeURIComponent(this.theme.text)}' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 32px;
    `;

    // 默认选项
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Select Model --";
    select.appendChild(defaultOption);

    // 模型选项
    this.modelList.forEach(modelName => {
      const option = document.createElement("option");
      option.value = modelName;
      option.textContent = modelName;
      select.appendChild(option);
    });

    if (this.currentModel) {
      select.value = this.currentModel;
    }

    select.addEventListener("change", () => {
      const selectedModel = select.value;
      if (selectedModel) {
        this.currentModel = selectedModel;
        const data = getOrCreateTagEntry(selectedModel);
        this.currentEntry = data;
        this.tagsTextarea.value = data.entry.Tags || "";
      }
    });

    this.modelSelect = select;

    controlWrapper.appendChild(select);
    row.appendChild(label);
    row.appendChild(controlWrapper);
    section.appendChild(row);

    return section;
  }

  createTagsSection() {
    const section = document.createElement("div");
    section.style.cssText = `
      margin-bottom: 24px;
    `;

    const row = custom.row();
    row.style.alignItems = "flex-start";

    const label = custom.sectionLabel("tags", this.theme);
    label.style.paddingTop = "10px";
    this.adapter.bindElement(label, { color: "text" });

    const rightCol = document.createElement("div");
    rightCol.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // 文本框容器
    const controlWrapper = custom.controlWrapper(this.theme);
    controlWrapper.style.minHeight = "140px";
    controlWrapper.style.padding = "12px";
    this.adapter.bindElement(controlWrapper, { background: "background" });

    const textarea = document.createElement("textarea");
    textarea.style.cssText = `
      width: 100%;
      min-height: 120px;
      max-height: 400px;
      padding: 10px;
      border: 1px solid ${this.theme.border};
      border-radius: 4px;
      background: ${this.theme.background};
      color: ${this.theme.text};
      font-size: 13px;
      font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
      line-height: 1.6;
      resize: vertical;
      outline: none;
      box-sizing: border-box;
    `;
    textarea.placeholder = "<lora:style:0.8>, masterpiece, best quality, highly detailed";
    textarea.spellcheck = false;
    textarea.value = this.currentEntry?.entry?.Tags || "";

    this.tagsTextarea = textarea;

    controlWrapper.appendChild(textarea);
    rightCol.appendChild(controlWrapper);

    row.appendChild(label);
    row.appendChild(rightCol);
    section.appendChild(row);

    return section;
  }

  createButtonBar(overlay) {
    const bottomBar = custom.dialogButtonBar();

    // Cancel 按钮
    const cancelBtn = custom.dialogButton("Cancel", this.theme);
    custom.buttonHover(cancelBtn, this.theme, 0.2);
    cancelBtn.style.flex = "1";
    cancelBtn.addEventListener("click", () => this.close(overlay));

    // Save 按钮
    const saveBtn = custom.dialogButton("Save", this.theme);
    custom.buttonHover(saveBtn, this.theme, 0.2);
    saveBtn.style.flex = "1";
    saveBtn.style.fontWeight = "500";
    saveBtn.addEventListener("click", async () => {
      const model = this.modelSelect.value;
      const text = this.tagsTextarea.value.trim();

      if (model) {
        const category = this.currentEntry?.category || getModelCategory(model);
        const id = this.currentEntry?.id;

        if (id && globalTagsDatabase[category]?.[id]) {
          updateTagEntry(category, id, model, text);
        } else {
          addTagEntry(category, model, text);
        }

        await saveConfig();
        showToast("Saved for " + getBaseModelName(model), "success");
      }

      this.close(overlay);
    });

    // Apply 按钮
    const applyBtn = custom.dialogButton("Apply", this.theme);
    custom.buttonHover(applyBtn, this.theme, 0.2);
    applyBtn.style.flex = "1";
    applyBtn.style.fontWeight = "500";
    applyBtn.addEventListener("click", async () => {
      const model = this.modelSelect.value;
      const text = this.tagsTextarea.value.trim();

      if (!model) {
        showToast("Please select a model first", "error");
        return;
      }

      const category = this.currentEntry?.category || getModelCategory(model);
      const id = this.currentEntry?.id;

      if (id && globalTagsDatabase[category]?.[id]) {
        updateTagEntry(category, id, model, text);
      } else {
        addTagEntry(category, model, text);
      }

      await saveConfig();
      showToast("Configuration applied", "success");
    });

    // 绑定主题
    this.adapter.bindElement(cancelBtn, { background: "background", color: "text" });
    this.adapter.bindElement(saveBtn, { background: "background", color: "text" });
    this.adapter.bindElement(applyBtn, { background: "background", color: "text" });

    bottomBar.appendChild(cancelBtn);
    bottomBar.appendChild(saveBtn);
    bottomBar.appendChild(applyBtn);

    return bottomBar;
  }

  close(overlay) {
    if (overlay && overlay.parentNode) {
      document.body.removeChild(overlay);
    }
    this.adapter.destroy();
  }
}

// ========== Tags Editor Window（列表+编辑视图，带选择模式）==========     

class TagsEditorWindow {
  constructor() {
    this.currentView = "list"; // "list" | "edit" | "add"
    this.selectedEntry = null;
    this.selectedCategory = null;
    this.adapter = new ComfyThemeAdapter();
    this.theme = this.adapter.theme;
    
    // 选择模式状态
    this.selectMode = false; // 是否处于选择模式
    this.selectedItems = new Set(); // 存储选中的条目ID "category:id"
  }

  show() {
    let theme = this.adapter.theme;
    
    // 创建遮罩层
    const overlay = custom.overlay(theme);
    this.overlay = overlay;
    
    // 创建对话框
    const dialog = custom.dialog(theme);
    dialog.style.width = "480px";
    dialog.style.maxWidth = "90vw";
    dialog.style.maxHeight = "85vh";
    dialog.style.display = "flex";
    dialog.style.flexDirection = "column";
    
    // 绑定主题
    this.adapter.bindElement(dialog, {
      background: "primary",
      color: "text",
      boxShadow: (t) => `0 4px 16px ${hexToRgba(t.shadow, 0.5)}`
    });
    
    // 主题变化监听
    this.adapter.onThemeChange((newTheme) => {
      theme = newTheme;
      this.theme = newTheme;
    });

    // 创建标题
    const titleEl = custom.dialogTitle("Tags Editor", theme);
    this.adapter.bindElement(titleEl, { color: "text", background: "title" });

    titleEl.style.position = "relative";
    titleEl.style.overflow = "visible";
    // 预留右侧空间以容纳控制按钮
    titleEl.style.paddingRight = "140px";

    const titleControls = document.createElement("div");
    titleControls.dataset.titleControls = "true";
    titleControls.style.cssText = 'position:absolute;right:12px;top:0;bottom:0;display:flex;align-items:center;gap:8px;z-index:10;pointer-events:auto;';

    // Select/Deselect 按钮
    const selectBtn = custom.dialogButton(this.selectMode ? "Done" : "Select", this.theme);
    selectBtn.style.flex = "0 0 auto";
    selectBtn.style.padding = "6px 14px";
    selectBtn.style.fontSize = "12px";
    selectBtn.style.minWidth = "70px";
    selectBtn.style.textAlign = "center";
    if (this.selectMode) {
      this.adapter.bindElement(selectBtn, { background: "background", color: "text" });
    }
    custom.buttonHover(selectBtn, this.theme, 0.2);
    selectBtn.addEventListener("click", () => this.toggleSelectMode());

    // Delete 按钮（仅在 Select 模式下显示）
    if (this.selectMode) {
      const deleteBtn = custom.dialogButton("Delete", this.theme);
      deleteBtn.style.flex = "0 0 auto";
      deleteBtn.style.padding = "6px 14px";
      deleteBtn.style.fontSize = "12px";
      this.adapter.bindElement(deleteBtn, { background: "background", color: "text" });
      custom.buttonHover(deleteBtn, this.theme, 0.2);
      deleteBtn.addEventListener("click", () => this.deleteSelectedItems());
      titleControls.appendChild(deleteBtn);
    }

    titleControls.appendChild(selectBtn);
    titleEl.appendChild(titleControls);
    dialog.appendChild(titleEl);

    const content = this.createListView();
    dialog.appendChild(content);
    this.contentContainer = content;
    this.dialog = dialog;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    const handleEsc = (e) => {
      if (e.key === "Escape") {
        this.close();
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);
  }

  switchView(viewType, data = null) {
    this.currentView = viewType;
    this.selectedEntry = data;
    
    this.contentContainer.innerHTML = "";
    
    if (viewType === "list") {
      const listView = this.createListViewContent();
      this.contentContainer.appendChild(listView);
    } else if (viewType === "edit") {
      const editView = this.createEditViewContent(data);
      this.contentContainer.appendChild(editView);
    } else if (viewType === "add") {
      const addView = this.createAddViewContent();
      this.contentContainer.appendChild(addView);
    }
  }

  toggleSelectMode() {
    this.selectMode = !this.selectMode;
    if (!this.selectMode) {
      this.selectedItems.clear();
    }
    this.switchView("list");
    // 更新标题按钮
    this.updateTitleButtons();
  }

  updateTitleButtons() {
    // 找到现有的标题控制按钮容器
    const titleControls = this.dialog.querySelector('[data-title-controls="true"]');
    if (!titleControls) return;

    // 清空现有按钮
    titleControls.innerHTML = "";

    // 重新创建 Select/Deselect 按钮
    const selectBtn = custom.dialogButton(this.selectMode ? "Done" : "Select", this.theme);
    selectBtn.style.flex = "0 0 auto";
    selectBtn.style.padding = "6px 14px";
    selectBtn.style.fontSize = "12px";
    selectBtn.style.minWidth = "70px";
    selectBtn.style.textAlign = "center";
    if (this.selectMode) {
      this.adapter.bindElement(selectBtn, { background: "background", color: "text" });
    }
    custom.buttonHover(selectBtn, this.theme, 0.2);
    selectBtn.addEventListener("click", () => this.toggleSelectMode());

    // Delete 按钮（仅在 Select 模式下显示）
    if (this.selectMode) {
      const deleteBtn = custom.dialogButton("Delete", this.theme);
      deleteBtn.style.flex = "0 0 auto";
      deleteBtn.style.padding = "6px 14px";
      deleteBtn.style.fontSize = "12px";
      this.adapter.bindElement(deleteBtn, { background: "background", color: "text" });
      custom.buttonHover(deleteBtn, this.theme, 0.2);
      deleteBtn.addEventListener("click", () => this.deleteSelectedItems());
      titleControls.appendChild(deleteBtn);
    }

    titleControls.appendChild(selectBtn);
  }

  toggleItemSelection(category, id) {
    const key = `${category}:${id}`;
    if (this.selectedItems.has(key)) {
      this.selectedItems.delete(key);
    } else {
      this.selectedItems.add(key);
    }
    this.updateListItemVisual(category, id);
  }

  updateListItemVisual(category, id) {
    const key = `${category}:${id}`;
    const itemEl = this.listItemElements?.get(key);
    if (!itemEl) return;
    
    const circle = itemEl.querySelector(".select-circle");
    // 隐藏圆圈，使用 outline 高亮选中项
    if (this.selectMode) {
      circle.style.display = "none";
      if (this.selectedItems.has(key)) {
        itemEl.style.outline = `2px solid ${this.theme.prompt}`;
        itemEl.style.outlineOffset = "0px";
        itemEl.style.background = hexToRgba(this.theme.prompt, 0.05);
      } else {
        itemEl.style.outline = "none";
        itemEl.style.background = this.theme.background;
      }
    } else {
      circle.style.display = "none";
      itemEl.style.outline = "none";
      itemEl.style.background = this.theme.background;
    }
  }

  async deleteSelectedItems() {
    if (this.selectedItems.size === 0) {
      showToast("No items selected", "error");
      return;
    }
    
    if (!confirm(`Delete ${this.selectedItems.size} selected item(s)?`)) {
      return;
    }
    
    this.selectedItems.forEach(key => {
      const [category, id] = key.split(":");
      deleteTagEntry(category, id);
    });
    
    await saveConfig();
    this.selectedItems.clear();
    showToast(`Deleted ${this.selectedItems.size} items`, "success");
    this.switchView("list");
  }

  createListView() {
    const container = document.createElement("div");
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    const content = this.createListViewContent();
    container.appendChild(content);
    
    return container;
  }

  createListViewContent() {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // 模型列表容器
    const listContainer = document.createElement("div");
    listContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 45vh;
      overflow-y: auto;
      padding: 4px;
    `;

    // 存储列表元素引用
    this.listItemElements = new Map();

    // 遍历所有类别
    let hasEntries = false;
    Object.entries(globalTagsDatabase).forEach(([category, entries]) => {
      if (Object.keys(entries).length === 0) return;
      hasEntries = true;

      // 类别标题
      const catHeader = document.createElement("div");
      catHeader.style.cssText = `
        font-size: 11px;
        font-weight: 600;
        color: ${this.theme.prompt};
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-top: 8px;
        margin-bottom: 4px;
        padding: 4px 8px;
        background: ${this.theme.background};
        border-radius: 4px;
      `;
      catHeader.textContent = category;
      listContainer.appendChild(catHeader);

      // 条目列表
      Object.entries(entries).forEach(([id, entry]) => {
        const item = this.createListItem(category, id, entry);
        listContainer.appendChild(item);
      });
    });

    if (!hasEntries) {
      const emptyMsg = document.createElement("div");
      emptyMsg.style.cssText = `
        text-align: center;
        padding: 40px 20px;
        color: ${this.theme.text};
        opacity: 0.6;
        font-style: italic;
      `;
      emptyMsg.textContent = "No tags stored yet. Click + to add one.";
      listContainer.appendChild(emptyMsg);
    }

    wrapper.appendChild(listContainer);

    // + 按钮
    const addBtn = document.createElement("button");
    addBtn.style.cssText = `
      width: 100%;
      min-height: 44px;
      padding: 10px 14px;
      border: 1px dashed ${this.theme.border};
      border-radius: 6px;
      background: ${this.theme.background};
      color: ${this.theme.text};
      opacity: 0.6;
      font-size: 20px;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    addBtn.textContent = "+";

    addBtn.addEventListener("mouseenter", () => {
      addBtn.style.borderColor = this.theme.prompt;
      addBtn.style.color = this.theme.prompt;
      addBtn.style.opacity = "1";
      addBtn.style.background = this.theme.background;
    });
    addBtn.addEventListener("mouseleave", () => {
      addBtn.style.borderColor = this.theme.border;
      addBtn.style.color = this.theme.text;
      addBtn.style.opacity = "0.6";
      addBtn.style.background = "transparent";
    });
    addBtn.addEventListener("click", () => {
      this.showAddDialog();
    });

    wrapper.appendChild(addBtn);

    // 底部按钮栏（Cancel, Save, Apply）
    const bottomBar = custom.dialogButtonBar();
    bottomBar.style.marginTop = "8px";
    bottomBar.style.paddingTop = "12px";

    const cancelBtn = custom.dialogButton("Cancel", this.theme);
    custom.buttonHover(cancelBtn, this.theme, 0.3);
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = custom.dialogButton("Save", this.theme);
    custom.buttonHover(saveBtn, this.theme, 0.3);
    saveBtn.addEventListener("click", async () => {
      await saveConfig();
      showToast("Configuration saved", "success");
      this.close();
    });

    const applyBtn = custom.dialogButton("Apply", this.theme);
    custom.buttonHover(applyBtn, this.theme, 0.3);
    applyBtn.style.background = hexToRgba(this.theme.prompt, 0.2);
    applyBtn.addEventListener("click", async () => {
      await saveConfig();
      showToast("Configuration saved", "success");
    });

    this.adapter.bindElement(cancelBtn, { background: "background", color: "text" });
    this.adapter.bindElement(saveBtn, { background: "background", color: "text" });
    this.adapter.bindElement(applyBtn, { background: (t) => hexToRgba(t.prompt, 0.2), color: "text" });

    bottomBar.appendChild(cancelBtn);
    bottomBar.appendChild(saveBtn);
    bottomBar.appendChild(applyBtn);

    wrapper.appendChild(bottomBar);

    return wrapper;
  }

  createListItem(category, id, entry) {
    const key = `${category}:${id}`;
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      position: relative;
      padding: 10px 14px;
      background: ${this.theme.background};
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    // 选择圆圈
    const circle = document.createElement("div");
    circle.className = "select-circle";
    circle.style.cssText = `
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid ${this.theme.prompt};
      background: transparent;
      display: none; /* 不显示圆圈，使用 outline 高亮代替 */
      transition: all 0.2s;
      flex-shrink: 0;
    `;
    wrapper.appendChild(circle);

    // 内容容器
    const content = document.createElement("div");
    content.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex: 1;
      overflow: hidden;
    `;

    const modelName = getBaseModelName(entry.Model);
    const nameEl = document.createElement("span");
    nameEl.style.cssText = `
      font-size: 13px;
      color: ${this.theme.text};
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    nameEl.textContent = modelName || "Unnamed Model";

    const tagsPreview = document.createElement("span");
    tagsPreview.style.cssText = `
      font-size: 11px;
      color: ${this.theme.text};
      opacity: 0.6;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-left: 12px;
    `;
    tagsPreview.textContent = entry.Tags ? entry.Tags.substring(0, 25) + (entry.Tags.length > 25 ? "..." : "") : "No tags";

    content.appendChild(nameEl);
    content.appendChild(tagsPreview);
    wrapper.appendChild(content);

    // 存储引用
    this.listItemElements.set(key, wrapper);

    // 悬浮提示
    const tooltip = document.createElement("div");
    tooltip.style.cssText = `
      position: fixed;
      padding: 12px 16px;
      background: ${this.theme.primary};
      color: ${this.theme.text};
      font-size: 12px;
      line-height: 1.5;
      border-radius: 8px;
      z-index: 10002;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
      box-shadow: 0 4px 16px ${hexToRgba(this.theme.shadow, 0.4)};
      border: 1px solid ${this.theme.border};
      max-width: 300px;
      word-wrap: break-word;
      pointer-events: none;
    `;
    tooltip.textContent = entry.Tags || "No tags set";
    document.body.appendChild(tooltip);

    wrapper.addEventListener("mouseenter", (e) => {
      if (!this.selectMode) {
        wrapper.style.borderColor = this.theme.prompt;
      }
      const rect = wrapper.getBoundingClientRect();
      tooltip.style.left = (rect.right + 10) + "px";
      tooltip.style.top = rect.top + "px";
      tooltip.style.opacity = "1";
      tooltip.style.visibility = "visible";
    });

    wrapper.addEventListener("mouseleave", () => {
      if (!this.selectMode) {
        wrapper.style.borderColor = this.theme.border;
      }
      tooltip.style.opacity = "0";
      tooltip.style.visibility = "hidden";
    });

    wrapper.addEventListener("click", () => {
      if (this.selectMode) {
        this.toggleItemSelection(category, id);
      } else {
        tooltip.remove();
        this.showEditDialog({ category, id, entry });
      }
    });

    wrapper.addEventListener("remove", () => {
      if (tooltip.parentNode) tooltip.remove();
    });

    // 初始化视觉状态
    if (this.selectMode) {
      this.updateListItemVisual(category, id);
    }

    return wrapper;
  }

  createEditViewContent(data) {
    const { category, id, entry } = data;

    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // 标题栏
    const titleEl = custom.dialogTitle("Edit Tags", this.theme);
    this.adapter.bindElement(titleEl, { color: "text", background: "title" });
    wrapper.appendChild(titleEl);

    // 工具栏（返回按钮）
    const toolbar = document.createElement("div");
    toolbar.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    `;

    const backBtn = custom.dialogButton("← Back", this.theme);
    backBtn.style.flex = "0 0 auto";
    backBtn.style.padding = "6px 12px";
    backBtn.style.fontSize = "12px";
    this.adapter.bindElement(backBtn, { background: "background", color: "text" });
    custom.buttonHover(backBtn, this.theme, 0.2);
    backBtn.addEventListener("click", () => this.switchView("list"));
    toolbar.appendChild(backBtn);
    wrapper.appendChild(toolbar);

    // Model 名称显示（只读）
    const modelSection = document.createElement("div");
    modelSection.style.cssText = `
      margin-bottom: 24px;
    `;

    const modelRow = custom.row();
    const modelLabel = custom.sectionLabel("model", this.theme);
    this.adapter.bindElement(modelLabel, { color: "text" });

    const modelWrapper = custom.controlWrapper(this.theme);
    this.adapter.bindElement(modelWrapper, { background: "background" });

    const modelDisplay = document.createElement("div");
    modelDisplay.style.cssText = `
      padding: 10px 12px;
      background: ${this.theme.background};
      border: 1px solid ${this.theme.border};
      border-radius: 6px;
      color: ${this.theme.text};
      font-size: 13px;
      font-family: monospace;
      opacity: 0.8;
    `;
    modelDisplay.textContent = entry.Model || "Unknown";

    modelWrapper.appendChild(modelDisplay);
    modelRow.appendChild(modelLabel);
    modelRow.appendChild(modelWrapper);
    modelSection.appendChild(modelRow);
    wrapper.appendChild(modelSection);

    // Tags 编辑器
    const tagsSection = document.createElement("div");
    tagsSection.style.cssText = `
      margin-bottom: 24px;
    `;

    const tagsRow = custom.row();
    tagsRow.style.alignItems = "flex-start";

    const tagsLabel = custom.sectionLabel("tags", this.theme);
    tagsLabel.style.paddingTop = "10px";
    this.adapter.bindElement(tagsLabel, { color: "text" });

    const tagsWrapper = custom.controlWrapper(this.theme);
    tagsWrapper.style.padding = "12px";
    this.adapter.bindElement(tagsWrapper, { background: "background" });

    const textarea = document.createElement("textarea");
    textarea.style.cssText = `
      width: 100%;
      min-height: 150px;
      padding: 12px;
      border: 1px solid ${this.theme.border};
      border-radius: 6px;
      background: ${this.theme.background};
      color: ${this.theme.text};
      font-size: 13px;
      font-family: monospace;
      line-height: 1.6;
      resize: vertical;
      outline: none;
      box-sizing: border-box;
    `;
    textarea.value = entry.Tags || "";

    tagsWrapper.appendChild(textarea);
    tagsRow.appendChild(tagsLabel);
    tagsRow.appendChild(tagsWrapper);
    tagsSection.appendChild(tagsRow);
    wrapper.appendChild(tagsSection);

    // 按钮栏
    const buttonBar = custom.dialogButtonBar();

    const cancelBtn = custom.dialogButton("Cancel", this.theme);
    custom.buttonHover(cancelBtn, this.theme, 0.2);
    cancelBtn.style.flex = "1";
    cancelBtn.addEventListener("click", () => this.switchView("list"));

    const saveBtn = custom.dialogButton("Save", this.theme);
    custom.buttonHover(saveBtn, this.theme, 0.2);
    saveBtn.style.flex = "1";
    saveBtn.style.fontWeight = "500";
    saveBtn.addEventListener("click", async () => {
      updateTagEntry(category, id, entry.Model, textarea.value);
      await saveConfig();
      showToast("Tags updated", "success");
      this.switchView("list");
    });

    this.adapter.bindElement(cancelBtn, { background: "background", color: "text" });
    this.adapter.bindElement(saveBtn, { background: (t) => hexToRgba(t.prompt, 0.2), color: "text" });

    buttonBar.appendChild(cancelBtn);
    buttonBar.appendChild(saveBtn);
    wrapper.appendChild(buttonBar);

    return wrapper;
  }

  createAddViewContent() {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    // 标题栏
    const titleEl = custom.dialogTitle("Add New Model", this.theme);
    this.adapter.bindElement(titleEl, { color: "text", background: "title" });
    wrapper.appendChild(titleEl);

    // 工具栏（返回按钮）
    const toolbar = document.createElement("div");
    toolbar.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    `;

    const backBtn = custom.dialogButton("← Back", this.theme);
    backBtn.style.flex = "0 0 auto";
    backBtn.style.padding = "6px 12px";
    backBtn.style.fontSize = "12px";
    this.adapter.bindElement(backBtn, { background: "background", color: "text" });
    custom.buttonHover(backBtn, this.theme, 0.2);
    backBtn.addEventListener("click", () => this.switchView("list"));
    toolbar.appendChild(backBtn);
    wrapper.appendChild(toolbar);

    // Model 选择
    const modelSection = document.createElement("div");
    modelSection.style.cssText = `
      margin-bottom: 24px;
    `;

    const modelRow = custom.row();
    const modelLabel = custom.sectionLabel("select", this.theme);
    this.adapter.bindElement(modelLabel, { color: "text" });

    const modelWrapper = custom.controlWrapper(this.theme);
    this.adapter.bindElement(modelWrapper, { background: "background" });

    const modelSelect = document.createElement("select");
    modelSelect.style.cssText = `
      width: 100%;
      height: 36px;
      padding: 0 12px;
      border: 1px solid ${this.theme.border};
      border-radius: 6px;
      background: ${this.theme.background};
      color: ${this.theme.text};
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='${encodeURIComponent(this.theme.text)}' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 32px;
    `;

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Select Model --";
    modelSelect.appendChild(defaultOption);

    // 从所有模型加载器节点获取模型列表
    const allModels = new Set();
    if (app.graph?._nodes) {
      app.graph._nodes.forEach(node => {
        if (isModelLoaderNode(node)) {
          const models = getModelListFromNode(node);
          models.forEach(m => allModels.add(m));
        }
      });
    }

    Array.from(allModels).sort().forEach(modelName => {
      const option = document.createElement("option");
      option.value = modelName;
      option.textContent = modelName;
      modelSelect.appendChild(option);
    });

    modelWrapper.appendChild(modelSelect);
    modelRow.appendChild(modelLabel);
    modelRow.appendChild(modelWrapper);
    modelSection.appendChild(modelRow);
    wrapper.appendChild(modelSection);

    // Tags 输入
    const tagsSection = document.createElement("div");
    tagsSection.style.cssText = `
      margin-bottom: 24px;
    `;

    const tagsRow = custom.row();
    tagsRow.style.alignItems = "flex-start";

    const tagsLabel = custom.sectionLabel("tags", this.theme);
    tagsLabel.style.paddingTop = "10px";
    this.adapter.bindElement(tagsLabel, { color: "text" });

    const tagsWrapper = custom.controlWrapper(this.theme);
    tagsWrapper.style.padding = "12px";
    this.adapter.bindElement(tagsWrapper, { background: "background" });

    const textarea = document.createElement("textarea");
    textarea.style.cssText = `
      width: 100%;
      min-height: 120px;
      padding: 12px;
      border: 1px solid ${this.theme.border};
      border-radius: 6px;
      background: ${this.theme.background};
      color: ${this.theme.text};
      font-size: 13px;
      font-family: monospace;
      line-height: 1.6;
      resize: vertical;
      outline: none;
      box-sizing: border-box;
    `;
    textarea.placeholder = "Enter tags...";

    tagsWrapper.appendChild(textarea);
    tagsRow.appendChild(tagsLabel);
    tagsRow.appendChild(tagsWrapper);
    tagsSection.appendChild(tagsRow);
    wrapper.appendChild(tagsSection);

    // 按钮栏
    const buttonBar = custom.dialogButtonBar();

    const cancelBtn = custom.dialogButton("Cancel", this.theme);
    custom.buttonHover(cancelBtn, this.theme, 0.2);
    cancelBtn.style.flex = "1";
    cancelBtn.addEventListener("click", () => this.switchView("list"));

    const addBtn = custom.dialogButton("Add", this.theme);
    custom.buttonHover(addBtn, this.theme, 0.2);
    addBtn.style.flex = "1";
    addBtn.style.fontWeight = "500";
    addBtn.addEventListener("click", async () => {
      const model = modelSelect.value;
      if (!model) {
        showToast("Please select a model", "error");
        return;
      }

      addTagEntry(null, model, textarea.value);
      await saveConfig();
      showToast("Model added", "success");
      this.switchView("list");
    });

    this.adapter.bindElement(cancelBtn, { background: "background", color: "text" });
    this.adapter.bindElement(addBtn, { background: (t) => hexToRgba(t.prompt, 0.2), color: "text" });

    buttonBar.appendChild(cancelBtn);
    buttonBar.appendChild(addBtn);
    wrapper.appendChild(buttonBar);

    return wrapper;
  }

  showEditDialog(data) {
    const { category, id, entry } = data;
    let theme = this.theme;

    // 创建新的遮罩层和对话框
    const overlay = custom.overlay(theme);
    const dialog = custom.dialog(theme);
    dialog.style.width = "480px";
    dialog.style.maxWidth = "90vw";
    dialog.style.display = "flex";
    dialog.style.flexDirection = "column";

    this.adapter.bindElement(dialog, {
      background: "primary",
      color: "text",
      boxShadow: (t) => `0 4px 16px ${hexToRgba(t.shadow, 0.5)}`
    });

    // 标题栏
    const titleEl = custom.dialogTitle("Edit Tags", theme);
    this.adapter.bindElement(titleEl, { color: "text", background: "title" });
    dialog.appendChild(titleEl);

    const contentWrapper = document.createElement("div");
    contentWrapper.style.cssText = `
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 1;
      overflow-y: auto;
    `;

    // Model 名称显示（只读）
    const modelSection = document.createElement("div");
    const modelRow = custom.row();
    const modelLabel = custom.sectionLabel("model", this.theme);
    this.adapter.bindElement(modelLabel, { color: "text" });

    const modelWrapper = custom.controlWrapper(this.theme);
    this.adapter.bindElement(modelWrapper, { background: "background" });

    const modelDisplay = document.createElement("div");
    modelDisplay.style.cssText = `
      padding: 10px 12px;
      background: ${this.theme.background};
      border: 1px solid ${this.theme.border};
      border-radius: 6px;
      color: ${this.theme.text};
      font-size: 13px;
      font-family: monospace;
      opacity: 0.8;
    `;
    modelDisplay.textContent = entry.Model || "Unknown";

    modelWrapper.appendChild(modelDisplay);
    modelRow.appendChild(modelLabel);
    modelRow.appendChild(modelWrapper);
    modelSection.appendChild(modelRow);
    contentWrapper.appendChild(modelSection);

    // Tags 编辑器
    const tagsSection = document.createElement("div");
    const tagsRow = custom.row();
    tagsRow.style.alignItems = "flex-start";

    const tagsLabel = custom.sectionLabel("tags", this.theme);
    tagsLabel.style.paddingTop = "10px";
    this.adapter.bindElement(tagsLabel, { color: "text" });

    const tagsWrapper = custom.controlWrapper(this.theme);
    tagsWrapper.style.padding = "12px";
    this.adapter.bindElement(tagsWrapper, { background: "background" });

    const textarea = document.createElement("textarea");
    textarea.style.cssText = `
      width: 100%;
      min-height: 150px;
      padding: 12px;
      border: 1px solid ${this.theme.border};
      border-radius: 6px;
      background: ${this.theme.background};
      color: ${this.theme.text};
      font-size: 13px;
      font-family: monospace;
      line-height: 1.6;
      resize: vertical;
      outline: none;
      box-sizing: border-box;
    `;
    textarea.value = entry.Tags || "";

    tagsWrapper.appendChild(textarea);
    tagsRow.appendChild(tagsLabel);
    tagsRow.appendChild(tagsWrapper);
    tagsSection.appendChild(tagsRow);
    contentWrapper.appendChild(tagsSection);

    dialog.appendChild(contentWrapper);

    // 按钮栏
    const buttonBar = custom.dialogButtonBar();

    const cancelBtn = custom.dialogButton("Cancel", this.theme);
    custom.buttonHover(cancelBtn, this.theme, 0.2);
    cancelBtn.style.flex = "1";
    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
    });

    const saveBtn = custom.dialogButton("Save", this.theme);
    custom.buttonHover(saveBtn, this.theme, 0.2);
    saveBtn.style.flex = "1";
    saveBtn.style.fontWeight = "500";
    saveBtn.addEventListener("click", async () => {
      updateTagEntry(category, id, entry.Model, textarea.value);
      await saveConfig();
      showToast("Tags updated", "success");
      document.body.removeChild(overlay);
      this.switchView("list");
    });

    this.adapter.bindElement(cancelBtn, { background: "background", color: "text" });
    this.adapter.bindElement(saveBtn, { background: (t) => hexToRgba(t.prompt, 0.2), color: "text" });

    buttonBar.appendChild(cancelBtn);
    buttonBar.appendChild(saveBtn);
    dialog.appendChild(buttonBar);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    const handleEsc = (e) => {
      if (e.key === "Escape") {
        document.body.removeChild(overlay);
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);

    setTimeout(() => textarea.focus(), 100);
  }

  showAddDialog() {
    let theme = this.theme;

    // 创建新的遮罩层和对话框
    const overlay = custom.overlay(theme);
    const dialog = custom.dialog(theme);
    dialog.style.width = "480px";
    dialog.style.maxWidth = "90vw";
    dialog.style.display = "flex";
    dialog.style.flexDirection = "column";

    this.adapter.bindElement(dialog, {
      background: "primary",
      color: "text",
      boxShadow: (t) => `0 4px 16px ${hexToRgba(t.shadow, 0.5)}`
    });

    // 标题栏
    const titleEl = custom.dialogTitle("Add New Model", theme);
    this.adapter.bindElement(titleEl, { color: "text", background: "title" });
    dialog.appendChild(titleEl);

    const contentWrapper = document.createElement("div");
    contentWrapper.style.cssText = `
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 1;
      overflow-y: auto;
    `;

    // Model 选择
    const modelSection = document.createElement("div");
    const modelRow = custom.row();
    const modelLabel = custom.sectionLabel("select", this.theme);
    this.adapter.bindElement(modelLabel, { color: "text" });

    const modelWrapper = custom.controlWrapper(this.theme);
    this.adapter.bindElement(modelWrapper, { background: "background" });

    const modelSelect = document.createElement("select");
    modelSelect.style.cssText = `
      width: 100%;
      height: 36px;
      padding: 0 12px;
      border: 1px solid ${this.theme.border};
      border-radius: 6px;
      background: ${this.theme.background};
      color: ${this.theme.text};
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='${encodeURIComponent(this.theme.text)}' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 32px;
    `;

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Select Model --";
    modelSelect.appendChild(defaultOption);

    // 从所有模型加载器节点获取模型列表
    const allModels = new Set();
    if (app.graph?._nodes) {
      app.graph._nodes.forEach(node => {
        if (isModelLoaderNode(node)) {
          const models = getModelListFromNode(node);
          models.forEach(m => allModels.add(m));
        }
      });
    }

    Array.from(allModels).sort().forEach(modelName => {
      const option = document.createElement("option");
      option.value = modelName;
      option.textContent = modelName;
      modelSelect.appendChild(option);
    });

    modelWrapper.appendChild(modelSelect);
    modelRow.appendChild(modelLabel);
    modelRow.appendChild(modelWrapper);
    modelSection.appendChild(modelRow);
    contentWrapper.appendChild(modelSection);

    // Tags 输入
    const tagsSection = document.createElement("div");
    const tagsRow = custom.row();
    tagsRow.style.alignItems = "flex-start";

    const tagsLabel = custom.sectionLabel("tags", this.theme);
    tagsLabel.style.paddingTop = "10px";
    this.adapter.bindElement(tagsLabel, { color: "text" });

    const tagsWrapper = custom.controlWrapper(this.theme);
    tagsWrapper.style.padding = "12px";
    this.adapter.bindElement(tagsWrapper, { background: "background" });

    const textarea = document.createElement("textarea");
    textarea.style.cssText = `
      width: 100%;
      min-height: 120px;
      padding: 12px;
      border: 1px solid ${this.theme.border};
      border-radius: 6px;
      background: ${this.theme.background};
      color: ${this.theme.text};
      font-size: 13px;
      font-family: monospace;
      line-height: 1.6;
      resize: vertical;
      outline: none;
      box-sizing: border-box;
    `;
    textarea.placeholder = "Enter tags...";

    tagsWrapper.appendChild(textarea);
    tagsRow.appendChild(tagsLabel);
    tagsRow.appendChild(tagsWrapper);
    tagsSection.appendChild(tagsRow);
    contentWrapper.appendChild(tagsSection);

    dialog.appendChild(contentWrapper);

    // 按钮栏
    const buttonBar = custom.dialogButtonBar();

    const cancelBtn = custom.dialogButton("Cancel", this.theme);
    custom.buttonHover(cancelBtn, this.theme, 0.2);
    cancelBtn.style.flex = "1";
    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(overlay);
    });

    const addBtn = custom.dialogButton("Add", this.theme);
    custom.buttonHover(addBtn, this.theme, 0.2);
    addBtn.style.flex = "1";
    addBtn.style.fontWeight = "500";
    addBtn.addEventListener("click", async () => {
      const model = modelSelect.value;
      if (!model) {
        showToast("Please select a model", "error");
        return;
      }

      addTagEntry(null, model, textarea.value);
      await saveConfig();
      showToast("Model added", "success");
      document.body.removeChild(overlay);
      this.switchView("list");
    });

    this.adapter.bindElement(cancelBtn, { background: "background", color: "text" });
    this.adapter.bindElement(addBtn, { background: (t) => hexToRgba(t.prompt, 0.2), color: "text" });

    buttonBar.appendChild(cancelBtn);
    buttonBar.appendChild(addBtn);
    dialog.appendChild(buttonBar);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    const handleEsc = (e) => {
      if (e.key === "Escape") {
        document.body.removeChild(overlay);
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);

    setTimeout(() => modelSelect.focus(), 100);
  }

  close() {
    if (this.overlay && this.overlay.parentNode) {
      document.body.removeChild(this.overlay);
    }
    this.adapter.destroy();
  }
}

// ========== 队列拦截 ==========

function setupQueueInterceptor() {
  const originalQueuePrompt = app.queuePrompt;
  
  app.queuePrompt = async function(number, batchCount) {
    const embeddingTags = collectEmbeddingTags();
    
    if (embeddingTags.length > 0) {
      app._pendingEmbeddingTags = embeddingTags;
      console.log("[Embedding Tags] Collected for queue:", embeddingTags.map(t => 
        `${getBaseModelName(t.model)}: ${t.text.substring(0, 50)}...`
      ));
    }
    
    return originalQueuePrompt.call(this, number, batchCount);
  };
  
  const originalGraphToPrompt = app.graphToPrompt;
  app.graphToPrompt = async function() {
    const result = await originalGraphToPrompt.call(this);
    
    if (app._pendingEmbeddingTags && app._pendingEmbeddingTags.length > 0) {
      injectTagsIntoPrompt(result, app._pendingEmbeddingTags);
      delete app._pendingEmbeddingTags;
    }
    
    return result;
  };
}

function collectEmbeddingTags() {
  const tags = [];
  
  if (!app.graph || !app.graph._nodes) return tags;
  
  for (const node of app.graph._nodes) {
    if (!isModelLoaderNode(node)) continue;
    
    const currentModel = getCurrentModelFromNode(node);
    if (!currentModel) continue;
    
    const tagEntry = findTagEntryByModel(currentModel);
    if (tagEntry) {
      tags.push({
        nodeId: node.id,
        nodeType: node.comfyClass || node.type,
        model: currentModel,
        text: tagEntry.entry.Tags,
        entryId: tagEntry.id,
        category: tagEntry.category
      });
    }
  }
  
  return tags;
}

function injectTagsIntoPrompt(promptData, embeddingTags) {
  if (!promptData.output) return;
  
  for (const tagData of embeddingTags) {
    const connectedNodes = findConnectedTextEncodeNodes(promptData, tagData.nodeId);
    
    for (const textEncodeId of connectedNodes) {
      const node = promptData.output[textEncodeId];
      if (!node || node.class_type !== "CLIPTextEncode") continue;
      
      let currentText = node.inputs?.text || "";
      
      if (!currentText.includes(tagData.text)) {
        const newText = tagData.text + (currentText ? ", " + currentText : "");
        node.inputs.text = newText;
        console.log(`[Embedding Tags] Injected into node ${textEncodeId}`);
      }
    }
  }
}

function findConnectedTextEncodeNodes(promptData, modelNodeId) {
  const connectedNodes = [];
  const visited = new Set();
  const queue = [modelNodeId];
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    const node = promptData.output[currentId];
    if (!node) continue;
    
    if (node.class_type === "CLIPTextEncode") {
      connectedNodes.push(currentId);
      continue;
    }
    
    for (const [otherId, otherNode] of Object.entries(promptData.output)) {
      if (visited.has(otherId)) continue;
      
      for (const inputValue of Object.values(otherNode.inputs || {})) {
        if (Array.isArray(inputValue) && inputValue[0] === currentId) {
          queue.push(otherId);
          break;
        }
      }
    }
  }
  
  return connectedNodes;
}

// ========== 主扩展 ==========

app.registerExtension({
  name: "a1rworkshop.embeddingtags",
  
  async setup() {
    await loadConfig();
    setupQueueInterceptor();
    
    console.log("[Embedding Tags] Extension loaded");
  },

  // Nodes 2.0 上下文菜单 API
  getNodeMenuItems(node) {
    if (!isModelLoaderNode(node)) return [];
    
    return [
      {
        content: "Open Embedding Tags Editor",
        callback: async () => {
          const dialog = new EmbeddingTagsDialog(node);
          dialog.show();
          node.setDirtyCanvas(true);
        }
      }
    ];
  },

  // 全局菜单
  getMenuOptions() {
    return [
      {
        content: "Embedding Tags",
        has_submenu: true,
        submenu: {
          options: [
            {
              content: `📁 ${CONFIG_PATH}`,
              disabled: true
            },
            null,
            {
              content: "Reload Config",
              callback: async () => {
                await loadConfig();
                showToast("Config reloaded", "success");
              }
            },
            {
              content: "Open Tags Editor",
              callback: () => {
                new TagsEditorWindow().show();
              }
            },
            null,
            {
              content: "Export Config",
              callback: () => {
                const config = { EmbeddingTags: globalTagsDatabase };
                const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `embedding_tags_${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showToast("Exported", "success");
              }
            },
            {
              content: "Import Config",
              callback: () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".json";
                input.onchange = async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const data = JSON.parse(event.target.result);
                      if (data.EmbeddingTags) {
                        globalTagsDatabase = data.EmbeddingTags;
                        // 重新计算 nextIds
                        nextIds = {};
                        Object.keys(globalTagsDatabase).forEach(category => {
                          const ids = Object.keys(globalTagsDatabase[category] || {}).map(Number).filter(n => !isNaN(n));
                          nextIds[category] = ids.length > 0 ? Math.max(...ids) + 1 : 1;
                        });
                        showToast(`Imported ${Object.keys(globalTagsDatabase).length} categories`, "success");
                      }
                    } catch (err) {
                      showToast("Import failed", "error");
                    }
                  };
                  reader.readAsText(file);
                };
                input.click();
              }
            },
            null,
            {
              content: "Clear All Tags",
              callback: () => {
                const count = Object.values(globalTagsDatabase).reduce((sum, cat) => sum + Object.keys(cat).length, 0);
                if (confirm(`Clear all ${count} tags?`)) {
                  globalTagsDatabase = {};
                  nextIds = {};
                  showToast("All cleared (not saved yet)", "info");
                }
              }
            }
          ]
        }
      }
    ];
  },

  async nodeCreated(node) {
    if (!isModelLoaderNode(node)) return;
    
    const originalOnDrawForeground = node.onDrawForeground;
    node.onDrawForeground = function(ctx) {
      if (originalOnDrawForeground) {
        originalOnDrawForeground.apply(this, arguments);
      }
      
      const currentModel = getCurrentModelFromNode(node);
      const hasTags = findTagEntryByModel(currentModel) !== null;
      
      if (hasTags) {
        ctx.save();
        
        const tagText = "TAGS";
        ctx.font = "bold 11px sans-serif";
        const tagWidth = ctx.measureText(tagText).width + 16;
        const tagHeight = 20;
        const x = this.size[0] - tagWidth - 8;
        const y = 8;
        
        ctx.fillStyle = "#4CAF50";
        ctx.beginPath();
        ctx.roundRect(x, y, tagWidth, tagHeight, 4);
        ctx.fill();
        
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tagText, x + tagWidth / 2, y + tagHeight / 2);
        
        ctx.restore();
      }
    };
  }
});