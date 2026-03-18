// @ts-expect-error ComfyUI 运行时注入模块
import { app } from "/scripts/app.js";
import { createButton, createContainer, createOverlay } from "../theme/themeUtils.js";
import { initGlobalThemeCSSVar, injectCSS } from "../theme/themeWatcher.js";
// === 节点按钮 === //
function createActiveButton(node) {
    const container = createContainer();
    container.classList.add("collector-container");
    const button = createButton("collect widgets", { ellipsis: true });
    node.__a1rCollectButton = button;
    button.classList.add("collector-button");
    button.addEventListener("click", () => collectWidgets(node, button));
    container.appendChild(button);
    const activeButtonWidget = node.addDOMWidget("seed_buttons", "SEED_BUTTONS", container, {
        serialize: false,
        hideOnZoom: false,
    });
    node.__a1rCollectButtonWidget = activeButtonWidget;
    activeButtonWidget.computeSize = function (width) {
        return [width, 34];
    };
    ensureCollectButtonAtBottom(node);
    return activeButtonWidget;
}
function ensureCollectButtonAtBottom(node) {
    if (!Array.isArray(node?.widgets) || node.widgets.length === 0)
        return;
    const buttonWidget = node.__a1rCollectButtonWidget;
    if (!buttonWidget)
        return;
    const currentIndex = node.widgets.indexOf(buttonWidget);
    if (currentIndex < 0 || currentIndex === node.widgets.length - 1)
        return;
    node.widgets.splice(currentIndex, 1);
    node.widgets.push(buttonWidget);
}
let collectingNodeId = null;
let collectObserver = null;
let collectRefreshRaf = null;
let collectCaptureGuardsInstalled = false;
let isMountingOverlays = false;
let isCollecting = false;
// let canvasBlocker: HTMLElement | null = null
const mountedRows = new Set();
const mountedOverlays = new Set();
const mountedOverlayHosts = new Set();
const mountedOverlayContainers = new Set();
const selectedWidgetKeys = new Set();
const selectedWidgetPayloads = new Map();
const mirrorOverlayByWidgetKey = new Map();
const mirrorDropPositionByWidgetKey = new Map();
let mirrorManageNodeId = null;
let mirrorManageWidgetKey = null;
let draggingMirrorWidgetKey = null;
let mirrorDragPointerId = null;
let mirrorDragSourceNode = null;
let mirrorDragSourceNodeId = null;
let mirrorDropTargetWidgetKey = null;
let mirrorDropTargetPosition = null;
// === 记录存储与序列化 === //
function getMirrorBindings(node) {
    if (!(node.__a1rMirrorBindings instanceof Map)) {
        node.__a1rMirrorBindings = new Map();
    }
    return node.__a1rMirrorBindings;
}
function toSerializable(value) {
    if (value === undefined)
        return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    }
    catch {
        return undefined;
    }
}
function normalizePersistedRecord(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const targetNodeId = Number(raw.targetNodeId);
    const widgetIndex = Number(raw.widgetIndex);
    const widgetName = String(raw.widgetName || "").trim();
    const widgetKey = String(raw.widgetKey || createWidgetKey(targetNodeId, widgetName, widgetIndex)).trim();
    const mirrorType = String(raw.mirrorType || "text").trim().toLowerCase();
    if (!Number.isFinite(targetNodeId))
        return null;
    if (!Number.isFinite(widgetIndex))
        return null;
    if (!widgetName)
        return null;
    if (!widgetKey)
        return null;
    const safeType = mirrorType === "combo" || mirrorType === "toggle" || mirrorType === "number" || mirrorType === "text"
        ? mirrorType
        : "text";
    return {
        sourceNodeId: Number(raw.sourceNodeId),
        targetNodeId,
        targetNodeType: String(raw.targetNodeType || ""),
        widgetName,
        widgetIndex,
        widgetKey,
        mirrorType: safeType,
        value: raw.value,
        options: toSerializable(raw.options),
    };
}
function getCollectedRecords(node) {
    if (node.__a1rCollectedRecords instanceof Map) {
        return node.__a1rCollectedRecords;
    }
    const records = new Map();
    const persisted = node?.properties?._collected_widgets;
    if (Array.isArray(persisted)) {
        persisted.forEach((raw) => {
            const record = normalizePersistedRecord(raw);
            if (!record)
                return;
            records.set(record.widgetKey, record);
        });
    }
    node.__a1rCollectedRecords = records;
    return records;
}
function syncCollectedRecordsToProperties(node) {
    const records = Array.from(getCollectedRecords(node).values()).map((record) => ({
        ...record,
        options: toSerializable(record.options),
        value: toSerializable(record.value),
    }));
    node.properties = node.properties || {};
    node.properties._collected_widgets = records;
}
function rebuildCollectedRecords(node, rawRecords) {
    const records = getCollectedRecords(node);
    records.clear();
    if (!Array.isArray(rawRecords)) {
        syncCollectedRecordsToProperties(node);
        return;
    }
    rawRecords.forEach((raw) => {
        const record = normalizePersistedRecord(raw);
        if (!record)
            return;
        records.set(record.widgetKey, record);
    });
    syncCollectedRecordsToProperties(node);
}
function createRecordFromPayload(payload, targetWidget) {
    return {
        ...payload,
        widgetKey: createWidgetKey(payload.targetNodeId, payload.widgetName, payload.widgetIndex),
        mirrorType: resolveMirrorWidgetType(targetWidget),
        value: toSerializable(targetWidget?.value),
        options: toSerializable(targetWidget?.options),
    };
}
function isMirrorWidget(widget) {
    return typeof widget?.__a1rWidgetKey === "string" && widget.__a1rWidgetKey.trim().length > 0;
}
function getVisibleMirrorWidgets(node) {
    if (!Array.isArray(node?.widgets))
        return [];
    return node.widgets.filter((widget) => isMirrorWidget(widget));
}
// === 镜像 widget 覆盖拖放状态 === //
function clearMirrorDropIndicators() {
    for (const overlay of mirrorOverlayByWidgetKey.values()) {
        overlay.classList.remove("collector-mirror-drop-before", "collector-mirror-drop-after");
    }
    mirrorDropPositionByWidgetKey.clear();
}
function clearMirrorDraggingIndicator() {
    for (const overlay of mirrorOverlayByWidgetKey.values()) {
        overlay.classList.remove("collector-mirror-dragging");
    }
}
function applyMirrorOverlayManageState(overlay) {
    const nodeId = Number(overlay.dataset.nodeId);
    const widgetKey = String(overlay.dataset.widgetKey || "");
    const isActive = Number.isFinite(nodeId) &&
        mirrorManageNodeId !== null &&
        mirrorManageWidgetKey !== null &&
        mirrorManageNodeId === nodeId &&
        mirrorManageWidgetKey === widgetKey;
    overlay.classList.toggle("collector-mirror-manage", isActive);
    overlay.draggable = false;
}
function setMirrorManageState(nodeId, widgetKey) {
    mirrorManageNodeId = nodeId;
    mirrorManageWidgetKey = widgetKey;
    for (const overlay of mirrorOverlayByWidgetKey.values()) {
        applyMirrorOverlayManageState(overlay);
    }
}
function updateMirrorDropTargetFromPointer(clientX, clientY) {
    clearMirrorDropIndicators();
    mirrorDropTargetWidgetKey = null;
    mirrorDropTargetPosition = null;
    if (!draggingMirrorWidgetKey || mirrorDragSourceNodeId === null)
        return;
    const hit = document.elementFromPoint(clientX, clientY);
    if (!(hit instanceof HTMLElement))
        return;
    const targetOverlay = hit.closest(".collector-overlay-mirror");
    if (!targetOverlay)
        return;
    const targetNodeId = Number(targetOverlay.dataset.nodeId);
    const targetWidgetKey = String(targetOverlay.dataset.widgetKey || "");
    if (!Number.isFinite(targetNodeId))
        return;
    if (targetNodeId !== mirrorDragSourceNodeId)
        return;
    if (!targetWidgetKey || targetWidgetKey === draggingMirrorWidgetKey)
        return;
    const rect = targetOverlay.getBoundingClientRect();
    const position = clientY <= rect.top + rect.height / 2 ? "before" : "after";
    mirrorDropTargetWidgetKey = targetWidgetKey;
    mirrorDropTargetPosition = position;
    mirrorDropPositionByWidgetKey.set(targetWidgetKey, position);
    targetOverlay.classList.toggle("collector-mirror-drop-before", position === "before");
    targetOverlay.classList.toggle("collector-mirror-drop-after", position === "after");
}
function onMirrorDragPointerMove(e) {
    if (mirrorDragPointerId === null || e.pointerId !== mirrorDragPointerId)
        return;
    e.preventDefault();
    updateMirrorDropTargetFromPointer(e.clientX, e.clientY);
}
function detachMirrorDragPointerListeners() {
    window.removeEventListener("pointermove", onMirrorDragPointerMove, true);
    window.removeEventListener("pointerup", onMirrorDragPointerUp, true);
    window.removeEventListener("pointercancel", onMirrorDragPointerCancel, true);
}
function finishMirrorDrag(commitReorder) {
    const movedWidgetKey = draggingMirrorWidgetKey;
    const sourceNode = mirrorDragSourceNode;
    const targetWidgetKey = mirrorDropTargetWidgetKey;
    const targetPosition = mirrorDropTargetPosition;
    detachMirrorDragPointerListeners();
    clearMirrorDropIndicators();
    clearMirrorDraggingIndicator();
    draggingMirrorWidgetKey = null;
    mirrorDragPointerId = null;
    mirrorDragSourceNode = null;
    mirrorDragSourceNodeId = null;
    mirrorDropTargetWidgetKey = null;
    mirrorDropTargetPosition = null;
    if (commitReorder && movedWidgetKey && sourceNode && targetWidgetKey && targetPosition) {
        reorderCollectedWidgets(sourceNode, movedWidgetKey, targetWidgetKey, targetPosition);
    }
    setMirrorManageState(null, null);
}
function onMirrorDragPointerUp(e) {
    if (mirrorDragPointerId === null || e.pointerId !== mirrorDragPointerId)
        return;
    e.preventDefault();
    finishMirrorDrag(true);
}
function onMirrorDragPointerCancel(e) {
    if (mirrorDragPointerId === null || e.pointerId !== mirrorDragPointerId)
        return;
    e.preventDefault();
    finishMirrorDrag(false);
}
function beginMirrorDrag(sourceNode, sourceNodeId, widgetKey, pointerId) {
    draggingMirrorWidgetKey = widgetKey;
    mirrorDragPointerId = pointerId;
    mirrorDragSourceNode = sourceNode;
    mirrorDragSourceNodeId = sourceNodeId;
    mirrorDropTargetWidgetKey = null;
    mirrorDropTargetPosition = null;
    setMirrorManageState(sourceNodeId, widgetKey);
    const sourceOverlay = mirrorOverlayByWidgetKey.get(widgetKey);
    if (sourceOverlay) {
        sourceOverlay.classList.add("collector-mirror-dragging");
    }
    window.addEventListener("pointermove", onMirrorDragPointerMove, true);
    window.addEventListener("pointerup", onMirrorDragPointerUp, true);
    window.addEventListener("pointercancel", onMirrorDragPointerCancel, true);
}
// === 镜像 widget 生命周期与排序 === //
function scheduleOverlayRefresh(sourceNode) {
    if (isMountingOverlays)
        return;
    if (collectRefreshRaf != null) {
        cancelAnimationFrame(collectRefreshRaf);
        collectRefreshRaf = null;
    }
    collectRefreshRaf = window.requestAnimationFrame(() => {
        collectRefreshRaf = null;
        if (collectingNodeId === null)
            return;
        if (collectingNodeId !== Number(sourceNode.id))
            return;
        mountWidgetOverlays(sourceNode);
    });
}
function removeMirrorWidgetByKey(node, widgetKey) {
    const bindings = getMirrorBindings(node);
    const binding = bindings.get(widgetKey);
    if (binding) {
        clearInterval(binding.syncTimerId);
        bindings.delete(widgetKey);
    }
    if (!Array.isArray(node.widgets))
        return;
    const idx = node.widgets.findIndex((widget) => String(widget?.__a1rWidgetKey || "") === widgetKey);
    if (idx < 0)
        return;
    const removed = node.widgets[idx];
    node.widgets.splice(idx, 1);
    if (removed && typeof removed.onRemove === "function") {
        removed.onRemove();
    }
}
function rebuildMirrorWidgetsInRecordOrder(node) {
    const records = getCollectedRecords(node);
    const lockedSize = snapshotNodeSize(node);
    cleanupMirrorBindings(node);
    if (Array.isArray(node.widgets)) {
        for (let idx = node.widgets.length - 1; idx >= 0; idx -= 1) {
            const widget = node.widgets[idx];
            if (!isMirrorWidget(widget))
                continue;
            node.widgets.splice(idx, 1);
            if (widget && typeof widget.onRemove === "function") {
                widget.onRemove();
            }
        }
    }
    records.forEach((record) => {
        createMirrorWidget(node, record);
    });
    syncCollectedRecordsToProperties(node);
    restoreNodeSize(node, lockedSize);
    if (typeof app.graph?.setDirtyCanvas === "function") {
        app.graph.setDirtyCanvas(true, true);
    }
    if (collectingNodeId !== null && collectingNodeId === Number(node.id)) {
        scheduleOverlayRefresh(node);
    }
}
function reorderCollectedWidgets(sourceNode, movedWidgetKey, targetWidgetKey, position) {
    if (!movedWidgetKey || !targetWidgetKey)
        return;
    if (movedWidgetKey === targetWidgetKey)
        return;
    const records = getCollectedRecords(sourceNode);
    if (!records.has(movedWidgetKey) || !records.has(targetWidgetKey))
        return;
    const orderedEntries = Array.from(records.entries());
    const movedIndex = orderedEntries.findIndex(([widgetKey]) => widgetKey === movedWidgetKey);
    if (movedIndex < 0)
        return;
    const [movedEntry] = orderedEntries.splice(movedIndex, 1);
    let targetIndex = orderedEntries.findIndex(([widgetKey]) => widgetKey === targetWidgetKey);
    if (targetIndex < 0)
        return;
    if (position === "after") {
        targetIndex += 1;
    }
    orderedEntries.splice(targetIndex, 0, movedEntry);
    records.clear();
    orderedEntries.forEach(([widgetKey, record]) => {
        records.set(widgetKey, record);
    });
    rebuildMirrorWidgetsInRecordOrder(sourceNode);
    if (mirrorManageWidgetKey === movedWidgetKey) {
        setMirrorManageState(Number(sourceNode.id), movedWidgetKey);
    }
}
function removeCollectedWidget(sourceNode, widgetKey) {
    const records = getCollectedRecords(sourceNode);
    if (!records.has(widgetKey))
        return;
    const lockedSize = snapshotNodeSize(sourceNode);
    records.delete(widgetKey);
    removeMirrorWidgetByKey(sourceNode, widgetKey);
    syncCollectedRecordsToProperties(sourceNode);
    if (mirrorManageWidgetKey === widgetKey) {
        setMirrorManageState(null, null);
    }
    restoreNodeSize(sourceNode, lockedSize);
    if (typeof app.graph?.setDirtyCanvas === "function") {
        app.graph.setDirtyCanvas(true, true);
    }
    if (collectingNodeId !== null && collectingNodeId === Number(sourceNode.id)) {
        mountWidgetOverlays(sourceNode);
    }
    const overlay = mirrorOverlayByWidgetKey.get(widgetKey);
    if (overlay) {
        overlay.remove();
        mirrorOverlayByWidgetKey.delete(widgetKey);
        mountedOverlays.delete(overlay);
        mirrorDropPositionByWidgetKey.delete(widgetKey);
    }
    selectedWidgetKeys.delete(widgetKey);
    selectedWidgetPayloads.delete(widgetKey);
}
function cleanupMirrorBindings(node) {
    const bindings = getMirrorBindings(node);
    for (const binding of bindings.values()) {
        clearInterval(binding.syncTimerId);
    }
    bindings.clear();
}
function getWidgetDisplayName(node, widgetName) {
    const nodeName = (node?.title || node?.type || "node").trim();
    const name = (widgetName || "widget").trim();
    return `${nodeName}.${name}`;
}
function snapshotNodeSize(node) {
    if (!Array.isArray(node?.size) || node.size.length < 2)
        return null;
    const width = Number(node.size[0]);
    const height = Number(node.size[1]);
    if (!Number.isFinite(width) || !Number.isFinite(height))
        return null;
    return [width, height];
}
function restoreNodeSize(node, size) {
    if (!size)
        return;
    node.size = [size[0], size[1]];
    if (typeof app.graph?.setDirtyCanvas === "function") {
        app.graph.setDirtyCanvas(true, true);
    }
}
function getWidgetNameOrLabel(widget) {
    if (typeof widget?.name === "string" && widget.name.trim()) {
        return widget.name.trim();
    }
    if (typeof widget?.label === "string" && widget.label.trim()) {
        return widget.label.trim();
    }
    return "";
}
function extractRowWidgetDisplayName(row) {
    const labelText = row.querySelector(".content-center-safe")?.textContent?.trim();
    if (labelText)
        return labelText;
    const namedField = row.querySelector("textarea[aria-label], input[aria-label], button[aria-label], select[aria-label], [role='textbox'][aria-label]");
    const fromFieldAria = namedField?.getAttribute("aria-label")?.trim();
    if (fromFieldAria)
        return fromFieldAria;
    const fallbackAria = row.querySelector("[aria-label]")?.getAttribute("aria-label")?.trim();
    if (fallbackAria)
        return fallbackAria;
    return "";
}
function resolveSourceMirrorWidgetForRow(sourceNode, row, usedMirrorWidgetKeys) {
    const visibleMirrorWidgets = getVisibleMirrorWidgets(sourceNode);
    if (visibleMirrorWidgets.length === 0)
        return null;
    const rowWidgetName = extractRowWidgetDisplayName(row);
    if (rowWidgetName) {
        const exactMatch = visibleMirrorWidgets.find((widget) => {
            const widgetKey = String(widget?.__a1rWidgetKey || "");
            if (!widgetKey || usedMirrorWidgetKeys.has(widgetKey))
                return false;
            return getWidgetNameOrLabel(widget) === rowWidgetName;
        });
        if (exactMatch)
            return exactMatch;
    }
    return (visibleMirrorWidgets.find((widget) => {
        const widgetKey = String(widget?.__a1rWidgetKey || "");
        return widgetKey && !usedMirrorWidgetKeys.has(widgetKey);
    }) || null);
}
function resolveTargetWidget(payload) {
    const graph = app.graph;
    const targetNode = graph?.getNodeById?.(payload.targetNodeId);
    if (!targetNode)
        return null;
    const widgets = Array.isArray(targetNode.widgets) ? targetNode.widgets : [];
    if (widgets.length === 0)
        return null;
    const name = payload.widgetName.trim();
    let targetWidget = widgets[payload.widgetIndex];
    if (targetWidget && name) {
        const matchedName = getWidgetNameOrLabel(targetWidget);
        if (matchedName && matchedName !== name) {
            targetWidget = undefined;
        }
    }
    if (!targetWidget && name) {
        targetWidget = widgets.find((widget) => getWidgetNameOrLabel(widget) === name);
    }
    if (!targetWidget)
        return null;
    return { targetNode, targetWidget };
}
function resolveMirrorWidgetType(targetWidget) {
    const rawType = String(targetWidget?.type || "").trim().toLowerCase();
    if (rawType === "combo" || rawType === "dropdown")
        return "combo";
    if (rawType === "toggle" || rawType === "bool" || rawType === "boolean")
        return "toggle";
    if (rawType === "number" || rawType === "slider" || rawType === "int" || rawType === "float") {
        return "number";
    }
    if (rawType === "text" || rawType === "string" || rawType === "textarea")
        return "text";
    if (Array.isArray(targetWidget?.options?.values) || typeof targetWidget?.options?.values === "function") {
        return "combo";
    }
    if (typeof targetWidget?.value === "boolean")
        return "toggle";
    if (typeof targetWidget?.value === "number")
        return "number";
    return "text";
}
function createMirrorWidget(sourceNode, record) {
    const bindings = getMirrorBindings(sourceNode);
    const widgetKey = record.widgetKey;
    if (bindings.has(widgetKey))
        return;
    const resolved = resolveTargetWidget(record);
    const targetNode = resolved?.targetNode || null;
    const targetWidget = resolved?.targetWidget || null;
    const mirrorType = targetWidget ? resolveMirrorWidgetType(targetWidget) : record.mirrorType;
    const widgetLabel = getWidgetDisplayName(targetNode || { title: record.targetNodeType, type: record.targetNodeType }, record.widgetName);
    const widgetOptions = targetWidget?.options ? { ...targetWidget.options } : toSerializable(record.options);
    const initialValue = targetWidget ? targetWidget.value : record.value;
    let syncing = false;
    const mirrorWidget = sourceNode.addWidget(mirrorType, widgetLabel, initialValue, (value) => {
        if (syncing)
            return;
        syncing = true;
        try {
            const target = resolveTargetWidget(record);
            if (target) {
                target.targetWidget.value = value;
                if (typeof target.targetWidget.callback === "function") {
                    target.targetWidget.callback(value);
                }
                if (typeof target.targetNode.onWidgetChanged === "function") {
                    target.targetNode.onWidgetChanged(target.targetWidget.name, value, null, target.targetWidget);
                }
            }
            record.value = toSerializable(value);
            syncCollectedRecordsToProperties(sourceNode);
            if (typeof app.graph?.setDirtyCanvas === "function") {
                app.graph.setDirtyCanvas(true, true);
            }
        }
        finally {
            syncing = false;
        }
    }, widgetOptions);
    if (!mirrorWidget)
        return;
    mirrorWidget.value = initialValue;
    mirrorWidget.__a1rWidgetKey = widgetKey;
    const syncTimerId = window.setInterval(() => {
        const stillMounted = Array.isArray(sourceNode.widgets) && sourceNode.widgets.includes(mirrorWidget);
        if (!stillMounted) {
            clearInterval(syncTimerId);
            bindings.delete(widgetKey);
            return;
        }
        const latest = resolveTargetWidget(record);
        const latestTargetNode = latest?.targetNode || null;
        const latestTargetWidget = latest?.targetWidget || null;
        const activeBinding = bindings.get(widgetKey);
        if (activeBinding) {
            activeBinding.targetNode = latestTargetNode;
            activeBinding.targetWidget = latestTargetWidget;
        }
        if (mirrorType === "combo" && mirrorWidget.options && latestTargetWidget?.options?.values !== undefined) {
            const values = typeof latestTargetWidget.options.values === "function"
                ? latestTargetWidget.options.values()
                : latestTargetWidget.options.values;
            mirrorWidget.options.values = values;
            record.options = toSerializable(mirrorWidget.options);
        }
        const targetValue = latestTargetWidget ? latestTargetWidget.value : record.value;
        if (!syncing && mirrorWidget.value !== targetValue) {
            syncing = true;
            try {
                mirrorWidget.value = targetValue;
                if (typeof mirrorWidget.callback === "function") {
                    mirrorWidget.callback(targetValue);
                }
            }
            finally {
                syncing = false;
            }
        }
        record.value = toSerializable(mirrorWidget.value);
    }, 160);
    const originalOnRemove = mirrorWidget.onRemove;
    mirrorWidget.onRemove = function (...args) {
        clearInterval(syncTimerId);
        bindings.delete(widgetKey);
        if (typeof originalOnRemove === "function") {
            originalOnRemove.apply(this, args);
        }
    };
    bindings.set(widgetKey, {
        widgetKey,
        mirrorWidget,
        targetNode,
        targetWidget,
        syncTimerId,
    });
    ensureCollectButtonAtBottom(sourceNode);
    syncCollectedRecordsToProperties(sourceNode);
}
function restoreCollectedWidgets(node) {
    const records = getCollectedRecords(node);
    if (records.size === 0)
        return;
    const lockedSize = snapshotNodeSize(node);
    records.forEach((record) => {
        createMirrorWidget(node, record);
    });
    ensureCollectButtonAtBottom(node);
    restoreNodeSize(node, lockedSize);
    if (typeof app.graph?.setDirtyCanvas === "function") {
        app.graph.setDirtyCanvas(true, true);
    }
}
function collectSelectedWidgetsToNode(sourceNode) {
    const records = getCollectedRecords(sourceNode);
    const selectedKeys = Array.from(selectedWidgetKeys);
    if (selectedKeys.length === 0)
        return;
    const lockedSize = snapshotNodeSize(sourceNode);
    selectedKeys.forEach((widgetKey) => {
        const payload = selectedWidgetPayloads.get(widgetKey);
        if (!payload)
            return;
        const resolved = resolveTargetWidget(payload);
        if (!resolved)
            return;
        let record = records.get(widgetKey);
        if (!record) {
            record = createRecordFromPayload(payload, resolved.targetWidget);
            records.set(widgetKey, record);
        }
        else {
            record.sourceNodeId = payload.sourceNodeId;
            record.targetNodeId = payload.targetNodeId;
            record.targetNodeType = payload.targetNodeType;
            record.widgetName = payload.widgetName;
            record.widgetIndex = payload.widgetIndex;
            record.mirrorType = resolveMirrorWidgetType(resolved.targetWidget);
            record.options = toSerializable(resolved.targetWidget?.options);
        }
        createMirrorWidget(sourceNode, record);
    });
    syncCollectedRecordsToProperties(sourceNode);
    restoreNodeSize(sourceNode, lockedSize);
    if (typeof app.graph?.setDirtyCanvas === "function") {
        app.graph.setDirtyCanvas(true, true);
    }
}
// === 覆盖层工具函数 === //
function stopCollectorEvent(e) {
    e.preventDefault();
    e.stopPropagation();
}
function isCollectorInternalTarget(target) {
    if (!(target instanceof Element))
        return false;
    return Boolean(target.closest(".collector-overlay, .collector-overlay-container, .collector-overlay-delete, .collector-button, .collector-container"));
}
function shouldGuardCollectorHostEvent(target) {
    if (collectingNodeId === null)
        return false;
    if (!(target instanceof Element))
        return false;
    const host = target.closest(".collector-target-host");
    if (!host)
        return false;
    return !isCollectorInternalTarget(target);
}
function stopCollectorHostEvent(e) {
    if (!shouldGuardCollectorHostEvent(e.target))
        return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
}
function installCollectorCaptureGuards() {
    if (collectCaptureGuardsInstalled)
        return;
    const guardedEvents = [
        "pointerdown",
        "pointerup",
        "pointermove",
        "click",
        "dblclick",
        "contextmenu",
        "mousedown",
        "mouseup",
        "mousemove",
    ];
    guardedEvents.forEach((eventName) => {
        document.addEventListener(eventName, stopCollectorHostEvent, true);
    });
    collectCaptureGuardsInstalled = true;
}
function uninstallCollectorCaptureGuards() {
    if (!collectCaptureGuardsInstalled)
        return;
    const guardedEvents = [
        "pointerdown",
        "pointerup",
        "pointermove",
        "click",
        "dblclick",
        "contextmenu",
        "mousedown",
        "mouseup",
        "mousemove",
    ];
    guardedEvents.forEach((eventName) => {
        document.removeEventListener(eventName, stopCollectorHostEvent, true);
    });
    collectCaptureGuardsInstalled = false;
}
function bindCollectorGapGuards(el) {
    const guardedEvents = [
        "pointerdown",
        "pointerup",
        "pointermove",
        "click",
        "contextmenu",
        "mousedown",
        "mouseup",
        "mousemove",
        "dblclick",
    ];
    guardedEvents.forEach((eventName) => {
        el.addEventListener(eventName, stopCollectorEvent);
    });
}
function updateOverlayContainerBounds(host) {
    const container = host.querySelector(".collector-overlay-container");
    if (!container)
        return;
    const rows = Array.from(host.querySelectorAll(":scope > .collector-target-row"));
    if (rows.length === 0) {
        container.style.top = "0px";
        container.style.height = "0px";
        return;
    }
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    rows.forEach((row) => {
        top = Math.min(top, row.offsetTop);
        bottom = Math.max(bottom, row.offsetTop + row.offsetHeight);
    });
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) {
        container.style.top = "0px";
        container.style.height = "0px";
        return;
    }
    container.style.top = `${top}px`;
    container.style.height = `${bottom - top}px`;
}
function setOverlayContainerCursorMode(container, cursorMode) {
    container.dataset.cursorMode = cursorMode;
    container.classList.toggle("collector-overlay-container-mirror", cursorMode === "grab");
}
function getOrCreateOverlayContainer(host, cursorMode) {
    const existed = host.querySelector(".collector-overlay-container");
    if (existed) {
        setOverlayContainerCursorMode(existed, cursorMode);
        updateOverlayContainerBounds(host);
        return existed;
    }
    const container = createContainer();
    container.classList.add("collector-overlay-container");
    host.classList.add("collector-target-host");
    host.appendChild(container);
    bindCollectorGapGuards(container);
    setOverlayContainerCursorMode(container, cursorMode);
    updateOverlayContainerBounds(host);
    mountedOverlayHosts.add(host);
    mountedOverlayContainers.add(container);
    return container;
}
function createWidgetKey(targetNodeId, widgetName, widgetIndex) {
    return String(targetNodeId) + "::" + widgetName + "::" + String(widgetIndex);
}
function applyOverlaySelectionState(overlay, widgetKey) {
    if (selectedWidgetKeys.has(widgetKey)) {
        overlay.classList.add("collector-selected");
    }
    else {
        overlay.classList.remove("collector-selected");
    }
}
function toggleOverlaySelection(overlay, widgetKey) {
    if (selectedWidgetKeys.has(widgetKey)) {
        selectedWidgetKeys.delete(widgetKey);
        overlay.classList.remove("collector-selected");
        return false;
    }
    selectedWidgetKeys.add(widgetKey);
    overlay.classList.add("collector-selected");
    return true;
}
function setButtonText(button, text) {
    const textEl = button.querySelector(".a1r-button-text");
    if (textEl) {
        textEl.textContent = text;
    }
    else {
        button.textContent = text;
    }
}
// function mountCanvasBlocker() {
//   if (canvasBlocker) return
//   canvasBlocker = document.createElement("div")
//   canvasBlocker.classList.add("collector-canvas-blocker")
//   bindCollectorGapGuards(canvasBlocker)
//   document.body.appendChild(canvasBlocker)
// }
// function unmountCanvasBlocker() {
//   if (!canvasBlocker) return
//   canvasBlocker.remove()
//   canvasBlocker = null
// }
function clearAllOverlays() {
    finishMirrorDrag(false);
    clearMirrorDropIndicators();
    for (const row of mountedRows) {
        row.classList.remove("collector-target-row");
    }
    mountedRows.clear();
    for (const overlay of mountedOverlays) {
        overlay.remove();
    }
    mountedOverlays.clear();
    mirrorOverlayByWidgetKey.clear();
    for (const container of mountedOverlayContainers) {
        container.remove();
    }
    mountedOverlayContainers.clear();
    for (const host of mountedOverlayHosts) {
        host.classList.remove("collector-target-host");
    }
    mountedOverlayHosts.clear();
}
// === 目标 widget 元数据解析 === //
function getWidgetNameFromGraph(targetNodeId, widgetIndex) {
    const graph = app.graph;
    const targetNode = graph?.getNodeById?.(targetNodeId);
    const widgets = targetNode?.widgets;
    if (!Array.isArray(widgets))
        return "";
    const widget = widgets[widgetIndex];
    if (!widget)
        return "";
    if (typeof widget.name === "string" && widget.name.trim()) {
        return widget.name.trim();
    }
    if (typeof widget.label === "string" && widget.label.trim()) {
        return widget.label.trim();
    }
    return "";
}
function extractWidgetName(row, targetNodeId, widgetIndex) {
    const labeled = row.querySelector("[aria-label]");
    const fromAria = labeled?.getAttribute("aria-label")?.trim();
    if (fromAria)
        return fromAria;
    const labelText = row.querySelector(".content-center-safe")?.textContent?.trim();
    if (labelText)
        return labelText;
    const fromGraph = getWidgetNameFromGraph(targetNodeId, widgetIndex);
    if (fromGraph)
        return fromGraph;
    const placeholderEl = row.querySelector("textarea[placeholder], input[placeholder]");
    const fromPlaceholder = placeholderEl?.getAttribute("placeholder")?.trim();
    if (fromPlaceholder)
        return fromPlaceholder;
    return "widget";
}
function selectTargetNodeForCollect(targetNodeId) {
    const canvas = app.canvas;
    const graph = app.graph;
    if (!canvas || !graph)
        return;
    const targetNode = graph.getNodeById?.(targetNodeId);
    if (!targetNode)
        return;
    if (typeof canvas.deselectAll === "function") {
        canvas.deselectAll();
    }
    if (!targetNode.flags?.pinned && typeof canvas.bringToFront === "function") {
        canvas.bringToFront(targetNode);
    }
    if (typeof canvas.setDirty === "function") {
        canvas.setDirty(true, true);
    }
}
function onWidgetPicked(payload, isSelected) {
    const widgetKey = createWidgetKey(payload.targetNodeId, payload.widgetName, payload.widgetIndex);
    if (isSelected) {
        selectedWidgetPayloads.set(widgetKey, payload);
    }
    else {
        selectedWidgetPayloads.delete(widgetKey);
    }
    console.log("[a1rworkshop.widgetcollector] Widget picked:", payload);
}
function isOverlayOnlyMutation(mutation) {
    if (mutation.type !== "childList")
        return false;
    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    if (changedNodes.length === 0)
        return false;
    return changedNodes.every((node) => node instanceof HTMLElement &&
        (node.classList.contains("collector-overlay") || node.classList.contains("collector-overlay-container")));
}
function hasRelevantMutations(mutations) {
    for (const mutation of mutations) {
        if (mutation.type !== "childList")
            continue;
        if (isOverlayOnlyMutation(mutation))
            continue;
        return true;
    }
    return false;
}
// === 覆盖层挂载 === //
function mountSourceMirrorOverlay(row, sourceNode, sourceNodeId, usedMirrorWidgetKeys) {
    const mirrorWidget = resolveSourceMirrorWidgetForRow(sourceNode, row, usedMirrorWidgetKeys);
    const widgetKey = String(mirrorWidget?.__a1rWidgetKey || "").trim();
    if (!widgetKey)
        return;
    usedMirrorWidgetKeys.add(widgetKey);
    const records = getCollectedRecords(sourceNode);
    const record = records.get(widgetKey);
    const sourceWidgetIndex = Array.isArray(sourceNode.widgets) ? sourceNode.widgets.indexOf(mirrorWidget) : -1;
    const sourceWidgetName = getWidgetNameOrLabel(mirrorWidget);
    const overlay = createOverlay();
    overlay.classList.add("collector-overlay", "collector-overlay-mirror");
    overlay.dataset.nodeId = String(sourceNodeId);
    overlay.dataset.nodeType = String(sourceNode?.type || "");
    overlay.dataset.widgetName = record?.widgetName || getWidgetNameOrLabel(mirrorWidget) || "widget";
    overlay.dataset.widgetIndex = String(sourceWidgetIndex);
    overlay.dataset.widgetKey = widgetKey;
    overlay.dataset.sourceWidgetName = sourceWidgetName;
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "collector-overlay-delete";
    deleteButton.textContent = "x";
    deleteButton.title = "remove mirrored widget";
    deleteButton.setAttribute("aria-label", "remove mirrored widget");
    bindCollectorGapGuards(deleteButton);
    deleteButton.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    deleteButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeCollectedWidget(sourceNode, widgetKey);
    });
    overlay.appendChild(deleteButton);
    overlay.addEventListener("pointerdown", (e) => {
        if (e.button !== 0)
            return;
        e.preventDefault();
        e.stopPropagation();
        if (draggingMirrorWidgetKey)
            return;
        if (typeof overlay.setPointerCapture === "function") {
            overlay.setPointerCapture(e.pointerId);
        }
        beginMirrorDrag(sourceNode, sourceNodeId, widgetKey, e.pointerId);
        updateMirrorDropTargetFromPointer(e.clientX, e.clientY);
    });
    overlay.addEventListener("pointermove", (e) => {
        if (mirrorDragPointerId === null || e.pointerId !== mirrorDragPointerId)
            return;
        e.preventDefault();
        e.stopPropagation();
        updateMirrorDropTargetFromPointer(e.clientX, e.clientY);
    });
    overlay.addEventListener("pointerup", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof overlay.releasePointerCapture === "function" && overlay.hasPointerCapture(e.pointerId)) {
            overlay.releasePointerCapture(e.pointerId);
        }
        if (mirrorDragPointerId !== null && mirrorDragPointerId === e.pointerId) {
            finishMirrorDrag(true);
            return;
        }
    });
    overlay.addEventListener("pointercancel", (e) => {
        if (typeof overlay.releasePointerCapture === "function" && overlay.hasPointerCapture(e.pointerId)) {
            overlay.releasePointerCapture(e.pointerId);
        }
        if (mirrorDragPointerId !== null && mirrorDragPointerId === e.pointerId) {
            finishMirrorDrag(false);
            return;
        }
    });
    overlay.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    mirrorOverlayByWidgetKey.set(widgetKey, overlay);
    applyMirrorOverlayManageState(overlay);
    row.classList.add("collector-target-row");
    mountedRows.add(row);
    row.appendChild(overlay);
    mountedOverlays.add(overlay);
}
function mountWidgetOverlays(sourceNode) {
    isMountingOverlays = true;
    try {
        clearAllOverlays();
        const sourceNodeId = Number(sourceNode.id);
        if (!Number.isFinite(sourceNodeId))
            return;
        const perNodeIndex = new Map();
        const touchedHosts = new Set();
        const usedMirrorWidgetKeys = new Set();
        const rows = document.querySelectorAll(".lg-node-widget");
        rows.forEach((row) => {
            const metaEl = row.querySelector("[node-id]");
            if (!metaEl)
                return;
            const targetNodeId = Number(metaEl.getAttribute("node-id"));
            if (!Number.isFinite(targetNodeId))
                return;
            const idx = perNodeIndex.get(targetNodeId) ?? 0;
            perNodeIndex.set(targetNodeId, idx + 1);
            if (targetNodeId === sourceNodeId) {
                mountSourceMirrorOverlay(row, sourceNode, sourceNodeId, usedMirrorWidgetKeys);
                const host = row.closest(".lg-node-widgets");
                if (host) {
                    touchedHosts.add(host);
                    getOrCreateOverlayContainer(host, "grab");
                }
                return;
            }
            const targetNodeType = (metaEl.getAttribute("node-type") || "").trim();
            const widgetName = extractWidgetName(row, targetNodeId, idx);
            const overlay = createOverlay();
            overlay.classList.add("collector-overlay");
            overlay.dataset.nodeId = String(targetNodeId);
            overlay.dataset.nodeType = targetNodeType;
            overlay.dataset.widgetName = widgetName;
            overlay.dataset.widgetIndex = String(idx);
            const widgetKey = createWidgetKey(targetNodeId, widgetName, idx);
            overlay.dataset.widgetKey = widgetKey;
            applyOverlaySelectionState(overlay, widgetKey);
            overlay.addEventListener("pointerdown", (e) => {
                if (e.button !== 0)
                    return;
                e.preventDefault();
                e.stopPropagation();
                onWidgetPicked({
                    sourceNodeId,
                    targetNodeId,
                    targetNodeType,
                    widgetName,
                    widgetIndex: idx,
                }, toggleOverlaySelection(overlay, widgetKey));
                if (!selectedWidgetKeys.has(widgetKey)) {
                    return;
                }
                selectTargetNodeForCollect(targetNodeId);
            });
            overlay.addEventListener("pointerup", (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            overlay.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            row.classList.add("collector-target-row");
            mountedRows.add(row);
            row.appendChild(overlay);
            const host = row.closest(".lg-node-widgets");
            if (!host)
                return;
            touchedHosts.add(host);
            getOrCreateOverlayContainer(host, "pointer");
            mountedOverlays.add(overlay);
        });
        touchedHosts.forEach((host) => {
            updateOverlayContainerBounds(host);
        });
        if (mirrorManageNodeId !== null &&
            mirrorManageWidgetKey !== null &&
            mirrorManageNodeId === sourceNodeId &&
            !mirrorOverlayByWidgetKey.has(mirrorManageWidgetKey)) {
            setMirrorManageState(null, null);
        }
    }
    finally {
        isMountingOverlays = false;
    }
}
// === 收集模式生命周期 === //
function activateCollect(node) {
    console.log("[a1rworkshop.widgetcollector] Collecting widgets...");
    collectingNodeId = Number(node.id);
    document.documentElement.classList.add("collector-active");
    installCollectorCaptureGuards();
    // mountCanvasBlocker()
    if (typeof app.canvas?.deselectAll === "function") {
        app.canvas.deselectAll();
    }
    mountWidgetOverlays(node);
    if (collectObserver) {
        collectObserver.disconnect();
        collectObserver = null;
    }
    collectObserver = new MutationObserver((mutations) => {
        if (isMountingOverlays)
            return;
        if (!hasRelevantMutations(mutations))
            return;
        scheduleOverlayRefresh(node);
    });
    collectObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });
}
function deactivateCollect() {
    console.log("[a1rworkshop.widgetcollector] Collecting stopped.");
    collectingNodeId = null;
    document.documentElement.classList.remove("collector-active");
    uninstallCollectorCaptureGuards();
    // unmountCanvasBlocker()
    if (collectObserver) {
        collectObserver.disconnect();
        collectObserver = null;
    }
    if (collectRefreshRaf != null) {
        cancelAnimationFrame(collectRefreshRaf);
        collectRefreshRaf = null;
    }
    finishMirrorDrag(false);
    clearMirrorDropIndicators();
    setMirrorManageState(null, null);
    selectedWidgetKeys.clear();
    selectedWidgetPayloads.clear();
    clearAllOverlays();
}
function setCollectButtonInactive(button) {
    setButtonText(button, "collect widgets");
    button.classList.remove("collector-button-active");
}
function setCollectButtonActive(button) {
    setButtonText(button, "collecting done");
    button.classList.add("collector-button-active");
}
function collectWidgets(node, button) {
    const collectButton = button || node.__a1rCollectButton;
    if (!collectButton)
        return;
    const nodeId = Number(node.id);
    if (!isCollecting || collectingNodeId !== nodeId) {
        if (isCollecting && collectingNodeId !== null && collectingNodeId !== nodeId) {
            const previousNode = app.graph?.getNodeById?.(collectingNodeId);
            const previousButton = previousNode?.__a1rCollectButton;
            if (previousButton) {
                setCollectButtonInactive(previousButton);
            }
            deactivateCollect();
        }
        isCollecting = true;
        setCollectButtonActive(collectButton);
        activateCollect(node);
    }
    else {
        collectSelectedWidgetsToNode(node);
        isCollecting = false;
        setCollectButtonInactive(collectButton);
        deactivateCollect();
    }
}
// === 扩展入口 === //
app.registerExtension({
    name: "a1rworkshop.widgetcollector",
    async setup() {
        initGlobalThemeCSSVar();
        injectCSS("../../css/a1r-collector.css", import.meta.url);
    },
    async nodeCreated(node) {
        if (node.comfyClass !== "WidgetCollector")
            return;
        node.properties = node.properties || {};
        getCollectedRecords(node);
        cleanupMirrorBindings(node);
        const originalOnSerialize = node.onSerialize;
        node.onSerialize = function (o) {
            if (typeof originalOnSerialize === "function") {
                originalOnSerialize.apply(this, arguments);
            }
            syncCollectedRecordsToProperties(this);
            if (o && typeof o === "object") {
                o.properties = o.properties || {};
                o.properties._collected_widgets = this.properties?._collected_widgets || [];
            }
        };
        const originalOnConfigure = node.onConfigure;
        node.onConfigure = function (info) {
            if (typeof originalOnConfigure === "function") {
                originalOnConfigure.apply(this, arguments);
            }
            const rawRecords = info?.properties?._collected_widgets ?? this.properties?._collected_widgets;
            rebuildCollectedRecords(this, rawRecords);
            restoreCollectedWidgets(this);
        };
        const originalOnRemoved = node.onRemoved;
        node.onRemoved = function (...args) {
            const removedNodeId = Number(this.id);
            if (collectingNodeId !== null && collectingNodeId === removedNodeId) {
                isCollecting = false;
                deactivateCollect();
                if (this.__a1rCollectButton) {
                    setCollectButtonInactive(this.__a1rCollectButton);
                }
            }
            cleanupMirrorBindings(this);
            if (typeof originalOnRemoved === "function") {
                originalOnRemoved.apply(this, args);
            }
        };
        createActiveButton(node);
        restoreCollectedWidgets(node);
    },
});
