import {
  ModelMetadata, getTagsDB, saveConfig,
  collectModelsFromGraph, getModelFromNode,
  getModelWidgetName, getModelListFromNode
} from "../config.js";
import { ComfyThemeAdapter } from "../adapter.js";
import { custom, showToast } from "../style.js";
import { DialogBuilder, DIALOG_TYPE } from "../dialog.js";
import { app } from "/scripts/app.js";

// ========== 编辑器模式常量 ==========

export const EDITOR_MODE = {
  NODE_CONTEXT: "node_context",   // 从节点右键菜单打开，model 锁定为节点当前值
  MANAGER_EDIT:  "manager_edit",  // 从 Manager 列表打开编辑已有条目
  MANAGER_ADD:   "manager_add"    // 从 Manager 点击 + 新增条目
};

// ========== 公开入口 ==========

/**
 * 从节点右键菜单打开编辑器
 * model 下拉框初始值为该节点当前已选模型
 */
export function showEditor(node) {
  return createTagsEditor({
    mode: EDITOR_MODE.NODE_CONTEXT,
    node: node
  })
}

// ========== 编辑器核心 ==========

export function createTagsEditor(options = {}) {
  const {
    mode      = EDITOR_MODE.NODE_CONTEXT,
    node      = null,
    entry     = null,
    category  = null,
    onSave    = null,
    onClose   = null
  } = options;

  return new Promise((resolve) => {
    const db      = getTagsDB();
    const adapter = new ComfyThemeAdapter();

    let config = {
      title:             "",
      showManagerButton: false,
      allowModelSelect:  false,
      currentModel:      "",
      initialTags:       "",
      modelList:         [],
      displayValue:      ""
    };

    switch (mode) {

      case EDITOR_MODE.NODE_CONTEXT: {
        const currentModelPath = getModelFromNode(node) || "";
        const nodeMetadata     = currentModelPath
          ? new ModelMetadata(currentModelPath, node, getModelWidgetName(node))
          : null;

        config = {
          title:             "Embedding Tag Editor",
          showManagerButton: true,
          allowModelSelect:  true,
          currentModel:      currentModelPath,
          initialTags:       "",
          modelList:         (getModelListFromNode(node) || []).map(path => {
            const metadata = new ModelMetadata(path, node, getModelWidgetName(node));
            return {
              path,
              relativePath: metadata.getRelativePath(),
              storagePath:  metadata.getStoragePath(),
              managerName:  metadata.getManagerDisplayName(),
              metadata
            }
          }),
          displayValue: nodeMetadata ? nodeMetadata.getRelativePath() : currentModelPath
        };

        if (config.currentModel) {
          const existing = db.findByModelName(config.currentModel);
          if (existing) config.initialTags = existing.entry?.Tags || ""
        }
        break
      }

      case EDITOR_MODE.MANAGER_EDIT: {
        const editMetadata = entry?.Model ? new ModelMetadata(entry.Model) : null;
        config = {
          title:             "Edit Model Tag",
          showManagerButton: false,
          allowModelSelect:  false,
          currentModel:      entry?.Model || "",
          initialTags:       entry?.Tags  || "",
          modelList:         [],
          displayValue:      editMetadata
            ? editMetadata.getRelativePath()
            : (entry?.Model || "")
        };
        break
      }

      case EDITOR_MODE.MANAGER_ADD: {
        config = {
          title:             "Add Model Tag",
          showManagerButton: false,
          allowModelSelect:  true,
          currentModel:      "",
          initialTags:       "",
          modelList:         [],
          displayValue:      ""
        };

        const modelsByCategory = collectModelsFromGraph(app);
        modelsByCategory.forEach((modelsMap, cat) => {
          modelsMap.forEach((metadata, path) => {
            config.modelList.push({
              path,
              relativePath: metadata.getRelativePath(),
              storagePath:  metadata.getStoragePath(),
              managerName:  metadata.getManagerDisplayName(),
              metadata,
              group: cat
            })
          })
        });
        config.modelList.sort((a, b) => {
          if (a.group !== b.group) return a.group.localeCompare(b.group);
          return (a.relativePath || "").localeCompare(b.relativePath || "")
        });
        break
      }
    }

    // ── 构建内容区 ──────────────────────────────────────────
    const content = document.createElement("div");
    content.style.cssText = "display: flex; flex-direction: column; gap: 16px; width: 100%;";

    const modelSection = createModelSection({
      modelList:    config.modelList,
      currentModel: config.currentModel,
      onChange: config.allowModelSelect
        ? (value) => {
            const existing = db.findByModelName(value);
            const textarea = content.querySelector("[data-role=\"tags-textarea\"]");
            if (textarea) textarea.value = existing ? existing.entry?.Tags || "" : ""
          }
        : null,
      mode:         config.allowModelSelect ? "select" : "display",
      displayValue: config.displayValue
    });
    content.appendChild(modelSection);

    const tagSection = createTagSection({ initialValue: config.initialTags });
    content.appendChild(tagSection);

    // ── 构建对话框 ──────────────────────────────────────────
    const builder = new DialogBuilder(DIALOG_TYPE.FORM)
      .setTitle(config.title)
      .setContent(content)
      .setCloseOnOverlayClick(true)
      .setCloseOnEsc(true)
      .setCloseButton(false)
      .setAutoFocus(false);

    if (config.showManagerButton) {
      builder.addCustomHeaderButton("Open Manager", "secondary", () => {
        // 延迟导入避免循环依赖初始化问题
        import("./manager_window.js").then(({ showManager }) => showManager())
      })
    }

    builder
      .addButton("Cancel", "secondary", () => {
        if (onClose) onClose();
        return null
      })
      .addButton(mode === EDITOR_MODE.MANAGER_ADD ? "Add" : "Save", "secondary", async () => {
        const tags = content.querySelector("[data-role=\"tags-textarea\"]")?.value || "";

        // ── MANAGER_ADD：只写入内存，不写磁盘 ──────────────────
        if (mode === EDITOR_MODE.MANAGER_ADD) {
          const selector = content.querySelector("[data-role=\"model-selector\"]");
          const model = selector?.value || "";
          if (!model) { showToast("Please select a model", "error"); return false }

          const selectedOption = selector?.selectedOptions[0];
          let metadata = selectedOption?._modelMetadata;
          let resolvedCategory = selectedOption?._precomputedCategory;
          if (!metadata) metadata = new ModelMetadata(model);
          if (resolvedCategory && resolvedCategory !== "unknown") metadata._category = resolvedCategory;

          const finalCategory = resolvedCategory || metadata.getCategory();
          const storagePath   = metadata.getStoragePath();
          if (finalCategory !== "unknown") metadata._category = finalCategory;

          db.add(metadata, tags.trim());
          showToast("Added: " + metadata.getDisplayName(), "success");
          if (onSave) onSave({ model: storagePath, tags: tags.trim(), category: finalCategory });
          return true
        }

        // ── NODE_CONTEXT / MANAGER_EDIT：写入内存并保存到磁盘 ──
        if (!tags.trim()) {
          showToast("Tags is empty, entry not saved", "info");
          return true
        }

        let model    = config.currentModel;
        let metadata = null;
        let resolvedCategory = category;

        if (config.allowModelSelect) {
          const selector = content.querySelector("[data-role=\"model-selector\"]");
          model = selector?.value || "";

          if (!model) {
            showToast("Please select a model", "error");
            return false
          }

          const selectedOption = selector?.selectedOptions[0];
          metadata          = selectedOption?._modelMetadata;
          resolvedCategory  = selectedOption?._precomputedCategory;

          if (!metadata) metadata = new ModelMetadata(model);
          if (resolvedCategory && resolvedCategory !== "unknown") {
            metadata._category = resolvedCategory
          }
        } else {
          metadata = new ModelMetadata(config.currentModel);
          if (resolvedCategory) metadata._category = resolvedCategory
        }

        const finalCategory = resolvedCategory || metadata.getCategory();
        const storagePath   = metadata.getStoragePath();

        const existing = db.findByModelName(model);
        let result;

        if (existing) {
          result = db.update(existing.category, existing.id, storagePath, tags)
        } else {
          if (finalCategory !== "unknown") metadata._category = finalCategory;
          result = db.add(metadata, tags)
        }

        if (!result && !existing) {
          showToast("Failed to save", "error");
          return false
        }

        await saveConfig();
        showToast("Saved for " + metadata.getDisplayName(), "success");

        if (onSave) onSave({ model: storagePath, tags, category: finalCategory });
        return true
      });

    builder.onClose(() => {
      adapter.destroy();
      if (onClose) onClose()
    });

    builder.open().then(resolve)
  })
}

