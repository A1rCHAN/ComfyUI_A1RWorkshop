/**
 * ModelPicker — 模型图像选单组件
 *
 * 复刻 ComfyUI Nodes 2.0 Load Image 节点的图像选择面板。
 * 用于拦截 checkpoint / lora 等模型加载节点的 combo 选择。
 *
 * 公开接口：
 *   openModelPicker(options): Promise<string | null>
 */
import { ModelMetadata } from "../data/config_model.js";
const MODEL_PREVIEW_UPDATED_EVENT = "a1r:model-preview-updated";
const WIDGET_TO_FOLDER = {
    ckpt_name: "checkpoints",
    model_name: "checkpoints",
    lora_name: "loras",
    unet_name: "diffusion_models",
    clip_name: "text_encoders",
    vae_name: "vae",
    controlnet_name: "controlnet",
    ipadapter_name: "ipadapter",
    upscale_name: "upscale_models",
};
const FOLDER_TO_CATEGORY = {
    checkpoints: "Checkpoints",
    loras: "LoRAs",
    diffusion_models: "UNets",
    text_encoders: "CLIPs",
    vae: "VAEs",
    controlnet: "ControlNets",
    ipadapter: "IPAdapters",
    upscale_models: "Upscalers",
};
/* ======================================== */
/* === 工具函数                         === */
/* ======================================== */
function inferFolder(widgetName) {
    const lower = widgetName.toLowerCase();
    if (WIDGET_TO_FOLDER[lower])
        return WIDGET_TO_FOLDER[lower];
    if (lower.includes("ckpt") || lower.includes("checkpoint"))
        return "checkpoints";
    if (lower.includes("lora") || lower.includes("lycoris"))
        return "loras";
    if (lower.includes("unet"))
        return "diffusion_models";
    if (lower.includes("vae"))
        return "vae";
    if (lower.includes("clip"))
        return "text_encoders";
    if (lower.includes("controlnet"))
        return "controlnet";
    if (lower.includes("ipadapter"))
        return "ipadapter";
    if (lower.includes("upscale"))
        return "upscale_models";
    return "checkpoints";
}
function buildPreviewUrl(folder, pathIndex, filename) {
    return `/experiment/models/preview/${encodeURIComponent(folder)}/${pathIndex}/${encodeURIComponent(filename)}`;
}
function extractDisplayName(fullPath) {
    return new ModelMetadata(fullPath).getDisplayName();
}
/** 缓存：folder → Map<modelName, BackendModelFile> */
const _modelFileCache = new Map();
async function loadModelFiles(folder) {
    if (_modelFileCache.has(folder))
        return _modelFileCache.get(folder);
    try {
        const res = await fetch(`/experiment/models/${encodeURIComponent(folder)}`);
        if (!res.ok)
            return new Map();
        const files = await res.json();
        const map = new Map();
        for (const f of files) {
            map.set(f.name, f);
        }
        _modelFileCache.set(folder, map);
        return map;
    }
    catch {
        return new Map();
    }
}
/** 预览图可达性缓存 */
const _previewReachable = new Map();
let _previewInvalidationListenerInstalled = false;
let _activeRefreshItems = null;
function clearPreviewReachableCache(folder) {
    if (!folder) {
        _previewReachable.clear();
        return;
    }
    const marker = `/${encodeURIComponent(folder)}/`;
    for (const key of Array.from(_previewReachable.keys())) {
        if (key.includes(marker)) {
            _previewReachable.delete(key);
        }
    }
}
function installPreviewInvalidationListener() {
    if (_previewInvalidationListenerInstalled || typeof window === "undefined")
        return;
    _previewInvalidationListenerInstalled = true;
    window.addEventListener(MODEL_PREVIEW_UPDATED_EVENT, (event) => {
        const detail = event.detail;
        clearPreviewReachableCache(detail?.folder);
        if (_activeRefreshItems) {
            void _activeRefreshItems();
        }
    });
}
async function checkPreviewExists(url) {
    if (_previewReachable.has(url))
        return _previewReachable.get(url);
    try {
        const res = await fetch(url, { method: "HEAD" });
        const ok = res.ok;
        _previewReachable.set(url, ok);
        return ok;
    }
    catch {
        _previewReachable.set(url, false);
        return false;
    }
}
async function buildPickerItems(values, widgetName) {
    const folder = inferFolder(widgetName);
    const backendFiles = await loadModelFiles(folder);
    const items = [];
    // 批量检测预览图
    const urlChecks = [];
    for (const value of values) {
        const backendFile = backendFiles.get(value);
        const pathIndex = backendFile?.pathIndex ?? 0;
        const previewUrl = buildPreviewUrl(folder, pathIndex, value);
        const metadata = new ModelMetadata(value);
        const item = {
            value,
            displayName: extractDisplayName(value),
            category: FOLDER_TO_CATEGORY[folder] || folder,
            previewUrl: null,
            folder,
            pathIndex,
        };
        items.push(item);
        urlChecks.push({ idx: items.length - 1, url: previewUrl });
    }
    // 并发检查预览图是否可用（限并发 20）
    const BATCH = 20;
    for (let i = 0; i < urlChecks.length; i += BATCH) {
        const batch = urlChecks.slice(i, i + BATCH);
        const results = await Promise.all(batch.map((c) => checkPreviewExists(c.url)));
        for (let j = 0; j < batch.length; j++) {
            if (results[j]) {
                items[batch[j].idx].previewUrl = batch[j].url;
            }
        }
    }
    return items;
}
/* ======================================== */
/* === 多文件夹支持（跨类型选单）       === */
/* ======================================== */
/**
 * 当 combo 混合多种来源时（例如将来扩展），按文件夹分组。
 * 目前每个 combo 只对应一种 folder，但预留多 folder 支持。
 */
