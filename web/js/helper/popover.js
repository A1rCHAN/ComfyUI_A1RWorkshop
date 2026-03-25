import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import { hexToRGBA } from "../theme/themeUtils.js";
import { resolveThemeToken } from "../theme/themeWatcher.js";
const CACHE_API = "/api/a1rworkshop";
async function cacheImages(seed, images) {
    const resp = await api.fetchApi(`${CACHE_API}/cache_images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, images }),
    });
    if (!resp.ok)
        return [];
    const data = await resp.json();
    return data.cached.map((name) => api.apiURL(`${CACHE_API}/cache/${name}`));
}
export async function clearImageCache() {
    await api.fetchApi(`${CACHE_API}/clear_cache`, { method: "POST" });
}
export async function deleteCachedImages(seed) {
    await api.fetchApi(`${CACHE_API}/delete_seed_cache`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed }),
    });
}
function collectImageRefs() {
    const imageNodes = [];
    const fallbackNodes = [];
    for (const node of app.graph._nodes) {
        if (node.mode === 2 || node.mode === 4)
            continue;
        const nodeId = String(node.id);
        const output = app.nodeOutputs?.[nodeId];
        if (!output?.images?.length)
            continue;
        const imgs = output.images;
        const hasImagesInput = node.inputs?.some((inp) => inp.name === "images");
        if (hasImagesInput) {
            imageNodes.push({ id: node.id, images: imgs });
        }
        else if (node.comfyClass === "SaveImage" || node.comfyClass === "PreviewImage") {
            fallbackNodes.push({ id: node.id, images: imgs });
        }
    }
    const sources = imageNodes.length > 0 ? imageNodes : fallbackNodes;
    sources.sort((a, b) => a.id - b.id);
    const refs = [];
    for (const src of sources) {
        for (const img of src.images) {
            refs.push({
                filename: img.filename || "",
                subfolder: img.subfolder || "",
                type: img.type || "output",
            });
        }
    }
    return refs;
}
export async function snapshotImagesForSeed(node, seed) {
    if (node.mode === 2 || node.mode === 4)
        return;
    const refs = collectImageRefs();
    if (refs.length === 0)
        return;
    const urls = await cacheImages(seed, refs);
    if (urls.length > 0) {
        node.seedImageMap.set(seed, urls);
    }
}
let lightbox = null;
let lbIndex = 0;
let lbUrls = [];
let lbOnClose = null;
export function isLightboxOpen() {
    return lightbox !== null;
}
function closeLightbox() {
    const cb = lbOnClose;
    if (lightbox) {
        lightbox.remove();
        lightbox = null;
    }
    lbUrls = [];
    lbIndex = 0;
    lbOnClose = null;
    if (cb)
        cb();
}
function showLightboxAt(index) {
    if (!lightbox || lbUrls.length === 0)
        return;
    lbIndex = ((index % lbUrls.length) + lbUrls.length) % lbUrls.length;
    const img = lightbox.querySelector(".a1r-lightbox-img");
    if (img)
        img.src = lbUrls[lbIndex];
    const counter = lightbox.querySelector(".a1r-lightbox-counter");
    if (counter) {
        counter.textContent = lbUrls.length > 1 ? `${lbIndex + 1} / ${lbUrls.length}` : "";
    }
    const arrows = lightbox.querySelectorAll(".a1r-lightbox-arrow");
    arrows.forEach(a => a.style.display = lbUrls.length > 1 ? "" : "none");
}
export function openLightbox(urls, startIndex = 0, onClose) {
    closeLightbox();
    if (!urls.length)
        return;
    lbUrls = urls;
    lbOnClose = onClose ?? null;
    const token = resolveThemeToken();
    lightbox = document.createElement("div");
    lightbox.className = "a1r-lightbox-overlay";
    lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox)
            closeLightbox();
    });
    const arrowLeft = document.createElement("div");
    arrowLeft.className = "a1r-lightbox-arrow a1r-lightbox-arrow--left";
    arrowLeft.textContent = "\u276E";
    arrowLeft.addEventListener("click", (e) => { e.stopPropagation(); showLightboxAt(lbIndex - 1); });
    lightbox.appendChild(arrowLeft);
    const img = document.createElement("img");
    img.className = "a1r-lightbox-img";
    img.addEventListener("click", (e) => e.stopPropagation());
    lightbox.appendChild(img);
    const arrowRight = document.createElement("div");
    arrowRight.className = "a1r-lightbox-arrow a1r-lightbox-arrow--right";
    arrowRight.textContent = "\u276F";
    arrowRight.addEventListener("click", (e) => { e.stopPropagation(); showLightboxAt(lbIndex + 1); });
    lightbox.appendChild(arrowRight);
    const counter = document.createElement("div");
    counter.className = "a1r-lightbox-counter";
    lightbox.appendChild(counter);
    const closeBtn = document.createElement("div");
    closeBtn.className = "a1r-lightbox-close";
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
    lightbox.appendChild(closeBtn);
    lightbox.style.boxShadow = `0 0 80px ${hexToRGBA(token.color.shadow, 0.6)}`;
    document.body.appendChild(lightbox);
    showLightboxAt(startIndex);
    lightbox.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (e.deltaY > 0)
            showLightboxAt(lbIndex + 1);
        else if (e.deltaY < 0)
            showLightboxAt(lbIndex - 1);
    }, { passive: false });
    const onKey = (e) => {
        if (!lightbox) {
            document.removeEventListener("keydown", onKey);
            return;
        }
        if (e.key === "Escape")
            closeLightbox();
        else if (e.key === "ArrowLeft")
            showLightboxAt(lbIndex - 1);
        else if (e.key === "ArrowRight")
            showLightboxAt(lbIndex + 1);
    };
    document.addEventListener("keydown", onKey);
}
function positionTooltip(el, anchorEl, referenceEl) {
    const refRect = referenceEl.getBoundingClientRect();
    const tipRect = el.getBoundingClientRect();
    let left = refRect.right + 6;
    if (left + tipRect.width > window.innerWidth - 8)
        left = refRect.left - tipRect.width - 6;
    if (left < 8)
        left = 8;
    const itemRect = anchorEl.getBoundingClientRect();
    let top = itemRect.top - tipRect.height * 0.25;
    if (top + tipRect.height > window.innerHeight - 8) {
        top = window.innerHeight - 8 - tipRect.height;
    }
    if (top < 8)
        top = 8;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
}
export function createPreviewTooltip() {
    let tooltip = null;
    let removeTimer = null;
    let pinned = false;
    function cancelRemoveTimer() {
        if (removeTimer !== null) {
            clearTimeout(removeTimer);
            removeTimer = null;
        }
    }
    function remove() {
        cancelRemoveTimer();
        pinned = false;
        if (tooltip) {
            tooltip.remove();
            tooltip = null;
        }
    }
    function scheduleRemove() {
        if (pinned)
            return;
        cancelRemoveTimer();
        removeTimer = setTimeout(() => {
            removeTimer = null;
            remove();
        }, 150);
    }
    function show(urls, anchorEl, popoverEl) {
        remove();
        if (!urls.length)
            return;
        tooltip = document.createElement("div");
        tooltip.className = "a1r-seed-preview";
        tooltip.addEventListener("mouseenter", cancelRemoveTimer);
        tooltip.addEventListener("mouseleave", scheduleRemove);
        const token = resolveThemeToken();
        tooltip.style.boxShadow = `0 6px 20px ${hexToRGBA(token.color.shadow, 0.5)}`;
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const img = document.createElement("img");
            img.className = "a1r-seed-preview-img";
            img.src = url;
            const idx = i;
            img.style.cursor = "pointer";
            img.addEventListener("click", (e) => {
                e.stopPropagation();
                cancelRemoveTimer();
                pinned = true;
                openLightbox(urls, idx);
            });
            tooltip.appendChild(img);
        }
        document.body.appendChild(tooltip);
        positionTooltip(tooltip, anchorEl, popoverEl);
    }
    return {
        get element() { return tooltip; },
        show,
        remove,
        scheduleRemove,
    };
}
const MODEL_PREVIEW_API = "/api/a1rworkshop";
export const MODEL_PREVIEW_UPDATED_EVENT = "a1r:model-preview-updated";
const previewCache = new Map();
function modelPreviewCacheKey(folder, filename) {
    return `${folder}::${filename}`;
}
export function invalidateModelPreviewCache(folder, filename) {
    if (!folder) {
        previewCache.clear();
        return;
    }
    if (filename) {
        previewCache.delete(modelPreviewCacheKey(folder, filename));
        return;
    }
    const prefix = `${folder}::`;
    for (const key of Array.from(previewCache.keys())) {
        if (key.startsWith(prefix)) {
            previewCache.delete(key);
        }
    }
}
export function notifyModelPreviewUpdated(folder, filename) {
    invalidateModelPreviewCache(folder, filename);
    if (typeof window === "undefined")
        return;
    window.dispatchEvent(new CustomEvent(MODEL_PREVIEW_UPDATED_EVENT, {
        detail: { folder, filename },
    }));
}
async function fetchModelPreviews(folder, filename) {
    const key = modelPreviewCacheKey(folder, filename);
    if (previewCache.has(key))
        return previewCache.get(key);
    try {
        const resp = await api.fetchApi(`${MODEL_PREVIEW_API}/model_previews?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(filename)}`);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        const urls = data.images || [];
        if (urls.length > 0)
            previewCache.set(key, urls);
        return urls;
    }
    catch {
        return [];
    }
}
export function createModelPreviewTooltip() {
    let tooltip = null;
    let imgA = null;
    let imgB = null;
    let cycleTimer = null;
    let removeTimer = null;
    let currentIndex = 0;
    let currentUrls = [];
    let showingA = true;
    let editing = false;
    let outsideHandler = null;
    function stopCycle() {
        if (cycleTimer !== null) {
            clearInterval(cycleTimer);
            cycleTimer = null;
        }
    }
    function cancelRemoveTimer() {
        if (removeTimer !== null) {
            clearTimeout(removeTimer);
            removeTimer = null;
        }
    }
    function removeOutsideClickHandler() {
        if (outsideHandler) {
            document.removeEventListener("pointerdown", outsideHandler, true);
            outsideHandler = null;
        }
    }
    function remove() {
        if (editing)
            return;
        cancelRemoveTimer();
        stopCycle();
        if (tooltip) {
            tooltip.remove();
            tooltip = null;
        }
        imgA = null;
        imgB = null;
        currentUrls = [];
        currentIndex = 0;
        showingA = true;
    }
    function forceRemove() {
        if (editing)
            return;
        teardown();
    }
    function teardown() {
        editing = false;
        removeOutsideClickHandler();
        cancelRemoveTimer();
        stopCycle();
        if (tooltip) {
            tooltip.remove();
            tooltip = null;
        }
        imgA = null;
        imgB = null;
        currentUrls = [];
        currentIndex = 0;
        showingA = true;
    }
    function installOutsideClickHandler() {
        removeOutsideClickHandler();
        outsideHandler = (ev) => {
            if (tooltip && !tooltip.contains(ev.target)) {
                teardown();
            }
        };
        document.addEventListener("pointerdown", outsideHandler, true);
    }
    function scheduleRemove() {
        if (editing)
            return;
        cancelRemoveTimer();
        removeTimer = setTimeout(() => {
            removeTimer = null;
            remove();
        }, 150);
    }
    function crossfadeTo(index) {
        if (!imgA || !imgB || currentUrls.length === 0)
            return;
        currentIndex = index % currentUrls.length;
        const nextUrl = currentUrls[currentIndex];
        const backImg = showingA ? imgB : imgA;
        const frontImg = showingA ? imgA : imgB;
        backImg.src = nextUrl;
        backImg.style.opacity = "1";
        frontImg.style.opacity = "0";
        showingA = !showingA;
    }
    function show(urls, anchorEl, referenceEl, tags, onSaveTags, intervalMs = 2000, onImageClick) {
        if (editing)
            return;
        teardown();
        const hasTags = tags && (tags.positive || tags.negative);
        if (!urls.length && !hasTags)
            return;
        currentUrls = urls;
        const token = resolveThemeToken();
        tooltip = document.createElement("div");
        tooltip.className = "a1r-model-preview";
        tooltip.addEventListener("mouseenter", cancelRemoveTimer);
        tooltip.addEventListener("mouseleave", scheduleRemove);
        for (const evt of ["mousedown", "mouseup", "click", "pointerdown", "pointerup"]) {
            tooltip.addEventListener(evt, (ev) => ev.stopPropagation());
        }
        if (urls.length > 0) {
            const imgBox = document.createElement("div");
            imgBox.className = "a1r-model-preview-imgbox";
            imgBox.style.boxShadow = `0 6px 20px ${hexToRGBA(token.color.shadow, 0.5)}`;
            const container = document.createElement("div");
            container.className = "a1r-model-preview-container";
            imgA = document.createElement("img");
            imgA.className = "a1r-model-preview-img";
            imgA.src = urls[0];
            imgA.style.opacity = "1";
            imgB = document.createElement("img");
            imgB.className = "a1r-model-preview-img";
            imgB.style.opacity = "0";
            container.appendChild(imgA);
            container.appendChild(imgB);
            imgBox.appendChild(container);
            tooltip.appendChild(imgBox);
            container.style.cursor = "pointer";
            container.addEventListener("click", (e) => {
                e.stopPropagation();
                if (activeCloseEditor) {
                    activeCloseEditor(false);
                    return;
                }
                if (onImageClick) {
                    teardown();
                    onImageClick();
                }
                else {
                    openLightbox(urls, currentIndex);
                }
            });
        }
        let activeCloseEditor = null;
        if (hasTags) {
            const tagsWrapper = document.createElement("div");
            tagsWrapper.className = "a1r-model-preview-tags-wrapper";
            const editState = { positive: tags.positive || "", negative: tags.negative || "" };
            function makeTagSection(type, text) {
                const section = document.createElement("div");
                section.className = "a1r-model-preview-tag-box";
                const label = document.createElement("div");
                label.className = `a1r-model-preview-tags-label a1r-model-preview-tags-label--${type}`;
                label.textContent = type === "positive" ? "Positive" : "Negative";
                const content = document.createElement("div");
                content.className = "a1r-model-preview-tags-content";
                content.textContent = text;
                content.style.cursor = "pointer";
                section.addEventListener("click", (e) => {
                    if (e.target?.closest?.(".a1r-model-preview-tags-content, .a1r-model-preview-tags-editor"))
                        return;
                    e.stopPropagation();
                    if (activeCloseEditor)
                        activeCloseEditor(false);
                });
                content.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (section.querySelector(".a1r-model-preview-tags-editor"))
                        return;
                    if (activeCloseEditor)
                        activeCloseEditor(false);
                    cancelRemoveTimer();
                    editing = true;
                    installOutsideClickHandler();
                    const editor = document.createElement("div");
                    editor.className = "a1r-model-preview-tags-editor";
                    const textarea = document.createElement("textarea");
                    textarea.className = "a1r-model-preview-tags-textarea";
                    textarea.value = editState[type];
                    textarea.rows = 3;
                    textarea.spellcheck = false;
                    function closeEditor(save) {
                        if (save) {
                            editState[type] = textarea.value;
                            content.textContent = textarea.value;
                            if (onSaveTags)
                                onSaveTags(editState.positive, editState.negative);
                        }
                        content.style.display = "";
                        editor.remove();
                        editing = false;
                        if (activeCloseEditor === closeEditor)
                            activeCloseEditor = null;
                        removeOutsideClickHandler();
                    }
                    activeCloseEditor = closeEditor;
                    const btnRow = document.createElement("div");
                    btnRow.className = "a1r-model-preview-tags-btn-row";
                    const confirmBtn = document.createElement("button");
                    confirmBtn.className = "a1r-model-preview-tags-btn a1r-model-preview-tags-btn--confirm";
                    confirmBtn.textContent = "\u2713";
                    confirmBtn.addEventListener("click", (ev) => {
                        ev.stopPropagation();
                        closeEditor(true);
                    });
                    const cancelBtn = document.createElement("button");
                    cancelBtn.className = "a1r-model-preview-tags-btn a1r-model-preview-tags-btn--cancel";
                    cancelBtn.textContent = "\u2717";
                    cancelBtn.addEventListener("click", (ev) => {
                        ev.stopPropagation();
                        closeEditor(false);
                    });
                    textarea.addEventListener("keydown", (ev) => {
                        if (ev.key === "Enter" && !ev.shiftKey) {
                            ev.preventDefault();
                            closeEditor(true);
                        }
                        else if (ev.key === "Escape") {
                            ev.preventDefault();
                            closeEditor(false);
                        }
                    });
                    btnRow.appendChild(confirmBtn);
                    btnRow.appendChild(cancelBtn);
                    editor.appendChild(textarea);
                    editor.appendChild(btnRow);
                    content.style.display = "none";
                    section.appendChild(editor);
                    textarea.focus();
                });
                section.appendChild(label);
                section.appendChild(content);
                return section;
            }
            if (tags.positive)
                tagsWrapper.appendChild(makeTagSection("positive", tags.positive));
            if (tags.negative)
                tagsWrapper.appendChild(makeTagSection("negative", tags.negative));
            tooltip.appendChild(tagsWrapper);
        }
        document.body.appendChild(tooltip);
        positionTooltip(tooltip, anchorEl, referenceEl);
        if (urls.length > 1) {
            currentIndex = 0;
            cycleTimer = setInterval(() => {
                crossfadeTo(currentIndex + 1);
            }, intervalMs);
        }
    }
    return {
        get element() { return tooltip; },
        get isEditing() { return editing; },
        show,
        remove,
        forceRemove,
        scheduleRemove,
        fetchModelPreviews,
    };
}