// ========== 辅助组件 ==========

function createModelSection(options = {}) {
  const {
    modelList    = [],
    currentModel = "",
    onChange     = null,
    readOnly     = false,
    displayValue = "",
    mode         = "select"   // "select" | "display"
  } = options;

  const adapter   = new ComfyThemeAdapter();
  const isClassic = adapter.isClassic;
  const theme     = adapter.theme;

  const section = custom.container(theme);
  section.style.alignItems = "center";
  section.style.gap = isClassic ? "8px" : "12px";

  const label = custom.sectionLabel("model", theme);
  label.style.width      = isClassic ? "70px" : "80px";
  label.style.flexShrink = "0";
  label.style.cursor     = "default";
  if (isClassic) {
    label.style.textTransform = "uppercase";
    label.style.letterSpacing = "0.5px"
  }

  if (mode === "display" || readOnly) {
    // 只读展示模式
    const wrapper = custom.controlWrapper(theme);
    wrapper.style.flex      = "1";
    wrapper.style.minHeight = isClassic ? "28px" : "32px";
    wrapper.style.margin    = "0";
    wrapper.style.cursor    = "default";
    wrapper.addEventListener("mouseenter", (e) => {
      e.stopPropagation();
      wrapper.style.borderColor = theme.border
    });

    const display = document.createElement("div");
    display.style.cssText = `
      font-size: ${isClassic ? "13px" : "14px"};
      padding: 0 ${isClassic ? "8px" : "20px"};
      user-select: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: ${isClassic ? "26px" : "30px"};
      font-family: ${isClassic ? "Courier New, monospace" : "system-ui"};
    `;
    display.textContent = displayValue || currentModel;
    wrapper.appendChild(display);
    section.appendChild(label);
    section.appendChild(wrapper)

  } else {
    // 选择模式
    const wrapper = custom.controlWrapper(theme);
    wrapper.style.flex      = "1";
    wrapper.style.minHeight = isClassic ? "28px" : "32px";
    wrapper.style.margin    = "0";

    const selector = document.createElement("select");
    selector.className       = "a1r-selector" + (isClassic ? " classic" : " modern");
    selector.dataset.role    = "model-selector";
    selector.style.cssText = isClassic ? `
      width: 100%; height: 100%; border: none; border-radius: 0px;
      outline: none; padding: 0 8px; font-size: 13px; font-weight: 400;
      cursor: pointer; font-family: Courier New, monospace;
      background: transparent; color: ${theme.text};
    ` : `
      width: 100%; height: 100%; border: none; border-radius: 6px;
      outline: none; padding: 0 20px; font-size: 14px; font-weight: 500;
      cursor: pointer; background: transparent; color: ${theme.text};
    `;

    // 高亮当前选中项的背景色——通过 <style> 注入，仅影响本 selector
    const selectorId = "a1r-sel-" + Math.random().toString(36).slice(2, 8);
    selector.id = selectorId;
    const highlightStyle = document.createElement("style");
    highlightStyle.textContent = `#${selectorId} option:checked { background: ${theme.title}; color: ${theme.text}; }`;
    document.head.appendChild(highlightStyle);
    selector.addEventListener("remove", () => highlightStyle.remove());

    modelList.forEach((item) => {
      const option = document.createElement("option");
      if (typeof item === "string") {
        option.value       = item;
        option.textContent = new ModelMetadata(item).getRelativePath();
      } else {
        const rawPath = item.path || "";
        option.value  = rawPath;
        if (item.metadata) {
          option.textContent            = item.metadata.getRelativePath();
          option._modelMetadata         = item.metadata;
          option._precomputedCategory   = item.group
        } else {
          option.textContent = new ModelMetadata(rawPath).getRelativePath()
        }
      }
      option.style.background = theme.primary;
      selector.appendChild(option)
    });

    // 优先选中 currentModel，否则默认选中第一项
    if (currentModel) {
      selector.value = currentModel
    }
    // 确保始终有选中值（首项兜底）
    if (!selector.value && selector.options.length > 0) {
      selector.value = selector.options[0].value
    }

    selector.addEventListener("focus", () => {
      wrapper.style.outline = `1px solid ${theme.text}`
    });
    selector.addEventListener("blur", () => {
      wrapper.style.outline = "none"
    });
    if (onChange) selector.addEventListener("change", () => onChange(selector.value));

    wrapper.appendChild(selector);
    section.appendChild(label);
    section.appendChild(wrapper)
  }

  section.addEventListener("remove", () => adapter.destroy());
  return section
}