async function buildMultiFolderItems(values, widgetName) {
    const items = await buildPickerItems(values, widgetName);
    // 只保留有预览图的分类
    const categorySet = new Set();
    for (const item of items) {
        if (item.previewUrl) {
            categorySet.add(item.category);
        }
    }
    const categories = Array.from(categorySet).sort();
    return { items, categories };
}
/* ======================================== */
/* === SVG 图标                         === */
/* ======================================== */
const ICON_SEARCH = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const ICON_SORT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5h10"/><path d="M11 9h7"/><path d="M11 13h4"/><path d="M3 17l3 3 3-3"/><path d="M6 18V4"/></svg>`;
const ICON_GRID = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;
const ICON_LIST = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
/* ======================================== */
/* === DOM 构建                         === */
/* ======================================== */
function createPickerPanel() {
    const el = document.createElement("div");
    el.className = "a1r-picker-panel";
    return el;
}
function createTabBar(categories, activeTab, onTabClick) {
    const bar = document.createElement("div");
    bar.className = "a1r-picker-tabs";
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "a1r-picker-tab" + (activeTab === "All" ? " a1r-picker-tab--active" : "");
    allBtn.textContent = "All";
    allBtn.addEventListener("click", () => onTabClick("All"));
    bar.appendChild(allBtn);
    for (const cat of categories) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "a1r-picker-tab" + (activeTab === cat ? " a1r-picker-tab--active" : "");
        btn.textContent = cat;
        btn.addEventListener("click", () => onTabClick(cat));
        bar.appendChild(btn);
    }
    return bar;
}
function createToolbar(state) {
    const bar = document.createElement("div");
    bar.className = "a1r-picker-toolbar";
    // 搜索框
    const searchWrapper = document.createElement("div");
    searchWrapper.className = "a1r-picker-search-wrapper";
    const searchIcon = document.createElement("span");
    searchIcon.className = "a1r-picker-search-icon";
    searchIcon.innerHTML = ICON_SEARCH;
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "a1r-picker-search";
    searchInput.placeholder = "Search ...";
    searchInput.value = state.searchQuery;
    searchInput.addEventListener("input", () => {
        state.searchQuery = searchInput.value;
        state.render();
    });
    searchWrapper.appendChild(searchIcon);
    searchWrapper.appendChild(searchInput);
    bar.appendChild(searchWrapper);
    // 排序按钮
    const sortBtn = document.createElement("button");
    sortBtn.type = "button";
    sortBtn.className = "a1r-picker-toolbar-btn";
    sortBtn.innerHTML = ICON_SORT;
    sortBtn.title = "Toggle sort order";
    sortBtn.addEventListener("click", () => {
        state.sortOrder = state.sortOrder === "name-asc" ? "name-desc" : "name-asc";
        state.render();
    });
    bar.appendChild(sortBtn);
    // 列表视图按钮
    const listBtn = document.createElement("button");
    listBtn.type = "button";
    listBtn.className = "a1r-picker-toolbar-btn" + (state.viewMode === "list" ? " a1r-picker-toolbar-btn--active" : "");
    listBtn.innerHTML = ICON_LIST;
    listBtn.title = "List view";
    listBtn.addEventListener("click", () => {
        state.viewMode = "list";
        state.render();
    });
    bar.appendChild(listBtn);
    // 网格视图按钮
    const gridBtn = document.createElement("button");
    gridBtn.type = "button";
    gridBtn.className = "a1r-picker-toolbar-btn" + (state.viewMode === "grid" ? " a1r-picker-toolbar-btn--active" : "");
    gridBtn.innerHTML = ICON_GRID;
    gridBtn.title = "Grid view";
    gridBtn.addEventListener("click", () => {
        state.viewMode = "grid";
        state.render();
    });
    bar.appendChild(gridBtn);
    return bar;
}
function createGridItem(item, isSelected, onClick) {
    const card = document.createElement("div");
    card.className = "a1r-picker-card" + (isSelected ? " a1r-picker-card--selected" : "");
    card.addEventListener("click", onClick);
    const imageBox = document.createElement("div");
    imageBox.className = "a1r-picker-card-image";
    if (item.previewUrl) {
        const img = document.createElement("img");
        img.src = item.previewUrl;
        img.alt = item.displayName;
        img.loading = "lazy";
        img.addEventListener("error", () => {
            img.remove();
            const placeholder = document.createElement("div");
            placeholder.className = "a1r-picker-card-placeholder";
            placeholder.textContent = item.displayName.charAt(0).toUpperCase();
            imageBox.appendChild(placeholder);
        });
        imageBox.appendChild(img);
    }
    else {
        const placeholder = document.createElement("div");
        placeholder.className = "a1r-picker-card-placeholder";
        placeholder.textContent = item.displayName.charAt(0).toUpperCase();
        imageBox.appendChild(placeholder);
    }
    const name = document.createElement("div");
    name.className = "a1r-picker-card-name";
    name.textContent = item.displayName;
    name.title = item.value;
    card.appendChild(imageBox);
    card.appendChild(name);
    return card;
}
function createListItem(item, isSelected, onClick) {
    const row = document.createElement("div");
    row.className = "a1r-picker-row" + (isSelected ? " a1r-picker-row--selected" : "");
    row.addEventListener("click", onClick);
    const thumbBox = document.createElement("div");
    thumbBox.className = "a1r-picker-row-thumb";
    if (item.previewUrl) {
        const img = document.createElement("img");
        img.src = item.previewUrl;
        img.alt = item.displayName;
        img.loading = "lazy";
        img.addEventListener("error", () => {
            img.remove();
            const ph = document.createElement("div");
            ph.className = "a1r-picker-row-placeholder";
            ph.textContent = item.displayName.charAt(0).toUpperCase();
            thumbBox.appendChild(ph);
        });
        thumbBox.appendChild(img);
    }
    else {
        const ph = document.createElement("div");
        ph.className = "a1r-picker-row-placeholder";
        ph.textContent = item.displayName.charAt(0).toUpperCase();
        thumbBox.appendChild(ph);
    }
    const nameEl = document.createElement("div");
    nameEl.className = "a1r-picker-row-name";
    nameEl.textContent = item.displayName;
    nameEl.title = item.value;
    row.appendChild(thumbBox);
    row.appendChild(nameEl);
    return row;
}
function filterAndSort(state) {
    let result = [...state.items];
    // 分类筛选
    if (state.activeTab !== "All") {
        result = result.filter((item) => item.category === state.activeTab);
    }
    // 搜索
    if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase().trim();
        result = result.filter((item) => item.displayName.toLowerCase().includes(q) ||
            item.value.toLowerCase().includes(q));
    }
    // 排序
    result.sort((a, b) => {
        const cmp = a.displayName.localeCompare(b.displayName);
        return state.sortOrder === "name-asc" ? cmp : -cmp;
    });
    return result;
}
function renderContent(state) {
    const contentEl = state.contentEl;
    if (!contentEl)
        return;
    contentEl.innerHTML = "";
    const filtered = filterAndSort(state);
    if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "a1r-picker-empty";
        empty.textContent = state.searchQuery ? "No matching models" : "No models available";
        contentEl.appendChild(empty);
        return;
    }
    if (state.viewMode === "grid") {
        const grid = document.createElement("div");
        grid.className = "a1r-picker-grid";
        for (const item of filtered) {
            const isSelected = item.value === state.selectedValue;
            const card = createGridItem(item, isSelected, () => {
                state.selectedValue = item.value;
                state.onSelect?.(item.value);
                state.resolve?.(item.value);
                closePanel(state);
            });
            grid.appendChild(card);
        }
        contentEl.appendChild(grid);
    }
    else {
        const list = document.createElement("div");
        list.className = "a1r-picker-list";
        for (const item of filtered) {
            const isSelected = item.value === state.selectedValue;
            const row = createListItem(item, isSelected, () => {
                state.selectedValue = item.value;
                state.onSelect?.(item.value);
                state.resolve?.(item.value);
                closePanel(state);
            });
            list.appendChild(row);
        }
        contentEl.appendChild(list);
    }
}
function renderPanel(state) {
    const panel = state.panelEl;
    if (!panel)
        return;
    panel.innerHTML = "";
    // 标签栏（只有存在带预览图的分类才显示）
    if (state.categories.length > 0) {
        const tabs = createTabBar(state.categories, state.activeTab, (tab) => {
            state.activeTab = tab;
            renderPanel(state);
        });
        panel.appendChild(tabs);
    }
    // 工具栏
    const toolbar = createToolbar(state);
    panel.appendChild(toolbar);
    // 内容区
    const content = document.createElement("div");
    content.className = "a1r-picker-content";
    state.contentEl = content;
    panel.appendChild(content);
    renderContent(state);
    // 搜索框自动聚焦
    const search = panel.querySelector(".a1r-picker-search");
    search?.focus();
}
/* ======================================== */
/* === 打开 / 关闭                      === */
/* ======================================== */
let _activeOverlay = null;
let _keydownHandler = null;
function closePanel(state) {
    if (_keydownHandler) {
        window.removeEventListener("keydown", _keydownHandler);
        _keydownHandler = null;
    }
    if (_activeOverlay) {
        _activeOverlay.remove();
        _activeOverlay = null;
    }
    state.panelEl = null;
    state.contentEl = null;
    _activeRefreshItems = null;
}
/**
 * 打开模型图像选单。
 *
 * @returns 用户选择的 combo 值，取消返回 null。
 */
