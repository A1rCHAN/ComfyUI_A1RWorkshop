// @ts-expect-error ComfyUI 运行时注入模块
import { app } from "/scripts/app.js";
// @ts-expect-error ComfyUI 运行时注入模块
import { api } from "/scripts/api.js";
import { hexToRGBA } from "../theme/themeUtils.js";
import { resolveThemeToken } from "../theme/themeWatcher.js";
// ========== 缓存 API ==========
const CACHE_API = "/api/a1rworkshop";
/**
 * 将图像复制到 .cache/，文件名为 {seed}_{index}.ext，返回可持久化的缓存 URL 列表
 */
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
/**
 * 清空 .cache/ 目录
 */
export async function clearImageCache() {
    await api.fetchApi(`${CACHE_API}/clear_cache`, { method: "POST" });
}
/**
 * 删除指定种子的缓存图片
 */
export async function deleteCachedImages(seed) {
    await api.fetchApi(`${CACHE_API}/delete_seed_cache`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed }),
    });
}
// ========== 图像快照 ==========
/**
 * 从工作流中收集当前执行产生的图像引用。
 * 优先级：所有输入包含 images 且有图像输出的节点 → 保底 SaveImage/PreviewImage。
 * 跳过 bypass (mode=4) 和 mute (mode=2) 的节点。
 */
function collectImageRefs() {
    const imageNodes = [];
    const fallbackNodes = [];
    for (const node of app.graph._nodes) {
        // 跳过 bypass (4) 和 mute (2) 的节点
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
/**
 * 为指定种子快照当前图像输出（异步缓存到本地 .cache/）
 */
export async function snapshotImagesForSeed(node, seed) {
    // 跳过 bypass (4) 和 mute (2) 的节点
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
// ========== 大图查看器（Lightbox） ==========
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
    // 多图时才显示箭头
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
    // 点击背景关闭
    lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox)
            closeLightbox();
    });
    // 左箭头
    const arrowLeft = document.createElement("div");
    arrowLeft.className = "a1r-lightbox-arrow a1r-lightbox-arrow--left";
    arrowLeft.textContent = "\u276E";
    arrowLeft.addEventListener("click", (e) => { e.stopPropagation(); showLightboxAt(lbIndex - 1); });
    lightbox.appendChild(arrowLeft);
    // 图片
    const img = document.createElement("img");
    img.className = "a1r-lightbox-img";
    img.addEventListener("click", (e) => e.stopPropagation());
    lightbox.appendChild(img);
    // 右箭头
    const arrowRight = document.createElement("div");
    arrowRight.className = "a1r-lightbox-arrow a1r-lightbox-arrow--right";
    arrowRight.textContent = "\u276F";
    arrowRight.addEventListener("click", (e) => { e.stopPropagation(); showLightboxAt(lbIndex + 1); });
    lightbox.appendChild(arrowRight);
    // 计数器
    const counter = document.createElement("div");
    counter.className = "a1r-lightbox-counter";
    lightbox.appendChild(counter);
    // 关闭按钮
    const closeBtn = document.createElement("div");
    closeBtn.className = "a1r-lightbox-close";
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
    lightbox.appendChild(closeBtn);
    lightbox.style.boxShadow = `0 0 80px ${hexToRGBA(token.color.shadow, 0.6)}`;
    document.body.appendChild(lightbox);
    showLightboxAt(startIndex);
    // 滚轮导航
    lightbox.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (e.deltaY > 0)
            showLightboxAt(lbIndex + 1);
        else if (e.deltaY < 0)
            showLightboxAt(lbIndex - 1);
    }, { passive: false });
    // 键盘导航
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
// ========== 预览悬浮提示 ==========
export function createPreviewTooltip() {
    let tooltip = null;
    let removeTimer = null;
    let pinned = false; // lightbox 打开后钉住预览，直到切换种子或关闭列表
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
    /** 延迟移除：给用户时间将鼠标移到预览上（pinned 时忽略） */
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
        // 鼠标进入预览区域时取消延迟移除
        tooltip.addEventListener("mouseenter", cancelRemoveTimer);
        // 鼠标离开预览区域时延迟移除（pinned 时 scheduleRemove 内部会忽略）
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
        // 定位：popover 右侧
        const popRect = popoverEl.getBoundingClientRect();
        const tipRect = tooltip.getBoundingClientRect();
        let left = popRect.right + 6;
        if (left + tipRect.width > window.innerWidth - 8)
            left = popRect.left - tipRect.width - 6;
        if (left < 8)
            left = 8;
        const itemRect = anchorEl.getBoundingClientRect();
        // 预览图位置向上偏移 25% 高度
        let top = itemRect.top - tipRect.height * 0.25;
        if (top + tipRect.height > window.innerHeight - 8) {
            top = window.innerHeight - 8 - tipRect.height;
        }
        if (top < 8)
            top = 8;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }
    return {
        get element() { return tooltip; },
        show,
        remove,
        scheduleRemove,
    };
}
