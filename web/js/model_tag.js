import { app } from "/scripts/app.js";
import { initConfig, isModelLoaderNode, getModelFromNode, getTagsDB } from "../config.js";
import { setupTagInjector } from "../injector.js";
import { showEditor } from "./editor_window.js";
import { showManager } from "./manager_window.js";

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await initConfig();
    initialized = true
  }
}

app.registerExtension({
  name: "a1rworkshop.modeltag",

  async setup() {
    await ensureInit();
    setupTagInjector()
  },

  getNodeMenuItems(node) {
    if (!isModelLoaderNode(node)) return [];
    return [{
      content: "Open Tag Editor",
      callback: () => { ensureInit().then(() => showEditor(node)) }
    }]
  },

  getCanvasMenuItems() {
    return [
      null,
      {
        content: "Open Tags Manager",
        callback: () => { ensureInit().then(() => showManager()) }
      }
    ]
  },

  async nodeCreated(node) {
    if (!isModelLoaderNode(node)) return;

    const originalOnDrawForeground = node.onDrawForeground;
    node.onDrawForeground = function(ctx) {
      if (originalOnDrawForeground) originalOnDrawForeground.apply(this, arguments);

      // 初始化未完成或数据库不可用时跳过
      if (!initialized) return;
      const db = getTagsDB();
      if (!db) return;

      const currentModel = getModelFromNode(node);
      if (!currentModel) return;

      const hasTags = db.findByModelName(currentModel) !== null;
      if (!hasTags) return;

      ctx.save();
      const tagText   = "TAGS";
      ctx.font        = "bold 11px sans-serif";
      const tagWidth  = ctx.measureText(tagText).width + 16;
      const tagHeight = 20;
      const x = this.size[0] - tagWidth - 8;
      const y = 8;

      ctx.fillStyle = "#4CAF50";
      ctx.beginPath();
      ctx.roundRect(x, y, tagWidth, tagHeight, 4);
      ctx.fill();

      ctx.fillStyle    = "#ffffff";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tagText, x + tagWidth / 2, y + tagHeight / 2);
      ctx.restore()
    }
  }
})