function createTagSection(options = {}) {
  const {
    initialValue = "",
    placeholder  = "text"
  } = options;

  const adapter   = new ComfyThemeAdapter();
  const isClassic = adapter.isClassic;
  const theme     = adapter.theme;

  const section = custom.container(theme);
  section.style.alignItems = "flex-start";
  section.style.gap        = isClassic ? "8px" : "12px";
  section.style.flex       = "1";
  section.style.minHeight  = "0";

  const label = custom.sectionLabel("tags", theme);
  label.style.width       = isClassic ? "70px" : "80px";
  label.style.flexShrink  = "0";
  label.style.marginTop   = isClassic ? "6px" : "8px";
  label.style.cursor      = "default";
  if (isClassic) {
    label.style.textTransform = "uppercase";
    label.style.letterSpacing = "0.5px"
  }

  const wrapper = custom.controlWrapper(theme);
  wrapper.style.flex        = "1";
  wrapper.style.display     = "flex";
  wrapper.style.alignItems  = "stretch";
  wrapper.style.minHeight   = isClassic ? "80px" : "120px";
  wrapper.style.padding     = isClassic ? "4px 6px" : "8px 12px";
  wrapper.style.margin      = "0";

  const textarea = custom.textarea(theme);
  textarea.dataset.role        = "tags-textarea";
  textarea.value               = initialValue;
  textarea.placeholder         = placeholder;
  textarea.spellcheck          = false;
  textarea.style.resize        = "none";
  textarea.style.minHeight     = "100px";
  // 防止父级 CSS 或 ComfyUI 画布覆盖导致无法交互
  textarea.style.pointerEvents = "auto";
  textarea.style.userSelect    = "text";

  textarea.addEventListener("focus", () => {
    wrapper.style.outline = `1px solid ${theme.text}`
  });
  textarea.addEventListener("blur", () => {
    wrapper.style.outline = "none"
  });

  wrapper.appendChild(textarea);
  section.appendChild(label);
  section.appendChild(wrapper);

  section.addEventListener("remove", () => adapter.destroy());
  return section
}