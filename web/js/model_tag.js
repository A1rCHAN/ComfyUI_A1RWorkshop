import { app } from "/scripts/app.js";
import { hexToRgba } from "../theme.js";
import { ComfyThemeAdapter } from "../adapter.js";
import { custom } from "../style.js";

// ========== 配置 ==========

const MODEL_LOADER_CLASSES= [
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

const CONFIG_PATH = "custom_nodes/ComfyUI_A1RWorkshop/config.json";

let globalTagsDatabase = {};
let nextId = {};

async function loadConfig() {
  const response = await fetch(`/api/a1rworkshop/config`);

  if (response.ok) {
    const data = await response.json();
    globalTagsDatabase = data.EmbeddingTags || {};

    Object.keys(globalTagsDatabase).forEach(category => {
      const id = Object.keys(globalTagsDatabase[category] || {}).map(Number).filter(n => !isNaN(n));
      nextId[category] = id.length > 0 ? Math.max(...id) + 1 : 1
    });

    return true
  };

  globalTagsDatabase = {};
  nextId = {};

  return false
};

async function saveConfig() {
  const config = {
    EmbeddingTags: globalTagsDatabase
  };

  const response = await fetch(`/api/a1rworkshop/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(config)
  });

  if (response.ok) { return true };

  return false
};

function addEntry(category, modelName, tagsText) {
  if (!category) { category = getModelCategory(modelName) };

  if (!globalTagsDatabase[category]) {
    globalTagsDatabase[category] = {};
    nextId[category] = 1
  };

  const baseName = getModelName(modelName);
  if (!baseName) { return null };

  const id = String(nextId[category]++);
  globalTagsDatabase[category][id] = {
    Model: modelName,
    Tags: tagsText.trim()
  };

  return { id, category, entry: globalTagsDatabase[category][id] }
};

function updateEntry(category, id, modelName, tagsText) {
  if (!globalTagsDatabase[category]?.[id]) { return false };

  globalTagsDatabase[category][id] = {
    Model: modelName,
    Tags: tagsText.trim()
  };

  return true
};

function findEntry(modelName, widgetName) {
  const baseName = getModelName(modelName);
  const category = getModelCategory(modelName, widgetName);

  if (globalTagsDatabase[category]) {
    for (const [id, entry] of Object.entries(globalTagsDatabase[category])) {
      if (getModelName(entry.Model) === baseName) {
        return { id, category, entry }
      }
    }
  };

  for (const [cate, entries] of Object.entries(globalTagsDatabase)) {
    for (const [id, entry] of Object.entries(entries)) {
      if (getModelName(entry.Model) === baseName) {
        return { id, category: cate, entry }
      }
    }
  };

  return null
};

function deleteEntry(category, id) {
  if (globalTagsDatabase[category]) {
    delete globalTagsDatabase[category][id]
  }
};

function getOrCreateEntry(modelName, widgetName) {
  const existing = findEntry(modelName, widgetName);
  if (existing) {
    return existing
  };

  const category = getModelCategory(modelName, widgetName);
  const result = addEntry(category, modelName, "");

  return result
};

// ========== 自定义对话框 ==========

function showToast(message, type = "success") {
  const adapter = new ComfyThemeAdapter();
  const theme = adapter.theme;

  const toast = custom.toast(theme);
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = "1" });

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => { toast.remove() }, 300);
  }, 2500);

  setTimeout(() => { adapter.destroy() }, 3000)
};

function showDialog(node) {
  const modelList = getModelListFromNode(node) || [];
  let currentModel = getModelFromNode(node);
  let currentNode = getModelWidgetName(node);
  let currentCategory = getModelCategory(currentModel, currentNode);
  let currentEntry = getOrCreateEntry(currentModel, currentNode);

  const adapter = new ComfyThemeAdapter();
  let theme = adapter.theme;

  return new Promise((resolve) => {

    // --- 窗口 ---

    const overlay = custom.overlay(theme);
    const dialog = custom.dialog(theme);
    const title = custom.dialogTitle("Embedding Tags Editor", theme);

    title.style.position = "relative";
    title.style.overflow = "visible";
    title.style.paddingRight = "140px";

    // 标题栏右侧按钮容器
    const titleControls = document.createElement("div");
    titleControls.style.cssText = "position:absolute;right:12px;top:0;bottom:0;display:flex;align-items:center;gap:8px;z-index:10;pointer-events:auto;";

    const openManagerBtn = custom.dialogButton("Open Manager", theme);
    openManagerBtn.style.padding = "6px 12px";
    openManagerBtn.addEventListener("click", () => {
      showEditor();
    });
    titleControls.appendChild(openManagerBtn);

    title.appendChild(titleControls);
    dialog.appendChild(title);

    // 主题适配
    adapter.bindElement(dialog, {
      background: "primary",
      color: "text",
      boxShadow: (t) => `0 4px 16px ${hexToRgba(t.shadow, 0.5)}`
    });

    adapter.bindElement(title, { background: "title", color: "text" });
    adapter.bindElement(openManagerBtn, { background: "background", color: "text" });
    adapter.onThemeChange((newTheme) => { theme = newTheme });

    // --- 内容 ---

    // 模型选择
    const modelSection = document.createElement("div");
    const modelSectionRow = custom.container(theme);
    const modelLabel = custom.sectionLabel("model", theme);
    const modelSelectorWrapper = custom.controlWrapper(theme);
    const modelSelector = custom.selector(theme);
    const defaultOption = document.createElement("option");
    
    modelSection.style.marginBottom = "24px";
    defaultOption.value = "";
    defaultOption.textContent = "-- Select a model --";

    modelList.forEach((modelName) => {
      const option = document.createElement("option");
      option.value = modelName;
      option.textContent = modelName;
      modelSelector.appendChild(option);
    });

    if (currentModel) {
      modelSelector.value = currentModel;
    };

    modelSelector.addEventListener("focus", () => {
      modelSelectorWrapper.style.outline = `1px solid ${theme.text}`
    });

    modelSelector.addEventListener("blur", () => {
      modelSelectorWrapper.style.outline = "none"
    });

    modelSelector.addEventListener("change", () => {
      const selectedModel = modelSelector.value;
      if (!selectedModel) return;

      currentModel = selectedModel;
      currentCategory = getModelCategory(currentModel, currentNode);
      currentEntry = getOrCreateEntry(currentModel, currentNode);
      tagsTextarea.value = currentEntry.entry.Tags || ""
    });

    modelSelector.appendChild(defaultOption);
    modelSelectorWrapper.appendChild(modelSelector);
    modelSectionRow.appendChild(modelLabel);
    modelSectionRow.appendChild(modelSelectorWrapper);
    modelSection.appendChild(modelSectionRow);
    dialog.appendChild(modelSection);

    adapter.bindElement(modelLabel, { color: "text" });
    adapter.bindElement(modelSelector, { background: "background", color: "text" });

    // 标签输入
    const tagsSection = document.createElement("div");
    const tagsSectionRow = custom.container(theme);
    const tagsLabel = custom.sectionLabel("tags", theme);
    const tagsTextareaWrapper = custom.controlWrapper(theme);
    const tagsTextarea = custom.textarea(theme);

    tagsSection.style.marginBottom = "24px";
    tagsSectionRow.style.alignItems = "flex-start";
    tagsTextareaWrapper.style.padding = "8px 12px";
    tagsTextarea.placeholder = "";// 文本内容为空时显示的占位符，没想好，暂时为空
    tagsTextarea.spellcheck = false;
    tagsTextarea.value = currentEntry.entry.Tags || "";
    tagsTextarea.style.resize = "none";

    tagsTextarea.addEventListener("focus", () => {
      tagsTextareaWrapper.style.outline = `1px solid ${theme.text}`
    });

    tagsTextarea.addEventListener("blur", () => {
      tagsTextareaWrapper.style.outline = "none";
    });

    tagsTextareaWrapper.appendChild(tagsTextarea);
    tagsSectionRow.appendChild(tagsLabel);
    tagsSectionRow.appendChild(tagsTextareaWrapper);
    tagsSection.appendChild(tagsSectionRow);
    dialog.appendChild(tagsSection);

    adapter.bindElement(tagsLabel, { color: "text" });
    adapter.bindElement(tagsTextarea, { background: "background", color: "text" });

    // --- 底部按钮 ---

    const buttonRow = custom.dialogButtonBar();
    const cancelButton = custom.dialogButton("Cancel", theme);
    const saveButton = custom.dialogButton("Save", theme);
    const applyButton = custom.dialogButton("Apply", theme);

    // 点击事件
    function closeDialog() {
      if (overlay.parentNode) { document.body.removeChild(overlay) }
    };

    cancelButton.addEventListener("click", () => { closeDialog(false) });

    saveButton.addEventListener("click", async() => {
      const model = modelSelector.value;
      const tag = tagsTextarea.value.trim();
      if (!model) {
        showToast("Please select a model first", "error"); 
        return
      };

      const category = currentEntry?.category || getModelCategory(model, currentNode);
      const id = currentEntry?.id;
      if (id && globalTagsDatabase[category]?.[id]) {
        updateEntry(category, id, model, tag)
      } else {
        addEntry(category, model, tag)
      };

      await saveConfig();
      showToast("Saved for " + getModelName(model), "success");
      closeDialog(true)
    });

    applyButton.addEventListener("click", async() => {
      const model = modelSelector.value;
      const tag = tagsTextarea.value.trim();
      if (!model) {
        showToast("Please select a model first", "error"); 
        return
      };

      const category = currentEntry?.category || getModelCategory(model, currentNode);
      const id = currentEntry?.id;
      if (id && globalTagsDatabase[category]?.[id]) {
        updateEntry(category, id, model, tag)
      } else {
        addEntry(category, model, tag)
      };

      await saveConfig();
      showToast("Configuration applied", "success");
    });

    buttonRow.appendChild(cancelButton);
    buttonRow.appendChild(saveButton);
    buttonRow.appendChild(applyButton);
    dialog.appendChild(buttonRow);

    adapter.bindElement(cancelButton, { background: "background", color: "text" });
    adapter.bindElement(saveButton, { background: "background", color: "text" });
    adapter.bindElement(applyButton, { background: "background", color: "text" });

    // --- 显示窗口 ---

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 关闭窗口
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) { closeDialog(false) };

      const onEsc = (e) => {
        if (e.key == "Escape") {
          closeDialog(false);
          document.removeEventListener("keydown", onEsc)
        }
      };

      document.addEventListener("keydown", onEsc)
    });

    // 聚焦输入框
    setTimeout(() => {
      tagsTextarea.focus();
      tagsTextarea.setSelectionRange(
        tagsTextarea.value.length,
        tagsTextarea.value.length
      )
    }, 80)
  })
};

function showEditor() {
  const adapter = new ComfyThemeAdapter();
  let theme = adapter.theme;

  // 选择模式状态
  let selectMode = false;
  const selectedItems = new Set();
  const listItemElements = new Map();

  return new Promise((resolve) => {

    // --- 窗口 ---

    const overlay = custom.overlay(theme);
    const dialog = custom.dialog(theme);
    const title = custom.dialogTitle("Tags Manager", theme);

    dialog.style.width = "480px";
    dialog.style.maxWidth = "90vw";
    dialog.style.maxHeight = "85vh";
    dialog.style.display = "flex";
    dialog.style.flexDirection = "column";
    title.style.position = "relative";
    title.style.overflow = "visible";
    title.style.paddingRight = "140px";
    title.style.marginBottom = "0";

    // 标题栏右侧按钮容器
    const titleControls = document.createElement("div");
    titleControls.style.cssText = "position:absolute;right:12px;top:0;bottom:0;display:flex;align-items:center;gap:8px;z-index:10;pointer-events:auto;";

    title.appendChild(titleControls);
    dialog.appendChild(title);

    // 主题适配
    adapter.bindElement(dialog, {
      background: "primary",
      color: "text",
      boxShadow: (t) => `0 4px 16px ${hexToRgba(t.shadow, 0.5)}`
    });

    adapter.bindElement(title, { background: "title", color: "text" });
    adapter.onThemeChange((newTheme) => { theme = newTheme });

    // 内容容器
    const contentContainer = document.createElement("div");
    contentContainer.style.cssText = "display:flex;flex-direction:column;gap:12px;flex:1;max-height:80vh;overflow-y:auto;";

    dialog.appendChild(contentContainer);

    // --- 标题栏按钮 ---

    function updateTitleButtons() {
      titleControls.innerHTML = "";

      // Delete 按钮（仅在选择模式下显示）
      if (selectMode) {
        const deleteBtn = custom.dialogButton("Delete", theme);
        deleteBtn.style.flex = "0 0 auto";
        deleteBtn.style.padding = "6px 14px";
        deleteBtn.style.fontSize = "12px";
        adapter.bindElement(deleteBtn, { background: "background", color: "text" });
        deleteBtn.addEventListener("click", deleteSelectedItems);
        titleControls.appendChild(deleteBtn);
      }

      // Select / Done 按钮
      const selectBtn = custom.dialogButton(selectMode ? "Done" : "Select", theme);
      selectBtn.style.flex = "0 0 auto";
      selectBtn.style.padding = "6px 14px";
      selectBtn.style.fontSize = "12px";
      selectBtn.style.minWidth = "70px";
      selectBtn.style.textAlign = "center";
      adapter.bindElement(selectBtn, { background: "background", color: "text" });
      selectBtn.addEventListener("click", toggleSelectMode);
      titleControls.appendChild(selectBtn);
    };

    function toggleSelectMode() {
      selectMode = !selectMode;
      if (!selectMode) { selectedItems.clear() };
      updateTitleButtons();
      renderList();
    };

    function toggleItemSelection(category, id) {
      const key = `${category}:${id}`;
      if (selectedItems.has(key)) {
        selectedItems.delete(key)
      } else {
        selectedItems.add(key)
      };
      updateItemVisual(category, id);
    };

    function updateItemVisual(category, id) {
      const key = `${category}:${id}`;
      const itemEl = listItemElements.get(key);
      if (!itemEl) return;

      if (selectMode && selectedItems.has(key)) {
        itemEl.style.outline = `2px solid ${theme.prompt}`;
        itemEl.style.outlineOffset = "0px";
        itemEl.style.background = hexToRgba(theme.prompt, 0.05)
      } else {
        itemEl.style.outline = "none";
        itemEl.style.background = theme.background
      }
    };

    async function deleteSelectedItems() {
      if (selectedItems.size === 0) {
        showToast("No items selected", "error");
        return
      };

      if (!confirm(`Delete ${selectedItems.size} selected item(s)?`)) return;

      const count = selectedItems.size;
      selectedItems.forEach(key => {
        const [cat, entryId] = key.split(":");
        deleteEntry(cat, entryId)
      });
      selectedItems.clear();

      await saveConfig();
      showToast(`Deleted ${count} items`, "success");
      renderList();
    };

    // --- 列表渲染 ---

    function renderList() {
      contentContainer.innerHTML = "";
      listItemElements.clear();

      const wrapper = document.createElement("div");
      wrapper.style.cssText = "display:flex;flex-direction:column;gap:12px;";

      // 模型列表容器
      const listContainer = document.createElement("div");
      listContainer.style.cssText = "display:flex;flex-direction:column;gap:8px;max-height:45vh;overflow-y:auto;padding:4px;";

      // 遍历所有类别
      let hasEntries = false;
      Object.entries(globalTagsDatabase).forEach(([category, entries]) => {
        if (Object.keys(entries).length === 0) return;
        hasEntries = true;

        // 类别标题
        const catHeader = document.createElement("div");
        catHeader.style.cssText = "font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-top:8px;margin-bottom:4px;padding:4px 8px;border-radius:4px;";
        catHeader.textContent = category;
        adapter.bindElement(catHeader, { color: "prompt", background: "background" });
        listContainer.appendChild(catHeader);

        // 条目列表
        Object.entries(entries).forEach(([id, entry]) => {
          const item = createListItem(category, id, entry);
          listContainer.appendChild(item);
        })
      });

      if (!hasEntries) {
        const emptyMsg = document.createElement("div");
        emptyMsg.style.cssText = "text-align:center;padding:40px 20px;opacity:0.6;font-style:italic;";
        emptyMsg.textContent = "No tags stored yet. Click + to add one.";
        adapter.bindElement(emptyMsg, { color: "text" });
        listContainer.appendChild(emptyMsg);
      }

      wrapper.appendChild(listContainer);

      // "+" 按钮
      const addBtn = document.createElement("button");
      addBtn.style.cssText = "width:100%;min-height:44px;padding:10px 14px;border:1px dashed;border-radius:6px;opacity:0.6;font-size:20px;cursor:pointer;transition:all 0.2s;margin-top:8px;display:flex;align-items:center;justify-content:center;";
      addBtn.textContent = "+";
      adapter.bindElement(addBtn, { borderColor: "border", background: "background", color: "text" });

      addBtn.addEventListener("mouseenter", () => {
        addBtn.style.borderColor = theme.prompt;
        addBtn.style.color = theme.prompt;
        addBtn.style.opacity = "1"
      });
      addBtn.addEventListener("mouseleave", () => {
        addBtn.style.borderColor = theme.border;
        addBtn.style.color = theme.text;
        addBtn.style.opacity = "0.6"
      });
      addBtn.addEventListener("click", async () => {
        const added = await showAdder();
        if (added) { renderList() }
      });

      wrapper.appendChild(addBtn);

      // 底部按钮栏
      const bottomBar = custom.dialogButtonBar();
      bottomBar.style.marginTop = "8px";
      bottomBar.style.paddingTop = "12px";

      const cancelBtn = custom.dialogButton("Cancel", theme);
      cancelBtn.addEventListener("click", () => { closeDialog(false) });

      const saveBtn = custom.dialogButton("Save", theme);
      saveBtn.addEventListener("click", async () => {
        await saveConfig();
        showToast("Configuration saved", "success");
        closeDialog(true)
      });

      const applyBtn = custom.dialogButton("Apply", theme);
      applyBtn.addEventListener("click", async () => {
        await saveConfig();
        showToast("Configuration saved", "success")
      });

      adapter.bindElement(cancelBtn, { background: "background", color: "text" });
      adapter.bindElement(saveBtn, { background: "background", color: "text" });
      adapter.bindElement(applyBtn, { background: (t) => hexToRgba(t.prompt, 0.2), color: "text" });

      bottomBar.appendChild(cancelBtn);
      bottomBar.appendChild(saveBtn);
      bottomBar.appendChild(applyBtn);
      wrapper.appendChild(bottomBar);

      contentContainer.appendChild(wrapper);
    };

    // --- 列表条目 ---

    function createListItem(category, id, entry) {
      const key = `${category}:${id}`;
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:relative;padding:10px 14px;border:none;border-radius:6px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:10px;";
      adapter.bindElement(wrapper, { background: "background" });

      // 内容容器
      const content = document.createElement("div");
      content.style.cssText = "display:flex;align-items:center;justify-content:space-between;flex:1;overflow:hidden;";

      const modelName = getModelName(entry.Model);
      const nameEl = document.createElement("span");
      nameEl.style.cssText = "font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      nameEl.textContent = modelName || "Unnamed Model";
      adapter.bindElement(nameEl, { color: "text" });

      const tagsPreview = document.createElement("span");
      tagsPreview.style.cssText = "font-size:11px;opacity:0.6;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:12px;";
      tagsPreview.textContent = entry.Tags
        ? entry.Tags.substring(0, 25) + (entry.Tags.length > 25 ? "..." : "")
        : "No tags";
      adapter.bindElement(tagsPreview, { color: "text" });

      content.appendChild(nameEl);
      content.appendChild(tagsPreview);
      wrapper.appendChild(content);

      // 存储引用
      listItemElements.set(key, wrapper);

      // 悬浮提示
      const tooltip = document.createElement("div");
      tooltip.style.cssText = "position:fixed;padding:12px 16px;font-size:12px;line-height:1.5;border-radius:8px;z-index:10002;opacity:0;visibility:hidden;transition:opacity 0.2s,visibility 0.2s;max-width:300px;word-wrap:break-word;pointer-events:none;";
      tooltip.textContent = entry.Tags || "No tags set";
      adapter.bindElement(tooltip, {
        background: "primary",
        color: "text",
        border: (t) => `1px solid ${t.border}`,
        boxShadow: (t) => `0 4px 16px ${hexToRgba(t.shadow, 0.4)}`
      });
      document.body.appendChild(tooltip);

      wrapper.addEventListener("mouseenter", () => {
        if (!selectMode) { wrapper.style.borderColor = theme.prompt };
        const rect = wrapper.getBoundingClientRect();
        tooltip.style.left = (rect.right + 10) + "px";
        tooltip.style.top = rect.top + "px";
        tooltip.style.opacity = "1";
        tooltip.style.visibility = "visible"
      });

      wrapper.addEventListener("mouseleave", () => {
        if (!selectMode) { wrapper.style.borderColor = theme.border };
        tooltip.style.opacity = "0";
        tooltip.style.visibility = "hidden"
      });

      wrapper.addEventListener("click", () => {
        if (selectMode) {
          toggleItemSelection(category, id)
        } else {
          tooltip.remove();
          openEditOverlay(category, id, entry)
        }
      });

      // 初始化视觉状态
      if (selectMode) { updateItemVisual(category, id) };

      return wrapper
    };

    // --- 编辑覆盖层 ---

    function openEditOverlay(category, id, entry) {
      const editOverlay = custom.overlay(theme);
      const editDialog = custom.dialog(theme);
      const editTitle = custom.dialogTitle("Edit Tags", theme);

      editDialog.appendChild(editTitle);

      adapter.bindElement(editDialog, {
        background: "primary",
        color: "text",
        boxShadow: (t) => `0 4px 16px ${hexToRgba(t.shadow, 0.5)}`
      });
      adapter.bindElement(editTitle, { background: "title", color: "text" });

      // 模型名（只读）
      const modelSection = document.createElement("div");
      const modelRow = custom.container(theme);
      const modelLabel = custom.sectionLabel("model", theme);
      const modelWrapper = custom.controlWrapper(theme);
      const modelDisplay = document.createElement("div");
      modelDisplay.style.fontSize = "13px";
      modelDisplay.style.padding = "0 20px";
      modelDisplay.style.userSelect = "none";
      modelDisplay.textContent = entry.Model || "Unknown";

      modelSection.style.marginBottom = "24px";

      adapter.bindElement(modelLabel, { color: "text" });
      adapter.bindElement(modelDisplay, { color: "text" });

      modelWrapper.appendChild(modelDisplay);
      modelRow.appendChild(modelLabel);
      modelRow.appendChild(modelWrapper);
      modelSection.appendChild(modelRow);
      editDialog.appendChild(modelSection);

      // Tags 编辑
      const tagsSection = document.createElement("div");
      const tagsRow = custom.container(theme);
      const tagsLabel = custom.sectionLabel("tags", theme);
      const tagsWrapper = custom.controlWrapper(theme);
      const tagsTextarea = custom.textarea(theme);

      tagsSection.style.marginBottom = "24px";
      tagsRow.style.alignItems = "flex-start";
      tagsWrapper.style.padding = "8px 12px";

      adapter.bindElement(tagsLabel, { color: "text" });
      adapter.bindElement(tagsTextarea, { background: "background", color: "text" });
      tagsTextarea.spellcheck = false;
      tagsTextarea.value = entry.Tags || "";
      tagsTextarea.style.resize = "none";

      tagsWrapper.appendChild(tagsTextarea);
      tagsRow.appendChild(tagsLabel);
      tagsRow.appendChild(tagsWrapper);
      tagsSection.appendChild(tagsRow);
      editDialog.appendChild(tagsSection);

      // 按钮
      const editBottomBar = custom.dialogButtonBar();
      const editCancelBtn = custom.dialogButton("Cancel", theme);
      const editSaveBtn = custom.dialogButton("Save", theme);

      editCancelBtn.style.flex = "1";
      editSaveBtn.style.flex = "1";
      editSaveBtn.style.fontWeight = "500";

      adapter.bindElement(editCancelBtn, { background: "background", color: "text" });
      adapter.bindElement(editSaveBtn, { background: (t) => hexToRgba(t.prompt, 0.2), color: "text" });

      function closeEditOverlay() {
        if (editOverlay.parentNode) { document.body.removeChild(editOverlay) }
      };

      editCancelBtn.addEventListener("click", closeEditOverlay);

      editSaveBtn.addEventListener("click", async () => {
        updateEntry(category, id, entry.Model, tagsTextarea.value);
        await saveConfig();
        showToast("Tags updated", "success");
        closeEditOverlay();
        renderList()
      });

      editBottomBar.appendChild(editCancelBtn);
      editBottomBar.appendChild(editSaveBtn);
      editDialog.appendChild(editBottomBar);

      editOverlay.appendChild(editDialog);
      document.body.appendChild(editOverlay);

      editOverlay.addEventListener("click", (e) => { if (e.target === editOverlay) closeEditOverlay() });
      const editOnEsc = (e) => {
        if (e.key === "Escape") {
          closeEditOverlay();
          document.removeEventListener("keydown", editOnEsc)
        }
      };
      document.addEventListener("keydown", editOnEsc);

      setTimeout(() => {
        tagsTextarea.focus();
        tagsTextarea.setSelectionRange(tagsTextarea.value.length, tagsTextarea.value.length)
      }, 80)
    };

    // --- 初始化 ---

    updateTitleButtons();
    renderList();

    // --- 显示窗口 ---

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 关闭窗口
    function closeDialog(saved) {
      if (overlay.parentNode) { document.body.removeChild(overlay) };
      adapter.destroy();
      resolve(saved)
    };

    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDialog(false) });
    const onEsc = (e) => {
      if (e.key === "Escape") {
        closeDialog(false);
        document.removeEventListener("keydown", onEsc)
      }
    };
    document.addEventListener("keydown", onEsc)
  })
};

function showAdder() {
  const adapter = new ComfyThemeAdapter();
  let theme = adapter.theme;

  return new Promise((resolve) => {

    // --- 窗口 ---

    const overlay = custom.overlay(theme);
    const dialog = custom.dialog(theme);
    const title = custom.dialogTitle("Add New Model", theme);

    dialog.appendChild(title);

    // 主题适配
    adapter.bindElement(dialog, {
      background: "primary",
      color: "text",
      boxShadow: (t) => `0 4px 16px ${hexToRgba(t.shadow, 0.5)}`
    });

    adapter.bindElement(title, { color: "text", background: "title" });
    adapter.onThemeChange((newTheme) => { theme = newTheme });

    // --- 内容 ---

    // 模型选择
    const modelSection = document.createElement("div");
    const modelRow = custom.container(theme);
    const modelLabel = custom.sectionLabel("model", theme);
    const modelWrapper = custom.controlWrapper(theme);
    const modelSelector = custom.selector(theme);
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Select Model --";

    modelSection.style.marginBottom = "24px";

    const allModels = new Map();
    if (app.graph?._nodes) {
      app.graph._nodes.forEach(node => {
        if (isModelLoaderNode(node)) {
          const models = getModelListFromNode(node);
          const wName = getModelWidgetName(node);
          models.forEach(m => { if (!allModels.has(m)) allModels.set(m, wName) });
        }
      });
    }

    Array.from(allModels.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([m, wName]) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.dataset.widgetName = wName;
      opt.textContent = m;
      modelSelector.appendChild(opt);
    });

    modelSelector.appendChild(defaultOption);
    modelWrapper.appendChild(modelSelector);
    modelRow.appendChild(modelLabel);
    modelRow.appendChild(modelWrapper);
    modelSection.appendChild(modelRow);
    dialog.appendChild(modelSection);

    adapter.bindElement(modelLabel, { color: "text" });
    adapter.bindElement(modelSelector, { background: "background", color: "text" });

    // 标签输入
    const tagsSection = document.createElement("div");
    const tagsRow = custom.container(theme);
    const tagsLabel = custom.sectionLabel("tags", theme);
    const tagsWrapper = custom.controlWrapper(theme);
    const tagsTextarea = custom.textarea(theme);

    tagsSection.style.marginBottom = "24px";
    tagsRow.style.alignItems = "flex-start";
    tagsWrapper.style.padding = "8px 12px";
    tagsTextarea.placeholder = "";
    tagsTextarea.spellcheck = false;
    tagsTextarea.style.resize = "none";

    tagsWrapper.appendChild(tagsTextarea);
    tagsRow.appendChild(tagsLabel);
    tagsRow.appendChild(tagsWrapper);
    tagsSection.appendChild(tagsRow);
    dialog.appendChild(tagsSection);

    adapter.bindElement(tagsLabel, { color: "text" });
    adapter.bindElement(tagsTextarea, { background: "background", color: "text" });

    // --- 底部按钮 ---

    const bottomBar = custom.dialogButtonBar();
    const cancelBtn = custom.dialogButton("Cancel", theme);
    const addBtn = custom.dialogButton("Add", theme);

    cancelBtn.style.flex = "1";
    cancelBtn.addEventListener("click", () => closeDialog(false));
    addBtn.style.flex = "1";
    addBtn.style.fontWeight = "500";

    // 点击事件
    function closeDialog(saved) {
      if (overlay.parentNode) document.body.removeChild(overlay);
      adapter.destroy();
      resolve(saved)
    };

    addBtn.addEventListener("click", async () => {
      const model = modelSelector.value;
      if (!model) {
        showToast("Please select a model", "error");
        return
      }

      const selectedOption = modelSelector.selectedOptions[0];
      const widgetName = selectedOption?.dataset.widgetName || "";
      const category = getModelCategory(model, widgetName);
      addEntry(category, model, tagsTextarea.value);
      await saveConfig();
      showToast("Model added", "success");
      closeDialog(true)
    });

    bottomBar.appendChild(cancelBtn);
    bottomBar.appendChild(addBtn);
    dialog.appendChild(bottomBar);

    adapter.bindElement(cancelBtn, { background: "background", color: "text" });
    adapter.bindElement(addBtn, { background: (t) => hexToRgba(t.prompt, 0.2), color: "text" });

    // --- 显示窗口 ---
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // 关闭窗口
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeDialog(false); });
    const onEsc = (e) => { if (e.key === "Escape") { closeDialog(false); document.removeEventListener("keydown", onEsc); } };
    document.addEventListener("keydown", onEsc);

    // 聚焦输入框
    setTimeout(() => modelSelector.focus(), 80)
  })
};

// ========== 辅助函数 ==========

function getModelName(fullName) {
  if (!fullName) return "unknown";

  const parts = fullName.split(/[\/\\]/);

  return parts[parts.length - 1]
};

function getModelCategory(modelPath, widgetName) {
  if (!modelPath) return "unknown";

  if (widgetName) {
    const wn = widgetName.toLowerCase();
    if (wn.includes("ckpt") || wn.includes("checkpoint")) return "checkpoints";
    if (wn.includes("lora")) return "loras";
    if (wn.includes("unet")) return "unets";
    if (wn.includes("vae")) return "vaes";
    if (wn.includes("clip")) return "clips";
    if (wn.includes("controlnet")) return "controlnets";
    if (wn.includes("ipadapter")) return "ipadapters";
    if (wn.includes("upscale")) return "upscalers"
  };
  
  const parts = modelPath.split(/[\/\\]/);
  const firstDir = parts[0]?.toLowerCase() || "unknown";
  const lower = modelPath.toLowerCase();

  if (lower.includes("lora") || lower.includes("lycoris")) return "loras";
  if (lower.includes("checkpoint") || lower.includes("checkpoints")) return "checkpoints";
  if (lower.includes("unet")) return "unets";
  if (lower.includes("vae")) return "vaes";
  if (lower.includes("clip")) return "clips";
  if (lower.includes("controlnet")) return "controlnets";
  if (lower.includes("ipadapter")) return "ipadapters";
  if (lower.includes("upscale")) return "upscalers";

  if (firstDir.includes("lora") || firstDir.includes("lycoris")) return "loras";
  if (firstDir.includes("checkpoint")) return "checkpoints";
  if (firstDir.includes("unet")) return "unets";
  if (firstDir.includes("vae")) return "vaes";
  if (firstDir.includes("clip")) return "clips";
  if (firstDir.includes("controlnet")) return "controlnets";
  if (firstDir.includes("ipadapter")) return "ipadapters";
  if (firstDir.includes("upscale")) return "upscalers";

  return "unknown"
};

function getModelWidgetName(node) {
  const modelWidget = node.widgets?.find(w =>
    w.type === "combo" &&
    (w.name === "ckpt_name" ||
      w.name === "model_name" ||
      w.name === "lora_name" ||
      w.name === "unet_name" ||
      w.name === "clip_name" ||
      w.name === "vae_name" ||
      w.name === "controlnet_name" ||
      w.name === "ipadapter_name" ||
      w.name === "upscale_name" ||
      w.name.includes("model") ||
      w.name.includes("checkpoint")
    )
  );

  return modelWidget?.name || ""
}

function getModelFromNode(node) {
  const modelWidget = node.widgets?.find(w =>
    w.type === "combo" &&
    (w.name === "ckpt_name" ||
      w.name === "model_name" ||
      w.name === "lora_name" ||
      w.name === "unet_name" ||
      w.name === "clip_name" ||
      w.name === "vae_name" ||
      w.name.includes("model") ||
      w.name.includes("checkpoint")
    )
  );

  return modelWidget?.value || ""
};

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
      w.name.includes("checkpoint")
    )
  );

  if (modelWidget?.options?.values) {
    const values = Array.from(modelWidget.options.values)
      ? modelWidget.options.values
      : modelWidget.options.values();

    return values
  };

  return []
};

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
};

// ========== 队列拦截 ==========

function setupQueueInterceptor() {
  const originalQueuePrompt = app.queuePrompt;
  
  app.queuePrompt = async function(number, batchCount) {
    const embeddingTags = collectEmbeddingTags();
    
    if (embeddingTags.length > 0) {
      app._pendingEmbeddingTags = embeddingTags;
      console.log("[Embedding Tags] Collected for queue:", embeddingTags.map(t => 
        `${getBaseModelName(t.model)}: ${t.text.substring(0, 50)}...`
      ))
    }
    
    return originalQueuePrompt.call(this, number, batchCount)
  };
  
  const originalGraphToPrompt = app.graphToPrompt;
  app.graphToPrompt = async function() {
    const result = await originalGraphToPrompt.call(this);
    
    if (app._pendingEmbeddingTags && app._pendingEmbeddingTags.length > 0) {
      injectTagsIntoPrompt(result, app._pendingEmbeddingTags);
      delete app._pendingEmbeddingTags
    };
    
    return result
  }
};

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
      })
    }
  };
  
  return tags
};

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
        console.log(`[Embedding Tags] Injected into node ${textEncodeId}`)
      }
    }
  }
};

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
      continue
    };
    
    for (const [otherId, otherNode] of Object.entries(promptData.output)) {
      if (visited.has(otherId)) continue;
      
      for (const inputValue of Object.values(otherNode.inputs || {})) {
        if (Array.isArray(inputValue) && inputValue[0] === currentId) {
          queue.push(otherId);
          break
        }
      }
    }
  };
  
  return connectedNodes
};

// ========== 主扩展 ==========

app.registerExtension({
  name: "a1rworkshop.modeltag",

  async setup() {
    await loadConfig();
    setupQueueInterceptor();
  },

  getNodeMenuItems(node) {
    if (!isModelLoaderNode(node)) return [];

    return [
      {
        content: "Open Embedding Editor",
        callback: async () => { showDialog(node) }
      }
    ];
  },

  getCanvasMenuItems(canvas) {
    return [
      null,
      {
        content: "Open Embedding Manager",
        callback: async () => { showEditor() }
      }
    ];
  },

  async nodeCreated(node) {
    if (!isModelLoaderNode(node)) return;

    const originalOnDrawForeground = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
      if (originalOnDrawForeground) {
        originalOnDrawForeground.apply(this, arguments);
      };

      const currentModel = getModelFromNode(node);
      const hasTags = findEntry(currentModel) !== null;

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
    }
  }
});