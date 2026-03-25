import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import { createContainer, createButton, hexToRGBA } from "../theme/themeUtils.js";
import { initGlobalThemeCSSVar, injectCSS, resolveThemeToken } from "../theme/themeWatcher.js";
import { snapshotImagesForSeed, createPreviewTooltip, deleteCachedImages, isLightboxOpen } from "../helper/popover.js";
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
    node.pendingSeeds = [];
    node.executingSeed = null;
    node.queuedSeed = null;
    node.progressValue = 0;
    node.progressMax = 0;
}
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
function createButtonWidget(node) {
    const container = createContainer();
    container.classList.add("a1r-seed-container");
    const manualBtn = createButton("manual random", { ellipsis: true });
    manualBtn.classList.add("a1r-seed-button", "a1r-seed-manual");
    const historyBtn = createButton("pull history", { ellipsis: true });
    historyBtn.classList.add("a1r-seed-button", "a1r-seed-history");
    container.appendChild(manualBtn);
    container.appendChild(historyBtn);
    function updateHistoryBtnState() {
        const hasPending = node.pendingSeeds.length > 0;
        const hasHistory = node.seedHistory.length >= 2;
        historyBtn.disabled = !(hasPending || hasHistory);
    }
    function resetManualBtn() {
        node.buttonCooldown.left = false;
        manualBtn.dataset.cooldown = "false";
        manualBtn.style.opacity = "1";
    }
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
    function fullRebuildPopover() {
        if (!popover)
            return;
        popover.innerHTML = "";
        const title = document.createElement("div");
        title.className = "a1r-seed-popover-title";
        title.textContent = "Seed History";
        popover.appendChild(title);
        const pending = node.pendingSeeds;
        if (pending.length > 0) {
            pending.forEach((seed, i) => {
                const isExecuting = i === 0 && node.executingSeed != null;
                const item = document.createElement("div");
                item.className = "a1r-seed-popover-item a1r-seed-popover-item--queue";
                item.dataset.queueIndex = String(i);
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
            if (node.seedImageMap.has(seed)) {
                const urls = node.seedImageMap.get(seed);
                item.addEventListener("mouseenter", () => preview.show(urls, item, popover));
                item.addEventListener("mouseleave", preview.scheduleRemove);
            }
            popover.appendChild(item);
        });
        positionPopover();
    }
    function updateProgressOnly() {
        if (!popover)
            return;
        const queueItems = popover.querySelectorAll(".a1r-seed-popover-item--queue");
        const pending = node.pendingSeeds;
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
    function refreshPopover() {
        if (popover) {
            renderPopoverItems();
        }
        updateHistoryBtnState();
    }
    function refreshProgress() {
        if (popover) {
            updateProgressOnly();
        }
    }
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
    historyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPopover();
    });
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
        api.addEventListener("executing", (evt) => {
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
            info.seedImageMap = Array.from(this.seedImageMap.entries());
        };
    },
});
