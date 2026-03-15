// @ts-expect-error ComfyUI 运行时注入模块
import { app } from "/scripts/app.js";
import { initConfig, isModelLoaderNode, getModelFromNode, } from "../data/config_model.js";
import { showEditor } from "../helper/editor_window.js";
import { showManager } from "../helper/manager_window.js";
import { showPreviewEditor } from "../helper/popover_editor.js";
import { showPreviewManager } from "../helper/popover_manager.js";
const MODEL_WIDGET_MAP = {
    CheckpointLoaderSimple: { folder: "checkpoints" },
    LoraLoader: { folder: "loras" },
};
function cfgFromNode(node) {
    if (!node)
        return null;
    const cfg = MODEL_WIDGET_MAP[node.comfyClass ?? node.type];
    return cfg ? { folder: cfg.folder } : null;
}
let initialized = false;
async function ensureInit() {
    if (!initialized) {
        await initConfig();
        initialized = true;
    }
}
app.registerExtension({
    name: "a1rworkshop.contextmenu",
    async setup() {
        await ensureInit();
    },
    getCanvasMenuItems() {
        return [
            null,
            {
                content: "Open Tags Manager",
                callback: () => {
                    ensureInit().then(() => showManager());
                },
            },
            {
                content: "Open Preview Manager",
                callback: () => {
                    ensureInit().then(() => showPreviewManager());
                },
            },
        ];
    },
    getNodeMenuItems(node) {
        if (!isModelLoaderNode(node))
            return [];
        return [
            {
                content: "Open Tag Editor",
                callback: () => {
                    ensureInit().then(() => {
                        showEditor(node);
                    });
                },
            },
            {
                content: "Open Preview Editor",
                callback: () => {
                    const cfg = cfgFromNode(node);
                    const filename = getModelFromNode(node) || "";
                    showPreviewEditor({ folder: cfg?.folder || "", filename });
                },
            },
        ];
    },
});
