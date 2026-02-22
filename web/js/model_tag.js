import {
  ModelMetadata, initConfig, getTagsDB, saveConfig,
  saveFilteredConfig, collectModelsFromGraph,
  isModelLoaderNode, getModelFromNode,
  getModelWidgetName, getModelListFromNode
} from "../config.js";
import { ComfyThemeAdapter } from "../adapter.js";
import { custom, showToast, addButtonHover } from "../style.js";
import { hexToRgba } from "../theme.js";
import { DialogBuilder, DIALOG_TYPE } from "../dialog.js";
import { app } from "/scripts/app.js";

let isInitialized = false;

async function ensureInitialized() {
  if (!isInitialized) {
    await initConfig();
    isInitialized = true
  }
};

// ========== 主对话框 ==========

function showEditor(node) {
  ensureInitialized().then(() => {
    const db = getTagsDB();
    const modelList = getModelListFromNode(node) || [];
    let currentModel = getModelFromNode(node);
    let currentWidgetName = getModelWidgetName(node);
    
    // 使用 ModelMetadata 获取准确类别
    let currentMetadata = currentModel 
      ? new ModelMetadata(currentModel, node, currentWidgetName)
      : null;
    
    let currentEntry = currentMetadata 
      ? db.getOrCreate(currentModel, currentWidgetName, node)
      : null;

    // 创建内容容器
    const content = document.createElement("div");
    content.style.cssText = "display: flex; flex-direction: column; gap: 16px; width: 100%;";

    // 模型选择区域
    const modelSection = createModelSection(modelList, currentModel, (selectedModel) => {
      currentModel = selectedModel;
      currentMetadata = new ModelMetadata(selectedModel, node, currentWidgetName);
      currentEntry = db.getOrCreate(selectedModel, currentWidgetName, node);
      
      const textarea = content.querySelector('[data-role="tags-textarea"]');
      if (textarea) textarea.value = currentEntry.entry.Tags || "";
    });

    // 标签输入区域
    const tagSection = createTagSection(currentEntry?.entry.Tags || "");

    content.appendChild(modelSection);
    content.appendChild(tagSection);

    // 使用 DialogBuilder 创建对话框
    const builder = new DialogBuilder(DIALOG_TYPE.FORM)
      .setTitle("Embedding Tags Editor")
      .setContent(content)
      .setCloseOnOverlayClick(true)
      .setCloseOnEsc(true)
      .setCloseButton(false)
      .addCustomHeaderButton("Open Manager", "secondary", () => { showManager(); })
      .addButton("Cancel", "secondary", () => null)
      .addButton("Save", "secondary", async () => {
        const selector = content.querySelector('[data-role="model-selector"]');
        const textarea = content.querySelector('[data-role="tags-textarea"]');
        const model = selector?.value || "";
        const tags = textarea?.value || "";

        if (!model) {
          showToast("Please select a model first", "error");
          return false
        };

        // 使用 ModelMetadata 确保类别准确
        const metadata = new ModelMetadata(model, node, currentWidgetName);
        
        if (currentEntry?.id) {
          db.update(currentEntry.category, currentEntry.id, model, tags)
        } else {
          db.add(metadata, tags)
        };

        await saveConfig();
        showToast("Saved for " + metadata.getDisplayName(), "success");
        return true;
      }, { autoFocus: true })
      .addButton("Apply", "default", async () => {
        const selector = content.querySelector('[data-role="model-selector"]');
        const textarea = content.querySelector('[data-role="tags-textarea"]');
        const model = selector?.value || "";
        const tags = textarea?.value || "";

        if (!model) {
          showToast("Please select a model first", "error");
          return false
        };

        const metadata = new ModelMetadata(model, node, currentWidgetName);
        
        if (currentEntry?.id) {
          db.update(currentEntry.category, currentEntry.id, model, tags);
        } else {
          db.add(metadata, tags)
        };

        await saveConfig();
        showToast("Configuration applied", "success");
        return false
      });

    return builder.open()
  })
};

