// @ts-expect-error ComfyUI 运行时注入模块
import { app } from "/scripts/app.js";
import { MODEL_PREVIEW_UPDATED_EVENT, createModelPreviewTooltip } from "../helper/popover.js";
import { showPreviewEditor } from "../helper/popover_editor.js";
import { getTagsDB, isConfigReady, initConfig, saveFilteredConfig } from "../data/config_model.js";
import { initGlobalThemeCSSVar, injectCSS } from "../theme/themeWatcher.js";
// ========== 配置 ==========
/** 需要挂载预览的节点类型 → { widgetName, folder } */
const MODEL_WIDGET_MAP = {
    CheckpointLoaderSimple: { widget: "ckpt_name", folder: "checkpoints" },
    LoraLoader: { widget: "lora_name", folder: "loras" },
};
// ========== 工具 ==========
const preview = createModelPreviewTooltip();
/** 从 graph node 查找 MODEL_WIDGET_MAP 配置 */
function cfgFromNode(node) {
    if (!node)
        return null;
    const cfg = MODEL_WIDGET_MAP[node.comfyClass ?? node.type];
    return cfg ? { folder: cfg.folder } : null;
}
/**
 * 获取当前操作的模型节点上下文。
 * 1. Canvas 模式：通过 canvas 状态找节点
 * 2. Nodes 2.0 Vue 模式：从 DOM 元素向上追溯 [data-node-id] 容器
 */
function getNodeContext(fromEl) {
    // Canvas 模式
    const canvas = app.canvas;
    const canvasNode = canvas?.selected_nodes
        ? Object.values(canvas.selected_nodes)[0]
        : canvas?.current_node ?? canvas?.node_over ?? null;
    const canvasCfg = cfgFromNode(canvasNode);
    if (canvasCfg)
        return canvasCfg;
    // Nodes 2.0：从 overlay 或其触发元素向上查找 [data-node-id]
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
// ========== 下拉菜单拦截 ==========
/** 为下拉列表项挂载预览悬浮 */
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
            // 查找模型已绑定的标签
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
// ========== MutationObserver 驱动 ==========
function startObserving() {
    /** [CSS class, hook, 是否延迟到下一帧] */
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
// ========== 注册扩展 ==========
app.registerExtension({
    name: "a1rworkshop.pickpreview",
    async setup() {
        initGlobalThemeCSSVar();
        injectCSS("../../css/a1r-model-preview.css", import.meta.url);
        injectCSS("../../css/a1r-preview-manager.css", import.meta.url);
        await initConfig();
        window.addEventListener(MODEL_PREVIEW_UPDATED_EVENT, () => {
            // 立即收起当前 tooltip，下一次 hover 会拉取最新预览。
            preview.forceRemove();
        });
        startObserving();
    },
});
