import { app } from "/scripts/app.js";
import { MODEL_PREVIEW_UPDATED_EVENT, createModelPreviewTooltip } from "../helper/popover.js";
import { showPreviewEditor } from "../helper/popover_editor.js";
import { getTagsDB, isConfigReady, initConfig, saveFilteredConfig } from "../data/config_model.js";
import { initGlobalThemeCSSVar, injectCSS } from "../theme/themeWatcher.js";
const MODEL_WIDGET_MAP = {
    CheckpointLoaderSimple: { widget: "ckpt_name", folder: "checkpoints" },
    LoraLoader: { widget: "lora_name", folder: "loras" },
};
const preview = createModelPreviewTooltip();
function cfgFromNode(node) {
    if (!node)
        return null;
    const cfg = MODEL_WIDGET_MAP[node.comfyClass ?? node.type];
    return cfg ? { folder: cfg.folder } : null;
}
function getNodeContext(fromEl) {
    const canvas = app.canvas;
    const canvasNode = canvas?.selected_nodes
        ? Object.values(canvas.selected_nodes)[0]
        : canvas?.current_node ?? canvas?.node_over ?? null;
    const canvasCfg = cfgFromNode(canvasNode);
    if (canvasCfg)
        return canvasCfg;
    const anchor = fromEl ?? document.querySelector(".p-select-open");
    const nodeEl = anchor?.closest?.("[data-node-id]");
    const nodeId = nodeEl?.dataset?.nodeId;
    if (nodeId) {
        const gNode = app.graph.getNodeById(parseInt(nodeId));
        const cfg = cfgFromNode(gNode);
        if (cfg)
            return cfg;
    }
    return null;
}
function hookItems(container, selector, getLabel) {
    const ctx = getNodeContext(container);
    if (!ctx)
        return;
    container.querySelectorAll(selector).forEach((el) => {
        const filename = getLabel(el);
        if (!filename)
            return;
        el.addEventListener("mouseenter", async () => {
            const urls = await preview.fetchModelPreviews(ctx.folder, filename);
            let tags = null;
            if (isConfigReady()) {
                const entry = getTagsDB().findByModelName(filename);
                if (entry?.entry?.Tags) {
                    const t = entry.entry.Tags;
                    if (t.positive || t.negative)
                        tags = t;
                }
            }
            if ((urls.length > 0 || tags) && container.isConnected) {
                const saveCb = (positive, negative) => {
                    if (!isConfigReady())
                        return;
                    const db = getTagsDB();
                    const located = db.findByModelName(filename);
                    if (located) {
                        db.update(located.category, located.id, located.entry.Model, { positive, negative });
                    }
                    else {
                        const entry = db.getOrCreate(filename);
                        db.update(entry.category, entry.id, entry.entry.Model, { positive, negative });
                    }
                    saveFilteredConfig();
                };
                const imageClickCb = () => {
                    showPreviewEditor({ folder: ctx.folder, filename });
                };
                preview.show(urls, el, container, tags, saveCb, 2000, imageClickCb);
            }
        });
        el.addEventListener("mouseleave", () => preview.scheduleRemove());
    });
}
const hookContextMenu = (menu) => hookItems(menu, ".litemenu-entry", (el) => el.dataset.value || el.textContent?.trim() || "");
const hookPrimeVue = (overlay) => hookItems(overlay, ".p-select-option", (el) => el.textContent?.trim() || "");
function startObserving() {
    const hooks = [
        ["litecontextmenu", hookContextMenu, false],
        ["p-select-overlay", hookPrimeVue, true],
    ];
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const added of mutation.addedNodes) {
                if (!(added instanceof HTMLElement))
                    continue;
                for (const [cls, hook, defer] of hooks) {
                    const target = added.classList.contains(cls)
                        ? added
                        : added.querySelector(`.${cls}`);
                    if (target instanceof HTMLElement) {
                        defer ? requestAnimationFrame(() => hook(target)) : hook(target);
                    }
                }
            }
            for (const removed of mutation.removedNodes) {
                if (!(removed instanceof HTMLElement))
                    continue;
                if (hooks.some(([cls]) => removed.classList.contains(cls))) {
                    preview.forceRemove();
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
app.registerExtension({
    name: "a1rworkshop.pickpreview",
    async setup() {
        initGlobalThemeCSSVar();
        injectCSS("../../css/a1r-model-preview.css", import.meta.url);
        injectCSS("../../css/a1r-preview-manager.css", import.meta.url);
        await initConfig();
        window.addEventListener(MODEL_PREVIEW_UPDATED_EVENT, () => {
            preview.forceRemove();
        });
        startObserving();
    },
});
