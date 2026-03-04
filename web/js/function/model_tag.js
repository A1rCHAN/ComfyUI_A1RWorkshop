// @ts-expect-error ComfyUI runtime-provided module
import { app } from "/scripts/app.js";
import { getModelFromNode, getTagsDB, initConfig, isModelLoaderNode, } from "./config_model.js";
import { showEditor } from "./editor_window.js";
import { showManager } from "./manager_window.js";
import { setupTagInjector } from "./tag_injector.js";
let initialized = false;
async function ensureInit() {
    if (!initialized) {
        await initConfig();
        initialized = true;
    }
}
app.registerExtension({
    name: "a1rworkshop.modeltag",
    async setup() {
        await ensureInit();
        setupTagInjector();
    },
    getNodeMenuItems(node) {
        if (!isModelLoaderNode(node))
            return [];
        return [{
                content: "Open Tag Editor",
                callback: () => { ensureInit().then(() => { showEditor(node); }); }
            }];
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
        ];
    },
    async nodeCreated(node) {
        if (!isModelLoaderNode(node))
            return;
        const originalOnDrawForeground = node.onDrawForeground;
        node.onDrawForeground = function (ctx) {
            if (originalOnDrawForeground) {
                originalOnDrawForeground.apply(this, [ctx]);
            }
            if (!initialized)
                return;
            const db = getTagsDB();
            if (!db)
                return;
            const currentModel = getModelFromNode(node);
            if (!currentModel)
                return;
            const hasTags = db.findByModelName(currentModel) !== null;
            if (!hasTags)
                return;
            const width = Array.isArray(this.size) ? this.size[0] : 200;
            ctx.save();
            const tagText = "TAGS";
            ctx.font = "bold 11px sans-serif";
            const tagWidth = ctx.measureText(tagText).width + 16;
            const tagHeight = 20;
            const x = width - tagWidth - 8;
            const y = 8;
            ctx.fillStyle = "#4CAF50";
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
                ctx.roundRect(x, y, tagWidth, tagHeight, 4);
            }
            else {
                ctx.rect(x, y, tagWidth, tagHeight);
            }
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(tagText, x + tagWidth / 2, y + tagHeight / 2);
            ctx.restore();
        };
    },
});