function showManager() {
  ensureInitialized().then(() => {
    const db = getTagsDB();
    const adapter = new ComfyThemeAdapter();
    const theme = adapter.theme;
    const isClassic = adapter.isClassic;

    let selectMode = false;
    const selectedItems = new Set();
    const listItemElements = new Map();
    
    // 存储每个类别的展开状态
    const categoryExpandedState = new Map();

    // 创建内容容器
    const content = document.createElement("div");
    content.style.cssText = "display: flex; flex-direction: column; gap: 12px; flex: 1; max-height: 80vh; overflow-y: auto;";

    // 渲染列表的函数
    const renderList = () => {
      content.innerHTML = "";
      listItemElements.forEach((el) => { if (el._cleanup) el._cleanup() });
      listItemElements.clear();

      const wrapper = document.createElement("div");
      wrapper.style.cssText = "display: flex; flex-direction: column; gap: 8px;";

      const categories = db.getCategories();
      let totalValidEntries = 0;

      categories.forEach(category => {
        const entries = db.getByCategory(category);

        const validEntries = Object.entries(entries).filter(([id, entry]) => {
          return entry.Tags && entry.Tags.trim().length > 0
        });

        if (validEntries.length === 0) return;

        totalValidEntries += validEntries.length;

        // 创建类别容器
        const categoryContainer = document.createElement("div");
        categoryContainer.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
        
        // 初始化展开状态（默认展开）
        if (!categoryExpandedState.has(category)) {
          categoryExpandedState.set(category, true)
        };

        const isExpanded = categoryExpandedState.get(category);

        // 条目容器（可动画）- 先创建，后传入header
        const entriesContainer = document.createElement("div");
        entriesContainer.dataset.role = "entries-container";
        entriesContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow: hidden;
          transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                      opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                      margin 0.25s ease;
          ${isClassic ? '' : 'will-change: max-height, opacity;'}
        `;

        // 创建可点击的类别标题栏 - 传入容器引用以便后续操作
        const catHeader = createCategoryHeader(
          category, 
          validEntries.length, 
          isExpanded, 
          theme, 
          isClassic,
          entriesContainer, // 传入容器引用
          categoryExpandedState
        );

        // 初始状态设置
        if (!isExpanded) {
          entriesContainer.style.maxHeight = "0px";
          entriesContainer.style.opacity = "0";
          entriesContainer.style.marginTop = "0px";
          entriesContainer.style.visibility = "hidden"
        } else {
          entriesContainer.style.maxHeight = "none";
          entriesContainer.style.opacity = "1";
          entriesContainer.style.marginTop = "4px";
          entriesContainer.style.visibility = "visible"
        };

        // 创建条目
        validEntries.forEach(([id, entry]) => {
          const item = createListItem(
            category, id, entry, theme,
            selectMode, selectedItems, listItemElements,
            updateRemoveButtonVisibility, db
          );
          entriesContainer.appendChild(item)
        });

        categoryContainer.appendChild(catHeader);
        categoryContainer.appendChild(entriesContainer);
        wrapper.appendChild(categoryContainer)
      });

      if (totalValidEntries === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.style.cssText = "text-align: center; padding: 40px 20px; opacity: 0.6; font-style: italic;";
        emptyMsg.textContent = "";// 输入框提示，没想好先空着

        const msgAdapter = new ComfyThemeAdapter();
        msgAdapter.bindElement(emptyMsg, { color: "text" });

        emptyMsg.addEventListener("remove", () => msgAdapter.destroy());
        wrapper.appendChild(emptyMsg)
      };

      content.appendChild(wrapper);

      // "+" 按钮
      const addBtn = document.createElement("button");
      addBtn.style.cssText = "width: 100%; min-height: 44px; padding: 10px 14px; border: 1px dashed; border-radius: 6px; opacity: 0.6; font-size: 20px; cursor: pointer; transition: all 0.2s; margin-top: 8px; display: flex; align-items: center; justify-content: center;";
      addBtn.textContent = "+";

      const btnAdapter = new ComfyThemeAdapter();
      btnAdapter.bindElement(addBtn, {
        borderColor: "border",
        background: "background",
        color: "text"
      });

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
        if (added) renderList()
      });

      addBtn.addEventListener("remove", () => btnAdapter.destroy());
      wrapper.appendChild(addBtn)
    };

    // 删除选中项函数
    const deleteSelectedItems = async () => {
      if (selectedItems.size === 0) {
        showToast("No items selected", "error");
        return
      };

      if (!confirm(`Delete ${selectedItems.size} selected item(s)?`)) return;

      const itemsToDelete = Array.from(selectedItems).map(key => {
        const [cat, id] = key.split(":");
        return { category: cat, id }
      });

      const success = db.deleteBatch(itemsToDelete);
      if (success) {
        selectedItems.clear();
        updateRemoveButtonVisibility();
        await saveConfig();
        showToast(`Deleted ${itemsToDelete.length} items`, "success");
        renderList()
      }
    };

    // 切换选择模式
    const toggleSelectMode = () => {
      selectMode = !selectMode;
      if (!selectMode) {
        selectedItems.clear();
        updateRemoveButtonVisibility()
      };
      updateSelectButtonState();
      renderList()
    };

    const updateSelectButtonState = () => {
      const selectBtn = document.querySelector('[data-role="select-toggle-btn"]');
      if (selectBtn) {
        selectBtn.textContent = selectMode ? "Done" : "Select"
      }
    };

    const updateRemoveButtonVisibility = () => {
      const removeBtn = document.querySelector('[data-role="remove-selected-btn"]');
      if (removeBtn) {
        const hasSelection = selectMode && selectedItems.size > 0;
        removeBtn.style.display = hasSelection ? "flex" : "none"
      }
    };

    // 初始渲染
    renderList();

    // 构建对话框
    const builder = new DialogBuilder(DIALOG_TYPE.CUSTOM)
      .setTitle("Tags Manager")
      .setContent(content)
      .setCloseOnOverlayClick(true)
      .setCloseOnEsc(true)
      .setCloseButton(false)
      .setSize("480px", "90vw", "85vh");

    // 自定义构建过程
    const originalBuild = builder._build.bind(builder);
    builder._build = function() {
      originalBuild();

      const titleBar = this._elements.titleBar;
      const titleControls = document.createElement("div");
      titleControls.style.cssText = "position: absolute; right: 12px; top: 0; bottom: 0; display: flex; align-items: center; gap: 8px; z-index: 10;";
      titleControls.dataset.role = "title-controls";

      // Remove 按钮
      const removeBtn = custom.dialogButton("Remove", theme);
      removeBtn.dataset.role = "remove-selected-btn";
      removeBtn.style.display = "none";
      removeBtn.style.padding = "6px 14px";
      removeBtn.style.fontSize = "12px";

      const removeAdapter = new ComfyThemeAdapter();
      removeAdapter.bindElement(removeBtn, { background: "background", color: "text" });
      removeBtn.addEventListener("click", deleteSelectedItems);
      removeBtn.addEventListener("remove", () => removeAdapter.destroy());

      // Select/Done 按钮
      const selectBtn = custom.dialogButton("Select", theme);
      selectBtn.dataset.role = "select-toggle-btn";
      selectBtn.style.padding = "6px 14px";
      selectBtn.style.fontSize = "12px";
      selectBtn.style.minWidth = "70px";

      const selectAdapter = new ComfyThemeAdapter();
      selectAdapter.bindElement(selectBtn, { background: "background", color: "text" });
      selectBtn.addEventListener("click", toggleSelectMode);
      selectBtn.addEventListener("remove", () => selectAdapter.destroy());

      titleControls.appendChild(removeBtn);
      titleControls.appendChild(selectBtn);
      titleBar.appendChild(titleControls)
    };

    builder
      .addButton("Cancel", "secondary", () => null)
      .addButton("Save", "secondary", async () => {
        const hasChanges = await saveFilteredConfig(db);
        if (hasChanges) {
          showToast("Configuration saved", "success")
        } else {
          showToast("No changes to save", "info")
        };

        return true
      })
      .addButton("Apply", "default", async () => {
        const hasChanges = await saveFilteredConfig(db);
        if (hasChanges) {
          showToast("Configuration applied", "success")
        } else {
          showToast("No changes to apply", "info")
        };

        return false
      });

    const cleanup = () => {
      adapter.destroy();
      listItemElements.forEach((el) => {
        if (el._cleanup) el._cleanup()
      })
    };

    return builder.open().finally(() => {
      setTimeout(cleanup, 300)
    })
  })
};

function showAdder() {
  return new Promise((resolve) => {
    ensureInitialized().then(() => {
      const db = getTagsDB();
      const adapter = new ComfyThemeAdapter();
      const theme = adapter.theme;

      // 使用 config.js 中的工具函数收集所有模型
      const modelsByCategory = collectModelsFromGraph(app);

      // 创建内容
      const content = document.createElement("div");
      content.style.cssText = "display: flex; flex-direction: column; gap: 24px;";

      // 模型选择
      const modelSection = document.createElement("div");
      const modelRow = custom.container(theme);
      const modelLabel = custom.sectionLabel("model", theme);
      const modelWrapper = custom.controlWrapper(theme);

      const modelSelector = document.createElement("select");
      modelSelector.className = "a1r-selector" + (adapter.isClassic ? " classic" : " modern");
      modelSelector.dataset.role = "model-selector";

      const baseStyle = adapter.isClassic ? {
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: "0px",
        outline: "none",
        padding: "0 8px",
        fontSize: "13px",
        fontWeight: "400",
        cursor: "pointer",
        fontFamily: "Courier New, monospace",
        background: "transparent"
      } : {
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: "6px",
        outline: "none",
        padding: "0 20px",
        fontSize: "14px",
        fontWeight: "500",
        cursor: "pointer"
      };

      Object.assign(modelSelector.style, baseStyle, {
        background: "transparent",
        color: theme.text
      });

      modelSection.style.marginBottom = "0";

      // 添加默认选项
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "-- Select Model --";
      defaultOption.style.background = theme.primary;
      modelSelector.appendChild(defaultOption);

      // 按类别排序渲染
      const sortedCategories = Array.from(modelsByCategory.entries())
        .sort(([a], [b]) => a.localeCompare(b));

      sortedCategories.forEach(([category, modelsMap]) => {
        const group = document.createElement("optgroup");
        group.label = category.charAt(0).toUpperCase() + category.slice(1);

        const sortedModels = Array.from(modelsMap.entries())
          .sort(([a, metaA], [b, metaB]) => metaA.name.localeCompare(metaB.name));

        sortedModels.forEach(([modelPath, metadata]) => {
          const option = document.createElement("option");
          option.value = modelPath;
          option._modelMetadata = metadata;
          option.dataset.widgetName = metadata.widgetName || "";
          option.dataset.category = metadata.getCategory();
          option.dataset.nodeType = metadata.getNodeType();
          option.textContent = metadata.getDisplayName();
          option.style.background = theme.primary;

          group.appendChild(option)
        });

        if (group.children.length > 0) {
          modelSelector.appendChild(group)
        }
      });

      // 焦点效果
      modelSelector.addEventListener("focus", () => {
        modelWrapper.style.outline = `1px solid ${theme.text}`
      });
      modelSelector.addEventListener("blur", () => {
        modelWrapper.style.outline = "none"
      });

      const modelLabelAdapter = new ComfyThemeAdapter();
      modelLabelAdapter.bindElement(modelLabel, { color: "text" });

      const selectorAdapter = new ComfyThemeAdapter();
      selectorAdapter.bindElement(modelSelector, { background: "background", color: "text" });

      modelWrapper.appendChild(modelSelector);
      modelRow.appendChild(modelLabel);
      modelRow.appendChild(modelWrapper);
      modelSection.appendChild(modelRow);
      content.appendChild(modelSection);

      // 模型信息展示
      const modelInfoDisplay = document.createElement("div");
      modelInfoDisplay.style.cssText = "font-size: 11px; opacity: 0.6; margin-top: -16px; padding-left: 80px; min-height: 16px;";
      modelInfoDisplay.textContent = "";

      const infoAdapter = new ComfyThemeAdapter();
      infoAdapter.bindElement(modelInfoDisplay, { color: "text" });

      modelSelector.addEventListener("change", () => {
        const selectedOption = modelSelector.selectedOptions[0];
        if (selectedOption?._modelMetadata) {
          const meta = selectedOption._modelMetadata;
          modelInfoDisplay.textContent = `Category: ${meta.getCategory()} | Type: ${meta.getNodeType()}`
        } else {
          modelInfoDisplay.textContent = ""
        }
      });

      content.appendChild(modelInfoDisplay);

      // 标签输入
      const tagsSection = document.createElement("div");
      const tagsRow = custom.container(theme);
      const tagsLabel = custom.sectionLabel("tags", theme);
      const tagsWrapper = custom.controlWrapper(theme);
      const tagsTextarea = custom.textarea(theme);

      tagsSection.style.marginBottom = "0";
      tagsRow.style.alignItems = "flex-start";
      tagsWrapper.style.padding = "8px 12px";
      tagsTextarea.placeholder = "Enter trigger words or tags for this model...";
      tagsTextarea.spellcheck = false;
      tagsTextarea.style.resize = "none";

      const tagsLabelAdapter = new ComfyThemeAdapter();
      tagsLabelAdapter.bindElement(tagsLabel, { color: "text" });

      const textareaAdapter = new ComfyThemeAdapter();
      textareaAdapter.bindElement(tagsTextarea, { background: "background", color: "text" });

      tagsWrapper.appendChild(tagsTextarea);
      tagsRow.appendChild(tagsLabel);
      tagsRow.appendChild(tagsWrapper);
      tagsSection.appendChild(tagsRow);
      content.appendChild(tagsSection);

      // 构建对话框
      const builder = new DialogBuilder(DIALOG_TYPE.FORM)
        .setTitle("Add New Model")
        .setContent(content)
        .setCloseOnOverlayClick(true)
        .setCloseOnEsc(true)
        .setCloseButton(false)
        .setSize("400px")
        .addButton("Cancel", "secondary", () => {
          resolve(false);
          return null;
        })
        .addButton("Add", "primary", async () => {
          const modelPath = modelSelector.value;

          if (!modelPath) {
            showToast("Please select a model", "error");
            return false
          };

          const selectedOption = modelSelector.selectedOptions[0];
          const metadata = selectedOption?._modelMetadata || new ModelMetadata(modelPath);
          const tags = tagsTextarea.value || "";

          const result = db.add(metadata, tags);

          if (!result) {
            showToast("Failed to add model (may already exist)", "error");
            return false
          };

          await saveConfig();
          showToast(`Added ${metadata.getDisplayName()} to ${result.category}`, "success");
          resolve(true);
          return true
        });

      setTimeout(() => modelSelector.focus(), 80);

      // 清理适配器
      const cleanup = () => {
        adapter.destroy();
        modelLabelAdapter.destroy();
        selectorAdapter.destroy();
        infoAdapter.destroy();
        tagsLabelAdapter.destroy();
        textareaAdapter.destroy()
      };

      builder.onClose(cleanup);
      builder.open()
    })
  })
};

// ========== 辅助组件 ==========

function createModelSection(modelList, currentModel, onChange) {
  const adapter = new ComfyThemeAdapter();
  const isClassic = adapter.isClassic;
  const theme = adapter.theme;

  const section = custom.container(theme);
  section.style.alignItems = "center";
  section.style.gap = isClassic ? "8px" : "12px";

  const label = custom.sectionLabel("model", theme);
  label.style.width = isClassic ? "70px" : "80px";
  label.style.flexShrink = "0";
  if (isClassic) {
    label.style.textTransform = "uppercase";
    label.style.letterSpacing = "0.5px";
  }

  const wrapper = custom.controlWrapper(theme);
  wrapper.style.flex = "1";
  wrapper.style.minHeight = isClassic ? "28px" : "32px";
  wrapper.style.margin = "0";

  const selector = custom.selector(theme);
  selector.dataset.role = "model-selector";
  selector.style.background = "transparent";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "-- Select a model --";
  defaultOption.style.background = theme.primary;
  selector.appendChild(defaultOption);

  modelList.forEach((modelName) => {
    const option = document.createElement("option");
    option.value = modelName;
    option.textContent = modelName;
    option.style.background = theme.primary;
    selector.appendChild(option);
  });

  if (currentModel) selector.value = currentModel;

  // 焦点效果
  selector.addEventListener("focus", () => {
    wrapper.style.outline = `1px solid ${theme.text}`;
  });
  selector.addEventListener("blur", () => {
    wrapper.style.outline = "none";
  });
  selector.addEventListener("change", () => onChange(selector.value));

  wrapper.appendChild(selector);
  section.appendChild(label);
  section.appendChild(wrapper);

  // 清理适配器
  section.addEventListener("remove", () => adapter.destroy());

  return section;
};

function createTagSection(initialValue) {
  const adapter = new ComfyThemeAdapter();
  const isClassic = adapter.isClassic;
  const theme = adapter.theme;

  const section = custom.container(theme);
  section.style.alignItems = "flex-start";
  section.style.gap = isClassic ? "8px" : "12px";
  section.style.flex = "1";
  section.style.minHeight = "0";

  const label = custom.sectionLabel("tags", theme);
  label.style.width = isClassic ? "70px" : "80px";
  label.style.flexShrink = "0";
  label.style.marginTop = isClassic ? "6px" : "8px";
  if (isClassic) {
    label.style.textTransform = "uppercase";
    label.style.letterSpacing = "0.5px";
  }

  const wrapper = custom.controlWrapper(theme);
  wrapper.style.flex = "1";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "stretch";
  wrapper.style.minHeight = isClassic ? "80px" : "120px";
  wrapper.style.padding = isClassic ? "4px 6px" : "8px 12px";
  wrapper.style.margin = "0";

  const textarea = custom.textarea(theme);
  textarea.dataset.role = "tags-textarea";
  textarea.value = initialValue;
  textarea.placeholder = "";
  textarea.spellcheck = false;
  textarea.style.resize = "none";
  textarea.style.minHeight = "100px";

  textarea.addEventListener("focus", () => {
    wrapper.style.outline = `1px solid ${theme.text}`;
  });
  textarea.addEventListener("blur", () => {
    wrapper.style.outline = "none";
  });

  wrapper.appendChild(textarea);
  section.appendChild(label);
  section.appendChild(wrapper);

  // 自动聚焦
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, 100);

  section.addEventListener("remove", () => adapter.destroy());

  return section;
};

function createCategoryHeader(category, itemCount, initialExpanded, theme, isClassic, entriesContainer, stateMap) {
  const adapter = new ComfyThemeAdapter();
  
  const header = document.createElement("div");
  header.dataset.role = "category-header";
  
  // 布局样式
  const baseStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: isClassic ? "6px 10px" : "8px 12px",
    borderRadius: isClassic ? "0px" : "6px",
    cursor: "pointer",
    userSelect: "none",
    transition: "outline 0.15s ease, background-color 0.15s ease, opacity 0.15s ease",
    outline: "2px solid transparent",
    outlineOffset: "-2px",
    gap: "12px",
    background: "transparent"
  };
  
  Object.assign(header.style, baseStyle);

  // 主题样式绑定
  adapter.bindElement(header, {
    color: "text"
  });

  // 左侧：三角形 + 类别名
  const leftSection = document.createElement("div");
  leftSection.style.cssText = "display: flex; align-items: center; gap: 10px; flex: 1; overflow: hidden;";

  // 三角形指示器 - 使用SVG实现更精确的圆角三角形
  const triangleWrapper = document.createElement("div");
  triangleWrapper.style.cssText = `
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: ${initialExpanded ? 'rotate(90deg)' : 'rotate(0deg)'};
  `;

  // 使用内联SVG绘制圆角三角形
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "10");
  svg.setAttribute("viewBox", "0 0 10 10");
  svg.style.cssText = "display: block;";

  // 圆角三角形路径（朝右）
  const path = document.createElementNS(svgNS, "path");
  // 绘制一个圆角三角形：起点(1,1) -> (9,5) -> (1,9) 带圆角
  path.setAttribute("d", "M2 1.5 L8 5 L2 8.5 Q1.5 9 1 8.5 Q0.5 8 1 7.5 L5 5 L1 2.5 Q0.5 2 1 1.5 Q1.5 1 2 1.5 Z");
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);

  triangleWrapper.appendChild(svg);

  // 类别文本
  const label = document.createElement("span");
  label.style.cssText = `
    font-size: ${isClassic ? "11px" : "12px"};
    font-weight: ${isClassic ? "600" : "600"};
    text-transform: uppercase;
    letter-spacing: ${isClassic ? "0.5px" : "1px"};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: ${isClassic ? "Courier New, monospace" : "system-ui"};
  `;
  label.textContent = category;

  leftSection.appendChild(triangleWrapper);
  leftSection.appendChild(label);

  // 右侧：数量徽章
  const badge = document.createElement("span");
  badge.style.cssText = `
    font-size: ${isClassic ? "10px" : "11px"};
    font-weight: 500;
    padding: ${isClassic ? "2px 6px" : "2px 8px"};
    border-radius: ${isClassic ? "0px" : "10px"};
    background: ${hexToRgba(theme.text, 0.15)};
    flex-shrink: 0;
  `;
  badge.textContent = itemCount;

  header.appendChild(leftSection);
  header.appendChild(badge);

  // 当前展开状态（闭包变量）
  let isExpanded = initialExpanded;

  // 切换函数
  const toggle = () => {
    isExpanded = !isExpanded;
    stateMap.set(category, isExpanded);
    
    // 旋转三角形
    triangleWrapper.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
    
    // 更新aria状态
    header.setAttribute("aria-expanded", isExpanded.toString());

    if (isExpanded) {
      // 展开动画
      
      // 先移除maxHeight限制以测量实际高度
      entriesContainer.style.maxHeight = "none";
      entriesContainer.style.visibility = "visible";
      
      const targetHeight = entriesContainer.scrollHeight;
      
      // 设置起始状态
      entriesContainer.style.maxHeight = "0px";
      entriesContainer.style.opacity = "0";
      entriesContainer.style.marginTop = "0px";
      
      // 强制同步布局
      entriesContainer.offsetHeight; // 触发重排
      
      // 设置目标状态
      entriesContainer.style.maxHeight = targetHeight + "px";
      entriesContainer.style.opacity = "1";
      entriesContainer.style.marginTop = "4px";
      
      // 动画结束后清理maxHeight
      const onTransitionEnd = (e) => {
        if (e.propertyName === 'max-height' && isExpanded) {
          entriesContainer.style.maxHeight = "none";
          entriesContainer.removeEventListener('transitionend', onTransitionEnd)
        }
      };
      entriesContainer.addEventListener('transitionend', onTransitionEnd)
    } else {
      // 收起动画
      
      // 先固定当前高度
      const currentHeight = entriesContainer.scrollHeight;
      entriesContainer.style.maxHeight = currentHeight + "px";
      entriesContainer.style.opacity = "1";
      entriesContainer.style.marginTop = "4px";
      entriesContainer.style.visibility = "visible";
      
      // 强制同步布局
      entriesContainer.offsetHeight; // 触发重排
      
      // 动画到收起状态
      entriesContainer.style.maxHeight = "0px";
      entriesContainer.style.opacity = "0";
      entriesContainer.style.marginTop = "0px";
      
      // 动画结束后隐藏（防止可聚焦元素被tab到）
      const onTransitionEnd = (e) => {
        if (e.propertyName === 'max-height' && !isExpanded) {
          entriesContainer.style.visibility = "hidden";
          entriesContainer.removeEventListener('transitionend', onTransitionEnd)
        }
      };
      entriesContainer.addEventListener('transitionend', onTransitionEnd)
    }
  };

  // 交互效果
  header.addEventListener("mouseenter", () => {
    header.style.backgroundColor = hexToRgba(theme.title, 0.8)
  });
  header.addEventListener("mouseleave", () => {
    header.style.backgroundColor = "transparent";
    header.style.outline = "2px solid transparent"
  });

  // 点击切换
  header.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle()
  });

  // 点击时的outline效果（使用文本颜色）
  header.addEventListener("mousedown", () => {
    header.style.outline = `2px solid ${theme.text}`
  });
  header.addEventListener("mouseup", () => {
    // 保持outline直到mouseleave，或立即清除
    setTimeout(() => {
      header.style.outline = "2px solid transparent"
    }, 150)
  });

  // 键盘支持
  header.setAttribute("tabindex", "0");
  header.setAttribute("role", "button");
  header.setAttribute("aria-expanded", isExpanded.toString());
  header.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle()
    }
  });

  // 清理
  header.addEventListener("remove", () => {
    adapter.destroy()
  });

  return header
};

function updateListItemVisual(el, key, selectMode, selectedItems, theme) {
  if (!el) return;
  
  if (selectMode && selectedItems.has(key)) {
    el.style.outline = `2px solid ${theme.prompt}`;
    el.style.outlineOffset = "0px";
    el.style.background = hexToRgba(theme.prompt, 0.05);
  } else {
    el.style.outline = "none";
    el.style.background = theme.background;
  }
};

function createListItem(category, id, entry, theme, selectMode, selectedItems, listItemElements, onSelectionChange, db) {
  const key = `${category}:${id}`;
  const adapter = new ComfyThemeAdapter();
  const isClassic = adapter.isClassic;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position: relative; padding: 10px 14px; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 10px;";
  
  addButtonHover(wrapper, theme, isClassic ? 0.15 : 0.3);
  
  adapter.bindElement(wrapper, { background: "background" });

  // 内容
  const content = document.createElement("div");
  content.style.cssText = "display: flex; align-items: center; justify-content: space-between; flex: 1; overflow: hidden;";

  const getModelName = new ModelMetadata(entry.Model).getDisplayName();
  const nameEl = document.createElement("span");
  nameEl.style.cssText = "font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
  nameEl.textContent = getModelName || "Unnamed Model";

  const nameAdapter = new ComfyThemeAdapter();
  nameAdapter.bindElement(nameEl, { color: "text" });

  const tagsPreview = document.createElement("span");
  tagsPreview.style.cssText = "font-size: 11px; opacity: 0.6; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-left: 12px;";
  
  const getTagsPreview = () => {
    const tags = entry.Tags || "";
    return tags ? tags.substring(0, 25) + (tags.length > 25 ? "..." : "") : "No tags"
  };
  
  tagsPreview.textContent = getTagsPreview();

  const previewAdapter = new ComfyThemeAdapter();
  previewAdapter.bindElement(tagsPreview, { color: "text" });

  content.appendChild(nameEl);
  content.appendChild(tagsPreview);
  wrapper.appendChild(content);

  // 存储引用
  listItemElements.set(key, wrapper);

  // 悬浮提示
  const tooltipAdapter = new ComfyThemeAdapter();
  const tooltip = document.createElement("div");
  tooltip.style.cssText = "position: fixed; padding: 12px 16px; font-size: 12px; line-height: 1.5; border-radius: 8px; z-index: 10002; opacity: 0; visibility: hidden; transition: opacity 0.2s, visibility 0.2s; max-width: 300px; word-wrap: break-word; pointer-events: none;";
  
  const getTooltipText = () => {
    const tags = entry.Tags || "";
    return tags.trim() || "No tags set"
  };
  
  tooltip.textContent = getTooltipText();

  tooltipAdapter.bindElement(tooltip, {
    background: "primary",
    color: "text",
    border: (t) => `1px solid ${t.border}`,
    boxShadow: (t) => `0 4px 16px ${hexToRgba(t.shadow, 0.4)}`
  });
  document.body.appendChild(tooltip);

  let tooltipVisible = false;

  const showTooltip = () => {
    if (selectMode) return;

    tooltip.textContent = getTooltipText();
    const rect = wrapper.getBoundingClientRect();
    tooltip.style.left = (rect.right + 10) + "px";
    tooltip.style.top = rect.top + "px";
    tooltip.style.opacity = "1";
    tooltip.style.visibility = "visible";
    tooltipVisible = true
  };

  const hideTooltip = () => {
    tooltip.style.opacity = "0";
    tooltip.style.visibility = "hidden";
    tooltipVisible = false
  };

  wrapper.addEventListener("mouseenter", () => {
    if (!selectMode) {
      wrapper.style.borderColor = theme.prompt;
      showTooltip()
    }
  });

  wrapper.addEventListener("mouseleave", () => {
    if (!selectMode) {
      wrapper.style.borderColor = theme.border;
      hideTooltip()
    }
  });

  // 点击事件
  wrapper.addEventListener("click", () => {
    if (selectMode) {
      // 切换选择状态
      if (selectedItems.has(key)) {
        selectedItems.delete(key)
      } else {
        selectedItems.add(key)
      }
      // 实时更新视觉状态
      updateListItemVisual(wrapper, key, selectMode, selectedItems, theme);

      if (onSelectionChange) { onSelectionChange() }
    } else {
      // 非选择模式：打开编辑覆盖层
      hideTooltip();
      openEditOverlay(category, id, entry, db, (updatedCategory, updatedId, updatedEntry) => {
        tagsPreview.textContent = getTagsPreview()
      })
    }
  });

  // 初始化选择状态
  if (selectMode && selectedItems.has(key)) {
    wrapper.style.outline = `2px solid ${theme.prompt}`;
    wrapper.style.outlineOffset = "0px";
    wrapper.style.background = hexToRgba(theme.prompt, 0.05)
  };

  wrapper._cleanup = () => {
    adapter.destroy();
    if (tooltip.parentNode) { tooltip.remove() };
    tooltipAdapter.destroy();
    nameAdapter.destroy();
    previewAdapter.destroy()
  };

  // 清理
  wrapper.addEventListener("remove", wrapper._cleanup);

  return wrapper
};

function openEditOverlay(category, id, entry, db, onUpdateCallback) {
  const adapter = new ComfyThemeAdapter();
  const theme = adapter.theme;

  // 创建内容
  const content = document.createElement("div");
  content.style.cssText = "display: flex; flex-direction: column; gap: 24px;";

  // 模型名（只读）
  const modelSection = document.createElement("div");
  const modelRow = custom.container(theme);
  const modelLabel = custom.sectionLabel("model", theme);
  const modelWrapper = custom.controlWrapper(theme);
  const modelDisplay = document.createElement("div");
  modelDisplay.style.cssText = "font-size: 13px; padding: 0 20px; user-select: none;";
  modelDisplay.textContent = entry.Model || "Unknown";

  modelSection.style.marginBottom = "0";

  const labelAdapter = new ComfyThemeAdapter();
  labelAdapter.bindElement(modelLabel, { color: "text" });

  const displayAdapter = new ComfyThemeAdapter();
  displayAdapter.bindElement(modelDisplay, { color: "text" });

  modelWrapper.appendChild(modelDisplay);
  modelRow.appendChild(modelLabel);
  modelRow.appendChild(modelWrapper);
  modelSection.appendChild(modelRow);
  content.appendChild(modelSection);

  // Tags 编辑
  const tagsSection = document.createElement("div");
  const tagsRow = custom.container(theme);
  const tagsLabel = custom.sectionLabel("tags", theme);
  const tagsWrapper = custom.controlWrapper(theme);
  const tagsTextarea = custom.textarea(theme);

  tagsSection.style.marginBottom = "0";
  tagsRow.style.alignItems = "flex-start";
  tagsWrapper.style.padding = "8px 12px";

  const tagsLabelAdapter = new ComfyThemeAdapter();
  tagsLabelAdapter.bindElement(tagsLabel, { color: "text" });

  const textareaAdapter = new ComfyThemeAdapter();
  textareaAdapter.bindElement(tagsTextarea, { background: "background", color: "text" });

  tagsTextarea.spellcheck = false;
  tagsTextarea.value = entry.Tags || "";
  tagsTextarea.style.resize = "none";

  tagsWrapper.appendChild(tagsTextarea);
  tagsRow.appendChild(tagsLabel);
  tagsRow.appendChild(tagsWrapper);
  tagsSection.appendChild(tagsRow);
  content.appendChild(tagsSection);

  // 构建对话框 - 使用传入的 db 进行操作
  const builder = new DialogBuilder(DIALOG_TYPE.FORM)
    .setTitle("Edit Tags")
    .setContent(content)
    .setCloseOnOverlayClick(true)
    .setCloseOnEsc(true)
    .setCloseButton(false)
    .setSize("400px")
    .addButton("Cancel", "secondary", () => {
      labelAdapter.destroy();
      displayAdapter.destroy();
      tagsLabelAdapter.destroy();
      textareaAdapter.destroy();
      adapter.destroy();
      return null
    })
    .addButton("Save", "secondary", async () => {
      const newTags = tagsTextarea.value || "";
      // 使用 db.update 替代 updateEntry
      const success = db.update(category, id, entry.Model, newTags);
      
      if (!success) {
        showToast("Failed to update tags", "error");
        return false
      };

      await saveConfig();

      entry.Tags = newTags;

      if (onUpdateCallback) {
        onUpdateCallback(category, id, entry)
      };
      
      showToast("Tags updated", "success");

      labelAdapter.destroy();
      displayAdapter.destroy();
      tagsLabelAdapter.destroy();
      textareaAdapter.destroy();
      adapter.destroy();

      return true
    });

  // 自动聚焦
  setTimeout(() => {
    tagsTextarea.focus();
    tagsTextarea.setSelectionRange(tagsTextarea.value.length, tagsTextarea.value.length)
  }, 100);

  return builder.open()
};

// ========== 队列拦截 ==========

function setupQueueInterceptor() {
  const originalQueuePrompt = app.queuePrompt;

  app.queuePrompt = async function(number, batchCount) {
    ensureInitialized().then(() => {
      const db = getTagsDB();
      const embeddingTags = collectEmbeddingTags(db);
      if (embeddingTags.length > 0) {
        app._pendingEmbeddingTags = embeddingTags;
        console.log("[Embedding Tags] Collected for queue:", embeddingTags.map(t =>
          `${new ModelMetadata(t.model).getDisplayName()}: ${t.text.substring(0, 50)}...`
        ))
      }
    });
    
    return originalQueuePrompt.call(this, number, batchCount)
  };

  const originalGraphToPrompt = app.graphToPrompt;
  app.graphToPrompt = async function() {
    const result = await originalGraphToPrompt.call(this);
    if (app._pendingEmbeddingTags?.length > 0) {
      injectTagsIntoPrompt(result, app._pendingEmbeddingTags);
      delete app._pendingEmbeddingTags
    };
    return result
  }
};

function collectEmbeddingTags(db) {
  const tags = [];
  if (!app.graph?._nodes) return tags;

  for (const node of app.graph._nodes) {
    if (!isModelLoaderNode(node)) continue;
    
    const currentModel = getModelFromNode(node);
    if (!currentModel) continue;

    const entry = db.findByModelName(currentModel);
    if (entry) {
      tags.push({
        nodeId: node.id,
        nodeType: node.comfyClass || node.type,
        model: currentModel,
        text: entry.entry.Tags,
        entryId: entry.id,
        category: entry.category
      })
    }
  };

  return tags
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
    await initConfig();
    setupQueueInterceptor()
  },

  getNodeMenuItems(node) {
    if (!isModelLoaderNode(node)) return [];
    return [{
      content: "Open Embedding Editor",
      callback: async () => { showEditor(node) }
    }]
  },

  getCanvasMenuItems(canvas) {
    return [
      null,
      {
        content: "Open Embedding Manager",
        callback: async () => { showManager() }
      }
    ]
  },

  async nodeCreated(node) {
    if (!isModelLoaderNode(node)) return;

    const originalOnDrawForeground = node.onDrawForeground;
    node.onDrawForeground = function(ctx) {
      if (originalOnDrawForeground) {
        originalOnDrawForeground.apply(this, arguments)
      };

      if (!isInitialized) return;

      const currentModel = getModelFromNode(node);
      const hasTags = getTagsDB().findByModelName(currentModel) !== null;

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
        ctx.restore()
      }
    }
  }
})