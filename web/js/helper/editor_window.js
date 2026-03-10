import { ModelMetadata, fetchAllModelsFromAPI, getModelFromNode, getModelListFromNode, getModelWidgetName, getTagsDB, saveConfig, } from "../data/config_model.js";
import { createCombo, createContainer, createLabel, createTextarea, showToast, } from "../theme/themeUtils.js";
import { DialogBuilder, DIALOG_TYPE } from "../theme/dialog.js";
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
export async function createTagsEditor(options = {}) {
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
            const modelsByCategory = await fetchAllModelsFromAPI();
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
    const content = document.createElement("div");
    content.className = "a1r-editor-content";
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
        .setCloseButton(false)
        .setAutoFocus(false);
    if (config.showManagerButton) {
        builder.addCustomHeaderButton("Open Manager", "secondary", () => {
            import("./manager_window.js").then(({ showManager }) => showManager());
        });
    }
    builder
        .addButton("Cancel", "secondary", () => null)
        .addButton(mode === EDITOR_MODE.MANAGER_ADD ? "Add" : "Save", "secondary", async () => {
        const positive = content.querySelector("[data-role='tags-positive']")?.value || "";
        const negative = content.querySelector("[data-role='tags-negative']")?.value || "";
        const tags = { positive: positive.trim(), negative: negative.trim() };
        const selector = content.querySelector("[data-role='model-selector']");
        if (config.allowModelSelect) {
            const selectedModel = selector?.value || config.currentModel;
            if (!selectedModel) {
                showToast("Please select a model", "error");
                return false;
            }
            const selectedOption = selector?.selectedOptions?.[0];
            const selectedMetadata = selectedOption?._modelMetadata;
            const metadata = selectedMetadata || new ModelMetadata(selectedModel, node, getModelWidgetName(node));
            const finalCategory = selectedOption?._precomputedCategory || metadata.getCategory();
            const storagePath = metadata.getStoragePath();
            if (mode === EDITOR_MODE.MANAGER_ADD) {
                db.add(metadata, tags);
                showToast(`Added: ${metadata.getDisplayName()}`, "info");
                onSave?.({ model: storagePath, tags, category: finalCategory });
                return true;
            }
            if (!tags.positive && !tags.negative) {
                showToast("Tags are empty, entry not saved", "error");
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
            showToast(`Saved for ${metadata.getDisplayName()}`, "success");
            onSave?.({ model: storagePath, tags, category: finalCategory });
            return true;
        }
        const metadata = new ModelMetadata(config.currentModel);
        const finalCategory = category || metadata.getCategory();
        const storagePath = metadata.getStoragePath();
        if (!tags.positive && !tags.negative) {
            showToast("Tags are empty, entry not saved", "error");
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
        showToast(`Saved for ${metadata.getDisplayName()}`, "success");
        onSave?.({ model: storagePath, tags, category: finalCategory });
        return true;
    });
    builder.onClose(() => {
        onClose?.();
    });
    return builder.open();
}
function createModelSection(options) {
    const container = document.createElement("div");
    container.className = "a1r-editor-section";
    const createRow = () => {
        const row = document.createElement("div");
        row.className = "a1r-editor-row";
        const label = createLabel("model");
        label.classList.add("a1r-editor-label");
        const wrapper = createContainer();
        wrapper.classList.add("a1r-editor-field-wrapper");
        if (options.mode === "display") {
            const display = document.createElement("div");
            display.className = "a1r-editor-model-display";
            const rawPath = options.displayValue || options.currentModel || "";
            const fileName = rawPath.split(/[\/\\]/).pop() || rawPath;
            display.textContent = fileName.replace(/\.(safetensors|ckpt|pt|bin|model|onnx|tflite|gguf|ggjt|gguf2)$/i, "");
            wrapper.appendChild(display);
        }
        else { // options.mode === "select"
            const selector = createCombo();
            selector.classList.add("a1r-editor-model-selector");
            selector.dataset.role = "model-selector";
            options.modelList.forEach((item) => {
                const option = document.createElement("option");
                option.value = item.path;
                option.textContent = item.group
                    ? `[${item.group}] ${item.metadata.getRelativePath()}`
                    : item.metadata.getRelativePath();
                option._modelMetadata = item.metadata;
                option._precomputedCategory = item.group || item.metadata.getCategory();
                selector.appendChild(option);
            });
            if (options.currentModel) {
                selector.value = options.currentModel;
            }
            selector.addEventListener("change", () => options.onChange?.(selector.value));
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
    const container = document.createElement("div");
    container.className = "a1r-editor-section";
    const createRow = (labelStr, value, role) => {
        const row = document.createElement("div");
        row.className = "a1r-editor-tag-row";
        const label = createLabel(labelStr);
        label.classList.add("a1r-editor-label");
        const wrapper = createContainer();
        wrapper.classList.add("a1r-editor-field-wrapper");
        const textarea = createTextarea();
        textarea.classList.add("a1r-editor-textarea");
        textarea.dataset.role = role;
        textarea.value = value;
        textarea.placeholder = "text";
        textarea.spellcheck = false;
        wrapper.appendChild(textarea);
        row.appendChild(label);
        row.appendChild(wrapper);
        return row;
    };
    container.appendChild(createRow("positive", initialTags.positive, "tags-positive"));
    container.appendChild(createRow("negative", initialTags.negative, "tags-negative"));
    return container;
}
