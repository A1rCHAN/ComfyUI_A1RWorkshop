// @ts-expect-error ComfyUI 运行时注入模块
import { app } from "/scripts/app.js";
import { getModelFromNode, getTagsDB, initConfig, isModelLoaderNode } from "../data/config_model.js";
import { setupTagInjector } from "./tag_injector.js";
import { initGlobalThemeCSSVar, injectCSS } from "../theme/themeWatcher.js";
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
        initGlobalThemeCSSVar();
        injectCSS("../../css/a1r-model-tag.css", import.meta.url);
        await ensureInit();
        setupTagInjector();
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
