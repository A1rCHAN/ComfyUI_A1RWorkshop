import { ModelMetadata, collectModelsFromGraph, getModelFromNode, getModelListFromNode, getModelWidgetName, getTagsDB, saveConfig, } from "./config_model.js";
// @ts-expect-error ComfyUI runtime-provided module
import { app } from "/scripts/app.js";
import { createCombo, createContainer, createLabel, createTextarea, showToast, } from "../theme/themeUtils.js";
import { DialogBuilder, DIALOG_TYPE } from "../theme/dialog.js";
import { resolveThemeToken } from "../theme/themeWatcher.js";
export const EDITOR_MODE = {
    NODE_CONTEXT: "node_context",
    MANAGER_EDIT: "manager_edit",
    MANAGER_ADD: "manager_add",
};
export function showEditor(node) {
    return createTagsEditor({
        mode: EDITOR_MODE.NODE_CONTEXT,
        node,
    });
}
export function createTagsEditor(options = {}) {
    const { mode = EDITOR_MODE.NODE_CONTEXT, node = null, entry = null, category = null, onSave = null, onClose = null, } = options;
    const db = getTagsDB();
    let config = {
        title: "Embedding Tag Editor",
        showManagerButton: mode === EDITOR_MODE.NODE_CONTEXT,
        allowModelSelect: mode !== EDITOR_MODE.MANAGER_EDIT,
        currentModel: "",
        initialTags: { positive: "", negative: "" },
        modelList: [],
        displayValue: "",
    };
    switch (mode) {
        case EDITOR_MODE.NODE_CONTEXT: {
            const currentModelPath = getModelFromNode(node) || "";
            const nodeMetadata = currentModelPath
                ? new ModelMetadata(currentModelPath, node, getModelWidgetName(node))
                : null;
            config = {
                title: "Embedding Tag Editor",
                showManagerButton: true,
                allowModelSelect: true,
                currentModel: currentModelPath,
                initialTags: { positive: "", negative: "" },
                modelList: (getModelListFromNode(node) || []).map((path) => ({
                    path,
                    metadata: new ModelMetadata(path, node, getModelWidgetName(node)),
                })),
                displayValue: nodeMetadata ? nodeMetadata.getRelativePath() : currentModelPath,
            };
            if (currentModelPath) {
                const existing = db.findByModelName(currentModelPath);
                if (existing?.entry?.Tags) {
                    config.initialTags = existing.entry.Tags;
                }
            }
            break;
        }
        case EDITOR_MODE.MANAGER_EDIT: {
            const editModelPath = entry?.Model || "";
            const editMetadata = editModelPath ? new ModelMetadata(editModelPath) : null;
            config = {
                title: "Edit Model Tag",
                showManagerButton: false,
                allowModelSelect: false,
                currentModel: editModelPath,
                initialTags: entry?.Tags || { positive: "", negative: "" },
                modelList: [],
                displayValue: editMetadata ? editMetadata.getRelativePath() : editModelPath,
            };
            break;
        }
        case EDITOR_MODE.MANAGER_ADD: {
            config = {
                title: "Add Model Tag",
                showManagerButton: false,
                allowModelSelect: true,
                currentModel: "",
                initialTags: { positive: "", negative: "" },
                modelList: [],
                displayValue: "",
            };
            const modelsByCategory = collectModelsFromGraph(app);
            modelsByCategory.forEach((modelsMap, group) => {
                modelsMap.forEach((metadata, path) => {
                    config.modelList.push({ path, metadata, group });
                });
            });
            config.modelList.sort((a, b) => {
                const groupA = a.group || "";
                const groupB = b.group || "";
                if (groupA !== groupB)
                    return groupA.localeCompare(groupB);
                return a.metadata.getRelativePath().localeCompare(b.metadata.getRelativePath());
            });
            break;
        }
    }
    const content = createContainer({}, {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        minHeight: "unset",
        gap: "16px",
        width: "100%",
        padding: "0",
        background: "transparent",
    });
    const modelSection = createModelSection({
        mode: config.allowModelSelect ? "select" : "display",
        modelList: config.modelList,
        currentModel: config.currentModel,
        displayValue: config.displayValue,
        onChange: (value) => {
            const existing = db.findByModelName(value);
            const positiveTextarea = content.querySelector("[data-role='tags-positive']");
            const negativeTextarea = content.querySelector("[data-role='tags-negative']");
            if (positiveTextarea)
                positiveTextarea.value = existing?.entry?.Tags?.positive || "";
            if (negativeTextarea)
                negativeTextarea.value = existing?.entry?.Tags?.negative || "";
        },
    });
    const tagSection = createTagSection(config.initialTags);
    content.appendChild(modelSection);
    content.appendChild(tagSection);
    const builder = new DialogBuilder(DIALOG_TYPE.FORM)
        .setTitle(config.title)
        .setContent(content)
        .setCloseOnOverlayClick(true)
        .setCloseOnEsc(true)
        .setCloseButton(true)
        .setAutoFocus(false);
    if (config.showManagerButton) {
        builder.addCustomHeaderButton("Open Manager", "secondary", () => {
            import("./manager_window.js").then(({ showManager }) => showManager());
        });
    }
    builder
        .addButton("Cancel", "secondary", () => {
        onClose?.();
        return null;
    })
        .addButton(mode === EDITOR_MODE.MANAGER_ADD ? "Add" : "Save", "secondary", async () => {
        const positive = content.querySelector("[data-role='tags-positive']")?.value || "";
        const negative = content.querySelector("[data-role='tags-negative']")?.value || "";
        const tags = { positive: positive.trim(), negative: negative.trim() };
        const selector = content.querySelector("[data-role='model-selector']");
        if (config.allowModelSelect) {
            const selectedModel = selector?.value || config.currentModel;
            if (!selectedModel) {
                showToast({}, {}, "Please select a model", "error");
                return false;
            }
            const selectedOption = selector?.selectedOptions?.[0];
            const selectedMetadata = selectedOption?._modelMetadata;
            const metadata = selectedMetadata || new ModelMetadata(selectedModel, node, getModelWidgetName(node));
            const finalCategory = selectedOption?._precomputedCategory || metadata.getCategory();
            const storagePath = metadata.getStoragePath();
            if (mode === EDITOR_MODE.MANAGER_ADD) {
                db.add(metadata, tags);
                showToast({}, {}, `Added: ${metadata.getDisplayName()}`, "success");
                onSave?.({ model: storagePath, tags, category: finalCategory });
                return true;
            }
            if (!tags.positive && !tags.negative) {
                showToast({}, {}, "Tags are empty, entry not saved", "info");
                return true;
            }
            const existing = db.findByModelName(selectedModel);
            if (existing) {
                db.update(existing.category, existing.id, storagePath, tags);
            }
            else {
                db.add(metadata, tags);
            }
            await saveConfig();
            showToast({}, {}, `Saved for ${metadata.getDisplayName()}`, "success");
            onSave?.({ model: storagePath, tags, category: finalCategory });
            return true;
        }
        const metadata = new ModelMetadata(config.currentModel);
        const finalCategory = category || metadata.getCategory();
        const storagePath = metadata.getStoragePath();
        if (!tags.positive && !tags.negative) {
            showToast({}, {}, "Tags are empty, entry not saved", "info");
            return true;
        }
        const existing = db.findByModelName(config.currentModel);
        if (existing) {
            db.update(existing.category, existing.id, storagePath, tags);
        }
        else {
            db.add(metadata, tags);
        }
        await saveConfig();
        showToast({}, {}, `Saved for ${metadata.getDisplayName()}`, "success");
        onSave?.({ model: storagePath, tags, category: finalCategory });
        return true;
    });
    builder.onClose(() => {
        onClose?.();
    });
    return builder.open();
}
function createModelSection(options) {
    const theme = resolveThemeToken({});
    const container = createContainer({}, {
        // custom css style
        display: "flex",
        flex: "1",
        flexDirection: "column",
        minHeight: "unset",
        gap: theme.isClassic ? "8px" : "12px",
        background: "transparent",
    });
    const createRow = () => {
        const row = createContainer({}, {
            // custom css style
            display: "flex",
            flex: "1",
            alignItems: "stretch",
            gap: "8px",
            background: "transparent",
        });
        const label = createLabel("model", {}, {
            minWidth: theme.isClassic ? "70px" : "80px",
            marginTop: theme.isClassic ? "6px" : "8px",
        });
        const wrapper = createContainer({}, {
            // custom css style
            display: "flex",
            flex: "1",
            alignItems: "stretch",
            padding: theme.isClassic ? "4px 6px" : "8px 12px",
            margin: "0",
        });
        if (options.mode === "display") {
            const display = document.createElement("div");
            display.textContent = options.displayValue || options.currentModel || "";
            display.style.cssText = `
        width: 100%;
        user-select: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0 20px;
      `;
            wrapper.appendChild(display);
        }
        else {
            const selector = createCombo({}, {
                // custom css style
                flex: "1",
                maxHeight: "20px",
            });
            selector.dataset.role = "model-selector";
            options.modelList.forEach((item) => {
                const option = document.createElement("option");
                option.style.background = theme.color.background;
                option.value = item.path;
                option.textContent = item.group
                    ? `[${item.group}] ${item.metadata.getRelativePath()}`
                    : item.metadata.getRelativePath();
                selector.appendChild(option);
            });
            selector.addEventListener("change", () => options.onChange?.(selector.value));
            selector.addEventListener("focus", () => {
                wrapper.style.outline = `1px solid ${theme.color.text}`;
            });
            selector.addEventListener("blur", () => {
                wrapper.style.outline = "none";
            });
            wrapper.appendChild(selector);
        }
        row.appendChild(label);
        row.appendChild(wrapper);
        return row;
    };
    container.appendChild(createRow());
    return container;
}
function createTagSection(initialTags) {
    const theme = resolveThemeToken({});
    const container = createContainer({}, {
        // custom css style
        display: "flex",
        flex: "1",
        flexDirection: "column",
        minHeight: "unset",
        gap: theme.isClassic ? "8px" : "12px",
        background: "transparent",
    });
    const createRow = (labelStr, value, role) => {
        const row = createContainer({}, {
            // custom css style
            display: "flex",
            flex: "1",
            alignItems: "stretch",
            minHeight: "100px",
            gap: "8px",
            background: "transparent",
        });
        const label = createLabel(labelStr, {}, {
            // custom css style
            minWidth: theme.isClassic ? "70px" : "80px",
            marginTop: theme.isClassic ? "6px" : "8px",
        });
        const wrapper = createContainer({}, {
            // custom css style
            display: "flex",
            flex: "1",
            alignItems: "stretch",
            padding: theme.isClassic ? "4px 6px" : "8px 12px",
            margin: "0",
        });
        const textarea = createTextarea({}, {
            // custom css style
            flex: "1",
            minHeight: "80px",
            resize: "vertical",
        });
        textarea.dataset.role = role;
        textarea.value = value;
        textarea.placeholder = "text";
        textarea.spellcheck = false;
        textarea.addEventListener("focus", () => {
            wrapper.style.outline = `1px solid ${theme.color.text}`;
        });
        textarea.addEventListener("blur", () => {
            wrapper.style.outline = "none";
        });
        wrapper.appendChild(textarea);
        row.appendChild(label);
        row.appendChild(wrapper);
        return row;
    };
    container.appendChild(createRow("positive", initialTags.positive, "tags-positive"));
    container.appendChild(createRow("negative", initialTags.negative, "tags-negative"));
    return container;
}
