import { api } from "/scripts/api.js";
import { ModelMetadata, fetchAllModelsFromAPI } from "../data/config_model.js";
import { createCombo, createContainer, createLabel, showToast } from "../theme/themeUtils.js";
import { DialogBuilder, DIALOG_TYPE } from "../theme/dialog.js";
import { notifyModelPreviewUpdated, openLightbox } from "./popover.js";
import { showPreviewManager } from "./popover_manager.js";
export const EDITOR_MODE = {
    PREVIEW_CLICK: "preview_click",
    MANAGER_EDIT: "manager_edit",
    MANAGER_ADD: "manager_add",
};
const PREVIEW_API = "/api/a1rworkshop";
const MAX_PREVIEW_IMAGES = 10;
const SUPPORTED_FOLDERS = {
    checkpoints: "checkpoints",
    loras: "loras",
};
async function fetchPreviewUrls(folder, filename) {
    try {
        const resp = await api.fetchApi(`${PREVIEW_API}/model_previews?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(filename)}`);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        return data.images || [];
    }
    catch {
        return [];
    }
}
async function uploadPreviewImages(folder, filename, files) {
    const form = new FormData();
    form.append("folder", folder);
    form.append("filename", filename);
    for (const file of files)
        form.append("files", file, file.name);
    try {
        const resp = await api.fetchApi(`${PREVIEW_API}/upload_model_preview`, { method: "POST", body: form });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: "Upload failed" }));
            showToast(err.error || "Upload failed", "error");
            return [];
        }
        const data = await resp.json();
        return data.urls || [];
    }
    catch {
        showToast("Upload failed", "error");
        return [];
    }
}
async function deletePreviewImages(folder, filename, imageNames) {
    try {
        const resp = await api.fetchApi(`${PREVIEW_API}/delete_model_previews`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder, filename, images: imageNames }),
        });
        return resp.ok;
    }
    catch {
        return false;
    }
}
function imageNameFromUrl(url) {
    const m = url.match(/[?&]image=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : "";
}
export function showPreviewEditor(options = {}) {
    return createPreviewEditor(options);
}
export async function createPreviewEditor(options = {}) {
    const { mode = EDITOR_MODE.PREVIEW_CLICK, folder: initialFolder = "", filename: initialFilename = "", onDone = null, onClose = null, } = options;
    let currentFolder = initialFolder;
    let currentFilename = initialFilename;
    let previewUrls = [];
    let dirty = false;
    const showManagerButton = mode === EDITOR_MODE.PREVIEW_CLICK;
    const allowModelSelect = mode === EDITOR_MODE.MANAGER_ADD;
    let selectMode = false;
    const selectedItems = new Set();
    const thumbElements = new Map();
    let removeButton = null;
    const content = document.createElement("div");
    content.className = "a1r-pm-editor-content";
    const modelSection = document.createElement("div");
    modelSection.className = "a1r-editor-section";
    const modelRow = document.createElement("div");
    modelRow.className = "a1r-editor-row";
    const modelLabel = createLabel("model");
    modelLabel.classList.add("a1r-editor-label");
    const modelWrapper = createContainer();
    modelWrapper.classList.add("a1r-editor-field-wrapper");
    if (allowModelSelect) {
        const selector = createCombo();
        selector.classList.add("a1r-editor-model-selector");
        selector.dataset.role = "model-selector";
        const modelsByCategory = await fetchAllModelsFromAPI();
        const allModels = [];
        for (const [category, modelsMap] of modelsByCategory) {
            const folderEntry = Object.entries(SUPPORTED_FOLDERS).find(([, cat]) => cat === category);
            if (!folderEntry)
                continue;
            const folder = folderEntry[0];
            modelsMap.forEach((metadata, path) => {
                allModels.push({ folder, path, metadata, group: category });
            });
        }
        allModels.sort((a, b) => {
            if (a.group !== b.group)
                return a.group.localeCompare(b.group);
            return a.metadata.getRelativePath().localeCompare(b.metadata.getRelativePath());
        });
        const placeholderOpt = document.createElement("option");
        placeholderOpt.value = "";
        placeholderOpt.textContent = "-- Select Model --";
        placeholderOpt.disabled = true;
        selector.appendChild(placeholderOpt);
        for (const item of allModels) {
            const option = document.createElement("option");
            option.value = item.path;
            option.textContent = `[${item.group}] ${item.metadata.getRelativePath()}`;
            option._folder = item.folder;
            selector.appendChild(option);
        }
        selector.selectedIndex = 0;
        selector.addEventListener("change", async () => {
            const selected = selector.selectedOptions[0];
            if (!selected)
                return;
            currentFilename = selected.value;
            currentFolder = selected._folder || "";
            await reloadPreviews();
        });
        modelWrapper.appendChild(selector);
    }
    else {
        const display = document.createElement("div");
        display.className = "a1r-editor-model-display";
        const metadata = new ModelMetadata(currentFilename);
        display.textContent = metadata.getDisplayName();
        display.title = currentFilename;
        modelWrapper.appendChild(display);
    }
    modelRow.appendChild(modelLabel);
    modelRow.appendChild(modelWrapper);
    modelSection.appendChild(modelRow);
    content.appendChild(modelSection);
    const uploadSection = document.createElement("div");
    uploadSection.className = "a1r-pm-upload-section";
    const dropZone = document.createElement("div");
    dropZone.className = "a1r-pm-dropzone";
    const dropLabel = document.createElement("div");
    dropLabel.className = "a1r-pm-dropzone-label";
    dropLabel.textContent = "Drop images here or click to upload";
    const dropSub = document.createElement("div");
    dropSub.className = "a1r-pm-dropzone-sub";
    dropSub.textContent = `Supported: PNG, JPG, WebP, GIF, BMP (max ${MAX_PREVIEW_IMAGES} images)`;
    dropZone.appendChild(dropLabel);
    dropZone.appendChild(dropSub);
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp,image/gif,image/bmp";
    fileInput.multiple = true;
    fileInput.style.display = "none";
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("a1r-pm-dropzone--hover");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("a1r-pm-dropzone--hover"));
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("a1r-pm-dropzone--hover");
        const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
        if (files.length > 0)
            handleFileUpload(files);
    });
    fileInput.addEventListener("change", () => {
        const files = Array.from(fileInput.files || []);
        if (files.length > 0)
            handleFileUpload(files);
        fileInput.value = "";
    });
    uploadSection.appendChild(dropZone);
    uploadSection.appendChild(fileInput);
    const thumbSection = document.createElement("div");
    thumbSection.className = "a1r-pm-thumb-section";
    const thumbGrid = document.createElement("div");
    thumbGrid.className = "a1r-pm-thumb-grid";
    thumbSection.appendChild(thumbGrid);
    content.appendChild(thumbSection);
    content.appendChild(uploadSection);
    function exitSelectMode() {
        if (!selectMode)
            return;
        selectMode = false;
        selectedItems.clear();
        updateRemoveButton();
        thumbElements.forEach((el) => el.classList.remove("a1r-pm-thumb--selected"));
    }
    function updateRemoveButton() {
        if (!removeButton)
            return;
        removeButton.style.display = selectMode && selectedItems.size > 0 ? "flex" : "none";
    }
    async function reloadPreviews() {
        exitSelectMode();
        if (!currentFolder || !currentFilename) {
            previewUrls = [];
            renderThumbs();
            return;
        }
        previewUrls = await fetchPreviewUrls(currentFolder, currentFilename);
        renderThumbs();
    }
    function renderThumbs() {
        thumbGrid.innerHTML = "";
        thumbElements.forEach((el) => el._cleanup?.());
        thumbElements.clear();
        if (!previewUrls.length) {
            const empty = document.createElement("div");
            empty.className = "a1r-pm-thumb-empty";
            empty.textContent = "No preview images";
            thumbGrid.appendChild(empty);
            return;
        }
        for (let i = 0; i < previewUrls.length; i++) {
            const url = previewUrls[i];
            const wrapper = document.createElement("div");
            wrapper.className = "a1r-pm-thumb";
            const img = document.createElement("img");
            img.className = "a1r-pm-thumb-img";
            img.src = url;
            img.draggable = false;
            const indexBadge = document.createElement("div");
            indexBadge.className = "a1r-pm-thumb-badge";
            indexBadge.textContent = String(i);
            wrapper.appendChild(img);
            wrapper.appendChild(indexBadge);
            thumbElements.set(i, wrapper);
            let longPressTimer = null;
            let isLongPress = false;
            const LONG_PRESS_MS = 500;
            const cancelLongPress = () => {
                if (longPressTimer !== null) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            };
            wrapper.addEventListener("pointerdown", (e) => {
                if (e.button !== 0)
                    return;
                isLongPress = false;
                longPressTimer = window.setTimeout(() => {
                    isLongPress = true;
                    longPressTimer = null;
                    if (!selectMode)
                        selectMode = true;
                    selectedItems.add(i);
                    wrapper.classList.add("a1r-pm-thumb--selected");
                    updateRemoveButton();
                }, LONG_PRESS_MS);
            });
            wrapper.addEventListener("pointerup", cancelLongPress);
            wrapper.addEventListener("pointercancel", cancelLongPress);
            wrapper.addEventListener("pointermove", (e) => {
                if (longPressTimer !== null && (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3)) {
                    cancelLongPress();
                }
            });
            wrapper.addEventListener("click", () => {
                if (isLongPress)
                    return;
                if (selectMode) {
                    if (selectedItems.has(i)) {
                        selectedItems.delete(i);
                        wrapper.classList.remove("a1r-pm-thumb--selected");
                    }
                    else {
                        selectedItems.add(i);
                        wrapper.classList.add("a1r-pm-thumb--selected");
                    }
                    updateRemoveButton();
                    if (selectedItems.size === 0)
                        exitSelectMode();
                    return;
                }
                openLightbox(previewUrls, i);
            });
            wrapper._cleanup = () => cancelLongPress();
            thumbGrid.appendChild(wrapper);
        }
    }
    async function handleFileUpload(files) {
        if (!currentFolder || !currentFilename) {
            showToast("Please select a model first", "error");
            return;
        }
        if (previewUrls.length >= MAX_PREVIEW_IMAGES) {
            showToast(`Maximum ${MAX_PREVIEW_IMAGES} preview images allowed`, "error");
            return;
        }
        const remaining = MAX_PREVIEW_IMAGES - previewUrls.length;
        const toUpload = files.slice(0, remaining);
        dropZone.classList.add("a1r-pm-dropzone--uploading");
        dropLabel.textContent = "Uploading...";
        const urls = await uploadPreviewImages(currentFolder, currentFilename, toUpload);
        dropZone.classList.remove("a1r-pm-dropzone--uploading");
        dropLabel.textContent = "Drop images here or click to upload";
        if (urls.length > 0) {
            dirty = true;
            notifyModelPreviewUpdated(currentFolder, currentFilename);
            showToast(`Uploaded ${urls.length} image(s)`, "success");
            await reloadPreviews();
        }
    }
    async function deleteSelected() {
        if (selectedItems.size === 0)
            return;
        if (!currentFolder || !currentFilename)
            return;
        const names = Array.from(selectedItems)
            .sort((a, b) => a - b)
            .map((idx) => imageNameFromUrl(previewUrls[idx]))
            .filter(Boolean);
        if (!names.length)
            return;
        if (!confirm(`Delete ${names.length} preview image(s)?`))
            return;
        const ok = await deletePreviewImages(currentFolder, currentFilename, names);
        if (ok) {
            dirty = true;
            notifyModelPreviewUpdated(currentFolder, currentFilename);
            showToast(`Deleted ${names.length} image(s)`, "success");
            await reloadPreviews();
        }
        else {
            showToast("Failed to delete images", "error");
        }
    }
    const title = allowModelSelect ? "Add Model Previews" : "Edit Model Previews";
    const builder = new DialogBuilder(DIALOG_TYPE.CUSTOM)
        .setTitle(title)
        .setContent(content)
        .setCloseOnOverlayClick(true)
        .setCloseOnEsc(true)
        .setCloseButton(false)
        .setSize("580px", "90vw", "85vh")
        .setAutoFocus(false)
        .addCustomHeaderButton("Remove", "secondary", () => deleteSelected(), {
        dataRole: "remove-selected-btn",
        style: {
            display: "none",
            padding: "6px 14px",
            fontSize: "12px",
            minHeight: "28px",
        },
    })
        .onOpen((dialogElement) => {
        removeButton = dialogElement.querySelector("[data-role='remove-selected-btn']");
        updateRemoveButton();
    });
    if (showManagerButton) {
        builder.addCustomHeaderButton("Open Manager", "secondary", () => {
            showPreviewManager();
        });
    }
    builder
        .addButton("Cancel", "secondary", () => {
        if (dirty)
            showToast("Changes discarded", "info");
        return null;
    })
        .addButton("Save", "secondary", () => {
        exitSelectMode();
        if (dirty) {
            onDone?.();
            showToast("Saved", "success");
        }
        else {
            showToast("Nothing has changed", "info");
        }
        return true;
    })
        .addButton("Apply", "secondary", () => {
        exitSelectMode();
        if (dirty) {
            onDone?.();
            dirty = false;
            showToast("Applied", "success");
        }
        else {
            showToast("Nothing has changed", "info");
        }
    }, { closeAfterClick: false });
    builder.onClose(() => {
        exitSelectMode();
        onClose?.();
    });
    const dialogPromise = builder.open();
    if (currentFolder && currentFilename) {
        await reloadPreviews();
    }
    return dialogPromise;
}
