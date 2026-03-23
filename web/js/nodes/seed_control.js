// @ts-expect-error ComfyUI 运行时注入模块
import { app } from "/scripts/app.js";
// @ts-expect-error ComfyUI 运行时注入模块
import { api } from "/scripts/api.js";
import { createContainer, createButton, hexToRGBA } from "../theme/themeUtils.js";
import { initGlobalThemeCSSVar, injectCSS, resolveThemeToken } from "../theme/themeWatcher.js";
import { snapshotImagesForSeed, createPreviewTooltip, deleteCachedImages, isLightboxOpen } from "../helper/popover.js";
// ========== 辅助函数 ==========
function updateSeedHistory(node, seedValue) {
    if (node.seedHistory.length === 0 || node.seedHistory[0] !== seedValue) {
        node.seedHistory.unshift(seedValue);
        if (node.seedHistory.length > node.maxHistoryLength) {
            const removed = node.seedHistory.pop();
            if (removed !== undefined) {
                node.seedImageMap.delete(removed);
                deleteCachedImages(removed);
            }
        }
        if (node._onHistoryChange)
            node._onHistoryChange();
    }
}
function getCurrentSeed(node) {
    const seedWidget = node.widgets.find((w) => w.name === "seed");
    return seedWidget ? seedWidget.value : 0;
}
function generateRandomSeed(node) {
    const seedWidget = node.widgets.find((w) => w.name === "seed");
    if (!seedWidget)
        return null;
    const randomSeed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    node.isRestoring = false;
    seedWidget.value = randomSeed;
    if (seedWidget.callback) {
        const tempRestoring = node.isRestoring;
        node.isRestoring = true;
        seedWidget.callback(randomSeed);
        node.isRestoring = tempRestoring;
    }
    return randomSeed;
}
async function queuePromptWithSeed(node, targetSeed) {
    const operationId = Date.now() + Math.random();
    node.currentOperationId = operationId;
    node.forcedSeed = targetSeed;
    node.isExecuting = true;
    try {
        await app.queuePrompt(0, 1);
        setTimeout(() => {
            if (node.currentOperationId === operationId) {
                node.forcedSeed = null;
                node.isExecuting = false;
            }
        }, 2000);
    }
    catch {
        if (node.currentOperationId === operationId) {
            node.forcedSeed = null;
            node.isExecuting = false;
        }
    }
}
// ========== 节点状态初始化 ==========
function initNodeState(node) {
    node.seedHistory = [];
    node.seedImageMap = new Map();
    node.maxHistoryLength = 10;
    node.isRestoring = false;
    node.isExecuting = false;
    node.forcedSeed = null;
    node.currentOperationId = null;
    node.buttonCooldown = { left: false };
    node.isHandlingControlChange = false;
    node.pendingSeeds = []; // FIFO: graphToPrompt 时压入，执行完成时弹出
    node.executingSeed = null;
    node.queuedSeed = null;
    node.progressValue = 0;
    node.progressMax = 0;
}
// ========== Widget 拦截器 ==========
function setupSeedWidgetInterceptor(node) {
    const seedWidget = node.widgets.find((w) => w.name === "seed");
    if (!seedWidget)
        return;
    if (seedWidget.value !== undefined) {
        updateSeedHistory(node, seedWidget.value);
    }
}
function setupControlWidgetInterceptor(node) {
    const controlWidget = node.widgets.find((w) => w.name === "control_after_generate");
    if (!controlWidget)
        return;
    const originalControlCallback = controlWidget.callback;
    controlWidget.callback = (value) => {
        if (node.isHandlingControlChange) {
            if (originalControlCallback)
                originalControlCallback.call(controlWidget, value);
            return;
        }
        node.isHandlingControlChange = true;
        if (value === "randomize") {
            node.isRestoring = false;
            node.isExecuting = false;
            node.forcedSeed = null;
            node.currentOperationId = null;
            generateRandomSeed(node);
        }
        if (originalControlCallback)
            originalControlCallback.call(controlWidget, value);
        node.isHandlingControlChange = false;
    };
}
// ========== 按钮部件 ==========
function createButtonWidget(node) {
    const container = createContainer();
    container.classList.add("a1r-seed-container");
    const manualBtn = createButton("manual random", { ellipsis: true });
    manualBtn.classList.add("a1r-seed-button", "a1r-seed-manual");
    const historyBtn = createButton("pull history", { ellipsis: true });
    historyBtn.classList.add("a1r-seed-button", "a1r-seed-history");
    container.appendChild(manualBtn);
    container.appendChild(historyBtn);
    // ===== pull history 状态管理 =====
    function updateHistoryBtnState() {
        const hasPending = node.pendingSeeds.length > 0;
        const hasHistory = node.seedHistory.length >= 2;
        historyBtn.disabled = !(hasPending || hasHistory);
    }
    // ===== 冷却控制 =====
    function resetManualBtn() {
        node.buttonCooldown.left = false;
        manualBtn.dataset.cooldown = "false";
        manualBtn.style.opacity = "1";
    }
    // ===== 种子历史下拉菜单 =====
    let popover = null;
    const preview = createPreviewTooltip();
    function closePopover() {
        preview.remove();
        if (popover) {
            popover.remove();
            popover = null;
        }
        historyBtn.classList.remove("a1r-seed-history--active");
        document.removeEventListener("pointerdown", onOutsideClick, true);
        updateHistoryBtnState();
    }
    function onOutsideClick(e) {
        // lightbox 打开时不处理外部点击，避免关闭大图时连带关闭 popover
        if (isLightboxOpen())
            return;
        const target = e.target;
        if (popover && !popover.contains(target)
            && !(preview.element && preview.element.contains(target))
            && target !== historyBtn) {
            closePopover();
        }
    }
    function selectHistorySeed(seed) {
        closePopover();
        const seedWidget = node.widgets.find((w) => w.name === "seed");
        if (!seedWidget)
            return;
        node.isRestoring = true;
        seedWidget.value = seed;
        const idx = node.seedHistory.indexOf(seed);
        if (idx > 0) {
            node.seedHistory.splice(idx, 1);
            node.seedHistory.unshift(seed);
        }
        setTimeout(() => { node.isRestoring = false; }, 100);
        setTimeout(() => { queuePromptWithSeed(node, seed); }, 50);
    }
    function openPopover() {
        if (popover) {
            closePopover();
            return;
        }
        if (node.seedHistory.length < 2 && node.pendingSeeds.length === 0)
            return;
        const token = resolveThemeToken();
        popover = document.createElement("div");
        popover.className = "a1r-seed-popover";
        popover.style.boxShadow = `0 8px 24px ${hexToRGBA(token.color.shadow, 0.45)}`;
        renderPopoverItems();
        document.body.appendChild(popover);
        positionPopover();
        historyBtn.classList.add("a1r-seed-history--active");
        setTimeout(() => {
            document.addEventListener("pointerdown", onOutsideClick, true);
        }, 0);
    }
    function positionPopover() {
        if (!popover)
            return;
        const btnRect = historyBtn.getBoundingClientRect();
        const popRect = popover.getBoundingClientRect();
        let top = btnRect.bottom + 4;
        if (top + popRect.height > window.innerHeight - 8) {
            top = btnRect.top - popRect.height - 4;
        }
        let left = btnRect.right - popRect.width;
        if (left < 8)
            left = btnRect.left;
        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
    }
    function renderPopoverItems() {
        if (!popover)
            return;
        preview.remove();
        fullRebuildPopover();
    }
    /** 完整重建 popover 内容（结构变化时使用） */
    function fullRebuildPopover() {
        if (!popover)
            return;
        // 清除已有内容
        popover.innerHTML = "";
        const title = document.createElement("div");
        title.className = "a1r-seed-popover-title";
        title.textContent = "Seed History";
        popover.appendChild(title);
        // ===== 队列中的种子（pendingSeeds）=====
        const pending = node.pendingSeeds;
        if (pending.length > 0) {
            pending.forEach((seed, i) => {
                const isExecuting = i === 0 && node.executingSeed != null;
                const item = document.createElement("div");
                item.className = "a1r-seed-popover-item a1r-seed-popover-item--queue";
                item.dataset.queueIndex = String(i);
                // 进度条背景
                const progressBar = document.createElement("div");
                progressBar.className = "a1r-seed-progress";
                if (isExecuting && node.progressMax > 0) {
                    const pct = Math.min(100, (node.progressValue / node.progressMax) * 100);
                    progressBar.style.width = `${pct}%`;
                }
                else {
                    progressBar.style.width = "0%";
                }
                item.appendChild(progressBar);
                const seedText = document.createElement("span");
                seedText.className = "a1r-seed-popover-seed";
                seedText.textContent = String(seed);
                seedText.style.color = `var(--a1r-color-prompt)`;
                item.appendChild(seedText);
                const badge = document.createElement("span");
                badge.className = "a1r-seed-popover-badge";
                badge.textContent = isExecuting ? "running" : "queued";
                item.appendChild(badge);
                popover.appendChild(item);
            });
        }
        // ===== 历史种子 =====
        const historySeeds = node.seedHistory;
        historySeeds.forEach((seed, i) => {
            const isTop = i === 0 && pending.length === 0;
            const item = document.createElement("div");
            item.className = "a1r-seed-popover-item";
            if (isTop)
                item.classList.add("a1r-seed-popover-item--current");
            const seedText = document.createElement("span");
            seedText.className = "a1r-seed-popover-seed";
            seedText.textContent = String(seed);
            item.appendChild(seedText);
            if (isTop) {
                const badge = document.createElement("span");
                badge.className = "a1r-seed-popover-badge";
                badge.textContent = "current";
                item.appendChild(badge);
            }
            else {
                item.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectHistorySeed(seed);
                });
            }
            // 悬浮预览图像（点击可查看大图）
            if (node.seedImageMap.has(seed)) {
                const urls = node.seedImageMap.get(seed);
                item.addEventListener("mouseenter", () => preview.show(urls, item, popover));
                item.addEventListener("mouseleave", preview.scheduleRemove);
            }
            popover.appendChild(item);
        });
        positionPopover();
    }
    /** 仅更新进度条，不重建 DOM（避免 hover 闪烁） */
    function updateProgressOnly() {
        if (!popover)
            return;
        const queueItems = popover.querySelectorAll(".a1r-seed-popover-item--queue");
        const pending = node.pendingSeeds;
        // 如果队列数量变了，需要完整重建
        if (queueItems.length !== pending.length) {
            fullRebuildPopover();
            return;
        }
        queueItems.forEach((item, i) => {
            const isExecuting = i === 0 && node.executingSeed != null;
            const bar = item.querySelector(".a1r-seed-progress");
            if (bar) {
                if (isExecuting && node.progressMax > 0) {
                    const pct = Math.min(100, (node.progressValue / node.progressMax) * 100);
                    bar.style.width = `${pct}%`;
                }
                else {
                    bar.style.width = "0%";
                }
            }
            const badge = item.querySelector(".a1r-seed-popover-badge");
            if (badge)
                badge.textContent = isExecuting ? "running" : "queued";
        });
    }
    /** 外部调用：如果 popover 已打开，刷新其内容 */
    function refreshPopover() {
        if (popover) {
            renderPopoverItems();
        }
        updateHistoryBtnState();
    }
    /** 仅刷新进度条（不重建 DOM，防止 hover 闪烁） */
    function refreshProgress() {
        if (popover) {
            updateProgressOnly();
        }
    }
    // ===== manual random 点击 =====
    manualBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closePopover();
        if (node.buttonCooldown.left)
            return;
        node.buttonCooldown.left = true;
        manualBtn.dataset.cooldown = "true";
        manualBtn.style.opacity = "0.5";
        node.isRestoring = false;
        const newSeed = generateRandomSeed(node);
        if (newSeed !== null) {
            setTimeout(() => {
                queuePromptWithSeed(node, newSeed).finally(() => {
                    setTimeout(() => resetManualBtn(), 500);
                });
            }, 50);
        }
        else {
            resetManualBtn();
        }
    });
    // ===== pull history 点击 =====
    historyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPopover();
    });
    // ===== 注册为 DOM Widget =====
    const widget = node.addDOMWidget("seed_buttons", "SEED_BUTTONS", container, {
        serialize: false,
        hideOnZoom: false,
    });
    widget.computeSize = function (width) {
        return [width, 34];
    };
    widget.updateHistoryBtnState = updateHistoryBtnState;
    node._onHistoryChange = refreshPopover;
    node._refreshPopover = refreshPopover;
    node._refreshProgress = refreshProgress;
    widget.onRemove = function () {
        closePopover();
    };
    updateHistoryBtnState();
    return widget;
}
// ========== 注册扩展 ==========
app.registerExtension({
    name: "a1rworkshop.seedcontrol",
    async setup() {
        initGlobalThemeCSSVar();
        injectCSS("../../css/a1r-seed.css", import.meta.url);
        const originalGraphToPrompt = app.graphToPrompt;
        app.graphToPrompt = async function () {
            const prompt = await originalGraphToPrompt.call(app);
            for (const node of app.graph._nodes) {
                if (node.comfyClass === "SeedControl") {
                    const nodeId = node.id;
                    if (prompt.output && prompt.output[nodeId]) {
                        const seed = node.forcedSeed !== null ? node.forcedSeed : getCurrentSeed(node);
                        prompt.output[nodeId].inputs.seed = seed;
                        node.pendingSeeds.push(seed);
                    }
                }
            }
            return prompt;
        };
        // 执行开始：从队列头部取待执行种子
        api.addEventListener("execution_start", () => {
            for (const node of app.graph._nodes) {
                if (node.comfyClass === "SeedControl" && node.pendingSeeds.length > 0) {
                    node.queuedSeed = node.pendingSeeds[0];
                    node.executingSeed = null;
                    if (node._refreshPopover)
                        node._refreshPopover();
                }
            }
        });
        // 当前节点开始执行：将对应 SeedControl 从“队列”变为“执行中”
        api.addEventListener("executing", (evt) => {
            // evt.detail 直接是节点 ID 字符串（非对象）
            const executingNodeId = evt.detail != null ? String(evt.detail) : "";
            for (const node of app.graph._nodes) {
                if (node.comfyClass === "SeedControl" && String(node.id) === executingNodeId) {
                    node.executingSeed = node.queuedSeed;
                    node.queuedSeed = null;
                    node.progressValue = 0;
                    node.progressMax = 0;
                    if (node._refreshPopover)
                        node._refreshPopover();
                }
            }
        });
        // 进度更新：追踪执行进度并刷新 popover 中的进度条
        // progress 事件来自采样器节点（非 SeedControl 本身），
        // 只要 SeedControl 处于"执行中"状态就应用进度。
        api.addEventListener("progress", (evt) => {
            const detail = evt.detail;
            if (!detail)
                return;
            for (const node of app.graph._nodes) {
                if (node.comfyClass === "SeedControl" && node.executingSeed != null) {
                    node.progressValue = detail.value ?? 0;
                    node.progressMax = detail.max ?? 0;
                    if (node._refreshProgress)
                        node._refreshProgress();
                }
            }
        });
        // 执行完成后记录种子历史、快照图像、清除执行状态、刷新列表
        api.addEventListener("execution_success", async () => {
            for (const node of app.graph._nodes) {
                if (node.comfyClass === "SeedControl") {
                    const seed = node.pendingSeeds.shift();
                    node.executingSeed = null;
                    node.queuedSeed = null;
                    node.isExecuting = false;
                    node.forcedSeed = null;
                    node.progressValue = 0;
                    node.progressMax = 0;
                    if (seed != null) {
                        updateSeedHistory(node, seed);
                        await snapshotImagesForSeed(node, seed);
                    }
                    if (node._refreshPopover)
                        node._refreshPopover();
                }
            }
        });
        // 执行失败/中断时也弹出队列，防止失步
        const discardPending = () => {
            for (const node of app.graph._nodes) {
                if (node.comfyClass === "SeedControl") {
                    node.pendingSeeds.shift();
                    node.executingSeed = null;
                    node.queuedSeed = null;
                    node.isExecuting = false;
                    node.forcedSeed = null;
                    node.progressValue = 0;
                    node.progressMax = 0;
                    if (node._refreshPopover)
                        node._refreshPopover();
                }
            }
        };
        api.addEventListener("execution_error", discardPending);
        api.addEventListener("execution_interrupted", discardPending);
    },
    async nodeCreated(node) {
        if (node.comfyClass !== "SeedControl")
            return;
        initNodeState(node);
        setupSeedWidgetInterceptor(node);
        setupControlWidgetInterceptor(node);
        const buttonWidget = createButtonWidget(node);
        const minNodeWidth = 300;
        if (node.size[0] < minNodeWidth)
            node.size[0] = minNodeWidth;
        const originalOnRemoved = node.onRemoved;
        node.onRemoved = function () {
            if (buttonWidget.onRemove)
                buttonWidget.onRemove();
            if (originalOnRemoved)
                originalOnRemoved.apply(this, arguments);
        };
        const originalOnConfigure = node.onConfigure;
        node.onConfigure = function (info) {
            if (originalOnConfigure)
                originalOnConfigure.apply(this, arguments);
            if (info.seedHistory) {
                this.seedHistory = info.seedHistory;
                if (this.seedHistory.length > this.maxHistoryLength) {
                    this.seedHistory.length = this.maxHistoryLength;
                }
            }
            // 恢复图像缓存映射
            if (info.seedImageMap) {
                this.seedImageMap = new Map(info.seedImageMap);
            }
            if (buttonWidget.updateHistoryBtnState) {
                buttonWidget.updateHistoryBtnState();
            }
        };
        const originalOnSerialize = node.onSerialize;
        node.onSerialize = function (info) {
            if (originalOnSerialize)
                originalOnSerialize.apply(this, arguments);
            info.seedHistory = this.seedHistory || [];
            // 序列化图像缓存映射（Map → [key, value][] 数组）
            info.seedImageMap = Array.from(this.seedImageMap.entries());
        };
    },
});