export async function openModelPicker(options) {
    installPreviewInvalidationListener();
    // 若已有打开的面板则先关闭
    if (_activeOverlay) {
        _activeOverlay.remove();
        _activeOverlay = null;
    }
    const state = {
        items: [],
        categories: [],
        activeTab: "All",
        searchQuery: "",
        viewMode: "grid",
        sortOrder: "name-asc",
        selectedValue: options.currentValue || null,
        contentEl: null,
        panelEl: null,
        resolve: null,
        onSelect: options.onSelect || null,
        render: () => renderPanel(state),
    };
    // overlay
    const overlay = document.createElement("div");
    overlay.className = "a1r-overlay";
    _activeOverlay = overlay;
    // panel
    const panel = createPickerPanel();
    state.panelEl = panel;
    // 显示加载指示
    const loadingEl = document.createElement("div");
    loadingEl.className = "a1r-picker-loading";
    loadingEl.innerHTML = `<div class="a1r-picker-spinner"></div><span>Loading models...</span>`;
    panel.appendChild(loadingEl);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    // overlay 点击关闭
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            state.resolve?.(null);
            closePanel(state);
        }
    });
    // ESC 关闭
    _keydownHandler = (e) => {
        if (e.key === "Escape") {
            state.resolve?.(null);
            closePanel(state);
        }
    };
    window.addEventListener("keydown", _keydownHandler);
    // 返回 Promise
    const result = new Promise((resolve) => {
        state.resolve = resolve;
    });
    // 异步加载数据
    const refreshItems = async () => {
        const { items, categories } = await buildMultiFolderItems(options.values, options.widgetName);
        state.items = items;
        state.categories = categories;
        if (state.panelEl) {
            renderPanel(state);
        }
    };
    _activeRefreshItems = refreshItems;
    try {
        await refreshItems();
    }
    catch (err) {
        console.error("[ModelPicker] Failed to load models:", err);
        panel.innerHTML = "";
        const errEl = document.createElement("div");
        errEl.className = "a1r-picker-empty";
        errEl.textContent = "Failed to load models";
        panel.appendChild(errEl);
    }
    return result;
}
