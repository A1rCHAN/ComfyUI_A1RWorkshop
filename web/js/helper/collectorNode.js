import { app } from "/scripts/app.js";
import { createContainer, createOverlay } from "../theme/themeUtils.js";
import { ensureWidgetAtBottom, getCollectorSessionState, syncCollectorActiveClass, setCollectorButtonState, toggleCollectorState, emitWidgetCollectorPickRequest, extractCollectorRowDisplayName, getNodeTitleSnapshot, getWidgetNameOrLabel, watchNodeTitleChanges, } from "./collector.js";
export const COLLECTOR_SESSION_KEY = "modeCollector";
export const BUTTON_TEXTS = {
    inactive: "collect nodes",
    active: "collecting done",
};
const BUTTON_ACTIVE_CLASS = "collector-button-active";
let collectObserver = null;
let collectRefreshRaf = null;
let collectCaptureGuardsInstalled = false;
let isMountingOverlays = false;
const mountedRows = new Set();
const mountedOverlays = new Set();
const mountedOverlayHosts = new Set();
const mountedOverlayContainers = new Set();
const selectedNodeKeys = new Set();
const selectedNodePayloads = new Map();
const mirrorOverlayByNodeKey = new Map();
const mirrorDropPositionByNodeKey = new Map();
let mirrorManageNodeId = null;
let mirrorManageNodeKey = null;
let draggingMirrorNodeKey = null;
let mirrorDragPointerId = null;
let mirrorDragSourceNode = null;
let mirrorDragSourceNodeId = null;
let mirrorDropTargetNodeKey = null;
let mirrorDropTargetPosition = null;
function getCollectingNodeId() {
    return getCollectorSessionState(COLLECTOR_SESSION_KEY).collectingNodeId;
}
function getMirrorBindings(node) {
    if (!(node.__a1rModeMirrorBindings instanceof Map)) {
        node.__a1rModeMirrorBindings = new Map();
    }
    return node.__a1rModeMirrorBindings;
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
export function normalizeDisabledMode(mode) {
    return Number(mode) === 2 ? 2 : 4;
}
function createNodeKey(targetNodeId) {
    return String(targetNodeId);
}
function normalizePersistedRecord(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const targetNodeId = Number(raw.targetNodeId);
    if (!Number.isFinite(targetNodeId))
        return null;
    const targetNodeType = String(raw.targetNodeType || "").trim();
    const targetNodeTitle = String(raw.targetNodeTitle || "").trim();
    const nodeKey = String(raw.nodeKey || createNodeKey(targetNodeId)).trim();
    if (!nodeKey)
        return null;
    return {
        sourceNodeId: Number(raw.sourceNodeId),
        targetNodeId,
        targetNodeType,
        targetNodeTitle,
        nodeKey,
        enabled: Boolean(raw.enabled ?? true),
        disabledMode: normalizeDisabledMode(raw.disabledMode),
    };
}
export function getCollectedRecords(node) {
    if (node.__a1rCollectedNodeRecords instanceof Map) {
        return node.__a1rCollectedNodeRecords;
    }
    const records = new Map();
    const persisted = node?.properties?._collected_nodes;
    if (Array.isArray(persisted)) {
        persisted.forEach((raw) => {
            const record = normalizePersistedRecord(raw);
            if (!record)
                return;
            records.set(record.nodeKey, record);
        });
    }
    node.__a1rCollectedNodeRecords = records;
    return records;
}
export function syncCollectedRecordsToProperties(node) {
    const records = Array.from(getCollectedRecords(node).values()).map((record) => ({
        ...record,
        enabled: Boolean(record.enabled),
        disabledMode: normalizeDisabledMode(record.disabledMode),
    }));
    node.properties = node.properties || {};
    node.properties._collected_nodes = toSerializable(records) || [];
    node.properties._default_disabled_mode = getDefaultDisabledMode(node);
}
export function rebuildCollectedRecords(node, rawRecords) {
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
        records.set(record.nodeKey, record);
    });
    syncCollectedRecordsToProperties(node);
}
function createRecordFromPayload(payload, targetNode, sourceNode) {
    const enabled = targetNode ? Number(targetNode.mode) === 0 : true;
    return {
        ...payload,
        nodeKey: createNodeKey(payload.targetNodeId),
        enabled,
        disabledMode: getDefaultDisabledMode(sourceNode),
    };
}
function resolveTargetNode(record) {
    return app.graph?.getNodeById?.(record.targetNodeId) || null;
}
function applyTargetNodeMode(targetNode, enabled, disabledMode) {
    if (!targetNode)
        return;
    targetNode.mode = enabled ? 0 : normalizeDisabledMode(disabledMode);
    if (typeof app.graph?.setDirtyCanvas === "function") {
        app.graph.setDirtyCanvas(true, true);
    }
}
export function getDefaultDisabledMode(node) {
    return normalizeDisabledMode(node?.properties?._default_disabled_mode);
}
export function setDefaultDisabledMode(node, mode) {
    node.properties = node.properties || {};
    node.properties._default_disabled_mode = normalizeDisabledMode(mode);
    const records = getCollectedRecords(node);
    records.forEach((record) => {
        record.disabledMode = normalizeDisabledMode(mode);
        if (!record.enabled) {
            applyTargetNodeMode(resolveTargetNode(record), false, record.disabledMode);
        }
    });
    syncCollectedRecordsToProperties(node);
}
function isMirrorWidget(widget) {
    return typeof widget?.__a1rNodeKey === "string" && widget.__a1rNodeKey.trim().length > 0;
}
function getVisibleMirrorWidgets(node) {
    if (!Array.isArray(node?.widgets))
        return [];
    return node.widgets.filter((widget) => isMirrorWidget(widget));
}
function clearMirrorDropIndicators() {
    for (const overlay of mirrorOverlayByNodeKey.values()) {
        overlay.classList.remove("collector-mirror-drop-before", "collector-mirror-drop-after");
    }
    mirrorDropPositionByNodeKey.clear();
}
function clearMirrorDraggingIndicator() {
    for (const overlay of mirrorOverlayByNodeKey.values()) {
        overlay.classList.remove("collector-mirror-dragging");
    }
}
function applyMirrorOverlayManageState(overlay) {
    const nodeId = Number(overlay.dataset.nodeId);
    const nodeKey = String(overlay.dataset.widgetKey || "");
    const isActive = Number.isFinite(nodeId) &&
        mirrorManageNodeId !== null &&
        mirrorManageNodeKey !== null &&
        mirrorManageNodeId === nodeId &&
        mirrorManageNodeKey === nodeKey;
    overlay.classList.toggle("collector-mirror-manage", isActive);
    overlay.draggable = false;
}
function setMirrorManageState(nodeId, nodeKey) {
    mirrorManageNodeId = nodeId;
    mirrorManageNodeKey = nodeKey;
    for (const overlay of mirrorOverlayByNodeKey.values()) {
        applyMirrorOverlayManageState(overlay);
    }
}
function updateMirrorDropTargetFromPointer(clientX, clientY) {
    clearMirrorDropIndicators();
    mirrorDropTargetNodeKey = null;
    mirrorDropTargetPosition = null;
    if (!draggingMirrorNodeKey || mirrorDragSourceNodeId === null)
        return;
    const hit = document.elementFromPoint(clientX, clientY);
    if (!(hit instanceof HTMLElement))
        return;
    const targetOverlay = hit.closest(".collector-overlay-mirror");
    if (!targetOverlay)
        return;
    const targetNodeId = Number(targetOverlay.dataset.nodeId);
    const targetNodeKey = String(targetOverlay.dataset.widgetKey || "");
    if (!Number.isFinite(targetNodeId))
        return;
    if (targetNodeId !== mirrorDragSourceNodeId)
        return;
    if (!targetNodeKey || targetNodeKey === draggingMirrorNodeKey)
        return;
    const rect = targetOverlay.getBoundingClientRect();
    const position = clientY <= rect.top + rect.height / 2 ? "before" : "after";
    mirrorDropTargetNodeKey = targetNodeKey;
    mirrorDropTargetPosition = position;
    mirrorDropPositionByNodeKey.set(targetNodeKey, position);
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
    const movedNodeKey = draggingMirrorNodeKey;
    const sourceNode = mirrorDragSourceNode;
    const targetNodeKey = mirrorDropTargetNodeKey;
    const targetPosition = mirrorDropTargetPosition;
    detachMirrorDragPointerListeners();
    clearMirrorDropIndicators();
    clearMirrorDraggingIndicator();
    draggingMirrorNodeKey = null;
    mirrorDragPointerId = null;
    mirrorDragSourceNode = null;
    mirrorDragSourceNodeId = null;
    mirrorDropTargetNodeKey = null;
    mirrorDropTargetPosition = null;
    if (commitReorder && movedNodeKey && sourceNode && targetNodeKey && targetPosition) {
        reorderCollectedNodes(sourceNode, movedNodeKey, targetNodeKey, targetPosition);
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
function beginMirrorDrag(sourceNode, sourceNodeId, nodeKey, pointerId) {
    draggingMirrorNodeKey = nodeKey;
    mirrorDragPointerId = pointerId;
    mirrorDragSourceNode = sourceNode;
    mirrorDragSourceNodeId = sourceNodeId;
    mirrorDropTargetNodeKey = null;
    mirrorDropTargetPosition = null;
    setMirrorManageState(sourceNodeId, nodeKey);
    const sourceOverlay = mirrorOverlayByNodeKey.get(nodeKey);
    if (sourceOverlay) {
        sourceOverlay.classList.add("collector-mirror-dragging");
    }
    window.addEventListener("pointermove", onMirrorDragPointerMove, true);
    window.addEventListener("pointerup", onMirrorDragPointerUp, true);
    window.addEventListener("pointercancel", onMirrorDragPointerCancel, true);
}
function scheduleOverlayRefresh(sourceNode) {
    if (isMountingOverlays)
        return;
    if (collectRefreshRaf != null) {
        cancelAnimationFrame(collectRefreshRaf);
        collectRefreshRaf = null;
    }
    collectRefreshRaf = window.requestAnimationFrame(() => {
        collectRefreshRaf = null;
        const collectingNodeId = getCollectingNodeId();
        if (collectingNodeId === null)
            return;
        if (collectingNodeId !== Number(sourceNode.id))
            return;
        mountNodeTitleOverlays(sourceNode);
    });
}
function removeMirrorWidgetByKey(node, nodeKey) {
    const bindings = getMirrorBindings(node);
    const binding = bindings.get(nodeKey);
    if (binding) {
        clearInterval(binding.syncTimerId);
        if (binding.titleWatchDisposer) {
            binding.titleWatchDisposer();
            binding.titleWatchDisposer = null;
        }
        binding.titleWatchTargetNode = null;
        bindings.delete(nodeKey);
    }
    if (!Array.isArray(node.widgets))
        return;
    const idx = node.widgets.findIndex((widget) => String(widget?.__a1rNodeKey || "") === nodeKey);
    if (idx < 0)
        return;
    const removed = node.widgets[idx];
    node.widgets.splice(idx, 1);
    if (removed && typeof removed.onRemove === "function") {
        removed.onRemove();
    }
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
function resolveMirrorWidgetDisplayName(record, targetNode) {
    return getNodeTitleSnapshot(targetNode, record.targetNodeTitle || record.targetNodeType);
}
function applyMirrorWidgetDisplayName(mirrorWidget, displayName) {
    const nextLabel = String(displayName || "").trim() || "node";
    let changed = false;
    if (mirrorWidget?.name !== nextLabel) {
        mirrorWidget.name = nextLabel;
        changed = true;
    }
    if (typeof mirrorWidget?.label === "string" && mirrorWidget.label !== nextLabel) {
        mirrorWidget.label = nextLabel;
        changed = true;
    }
    return changed;
}
function notifyMirrorWidgetMetaChanged(node) {
    if (!Array.isArray(node?.widgets))
        return;
    try {
        node.widgets = [...node.widgets];
    }
    catch {
    }
    try {
        node.widgets.splice(0, 0);
        node.widgets.splice(0, 0);
    }
    catch {
    }
    if (typeof node?.onResize === "function") {
        node.onResize();
    }
    if (typeof node?.update === "function") {
        node.update();
    }
}
function refreshMirrorWidgetDisplayName(binding, record, targetNode = binding.targetNode) {
    const displayName = resolveMirrorWidgetDisplayName(record, targetNode);
    if (!applyMirrorWidgetDisplayName(binding.mirrorWidget, displayName))
        return;
    notifyMirrorWidgetMetaChanged(binding.sourceNode);
    if (typeof app.graph?.setDirtyCanvas === "function") {
        app.graph.setDirtyCanvas(true, true);
    }
}
function rebindMirrorTitleWatch(binding, record, targetNode) {
    if (binding.titleWatchTargetNode === targetNode && binding.titleWatchDisposer)
        return;
    if (binding.titleWatchDisposer) {
        binding.titleWatchDisposer();
        binding.titleWatchDisposer = null;
    }
    binding.titleWatchTargetNode = targetNode;
    if (!targetNode)
        return;
    binding.titleWatchDisposer = watchNodeTitleChanges(targetNode, () => {
        binding.lastTargetTitle = getNodeTitleSnapshot(targetNode, record.targetNodeType);
        refreshMirrorWidgetDisplayName(binding, record, targetNode);
    });
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
    const collectingNodeId = getCollectingNodeId();
    if (collectingNodeId !== null && collectingNodeId === Number(node.id)) {
        scheduleOverlayRefresh(node);
    }
}
function reorderCollectedNodes(sourceNode, movedNodeKey, targetNodeKey, position) {
    if (!movedNodeKey || !targetNodeKey)
        return;
    if (movedNodeKey === targetNodeKey)
        return;
    const records = getCollectedRecords(sourceNode);
    if (!records.has(movedNodeKey) || !records.has(targetNodeKey))
        return;
    const orderedEntries = Array.from(records.entries());
    const movedIndex = orderedEntries.findIndex(([nodeKey]) => nodeKey === movedNodeKey);
    if (movedIndex < 0)
        return;
    const [movedEntry] = orderedEntries.splice(movedIndex, 1);
    let targetIndex = orderedEntries.findIndex(([nodeKey]) => nodeKey === targetNodeKey);
    if (targetIndex < 0)
        return;
    if (position === "after") {
        targetIndex += 1;
    }
    orderedEntries.splice(targetIndex, 0, movedEntry);
    records.clear();
    orderedEntries.forEach(([nodeKey, record]) => {
        records.set(nodeKey, record);
    });
    rebuildMirrorWidgetsInRecordOrder(sourceNode);
    if (mirrorManageNodeKey === movedNodeKey) {
        setMirrorManageState(Number(sourceNode.id), movedNodeKey);
    }
}
function removeCollectedNode(sourceNode, nodeKey) {
    const records = getCollectedRecords(sourceNode);
    const record = records.get(nodeKey);
    if (!record)
        return;
    const lockedSize = snapshotNodeSize(sourceNode);
    applyTargetNodeMode(resolveTargetNode(record), true, record.disabledMode);
    records.delete(nodeKey);
    removeMirrorWidgetByKey(sourceNode, nodeKey);
    syncCollectedRecordsToProperties(sourceNode);
    if (mirrorManageNodeKey === nodeKey) {
        setMirrorManageState(null, null);
    }
    restoreNodeSize(sourceNode, lockedSize);
    if (typeof app.graph?.setDirtyCanvas === "function") {
        app.graph.setDirtyCanvas(true, true);
    }
    const collectingNodeId = getCollectingNodeId();
    if (collectingNodeId !== null && collectingNodeId === Number(sourceNode.id)) {
        mountNodeTitleOverlays(sourceNode);
    }
    const overlay = mirrorOverlayByNodeKey.get(nodeKey);
    if (overlay) {
        overlay.remove();
        mirrorOverlayByNodeKey.delete(nodeKey);
        mountedOverlays.delete(overlay);
        mirrorDropPositionByNodeKey.delete(nodeKey);
    }
    selectedNodeKeys.delete(nodeKey);
    selectedNodePayloads.delete(nodeKey);
}
export function clearCollectedNodes(sourceNode) {
    const nodeKeys = Array.from(getCollectedRecords(sourceNode).keys());
    nodeKeys.forEach((nodeKey) => {
        removeCollectedNode(sourceNode, nodeKey);
    });
    syncCollectedRecordsToProperties(sourceNode);
}
export function restoreAllTargetNodeModes(sourceNode) {
    const records = getCollectedRecords(sourceNode);
    records.forEach((record) => {
        applyTargetNodeMode(resolveTargetNode(record), true, record.disabledMode);
    });
}
export function cleanupMirrorBindings(node) {
    const bindings = getMirrorBindings(node);
    for (const binding of bindings.values()) {
        clearInterval(binding.syncTimerId);
        if (binding.titleWatchDisposer) {
            binding.titleWatchDisposer();
            binding.titleWatchDisposer = null;
        }
        binding.titleWatchTargetNode = null;
    }
    bindings.clear();
}
function resolveSourceMirrorWidgetForRow(sourceNode, row, usedMirrorNodeKeys) {
    const visibleMirrorWidgets = getVisibleMirrorWidgets(sourceNode);
    if (visibleMirrorWidgets.length === 0)
        return null;
    const rowDisplayName = extractCollectorRowDisplayName(row);
    if (rowDisplayName) {
        const exactMatch = visibleMirrorWidgets.find((widget) => {
            const nodeKey = String(widget?.__a1rNodeKey || "");
            if (!nodeKey || usedMirrorNodeKeys.has(nodeKey))
                return false;
            return getWidgetNameOrLabel(widget) === rowDisplayName;
        });
        if (exactMatch)
            return exactMatch;
    }
    return (visibleMirrorWidgets.find((widget) => {
        const nodeKey = String(widget?.__a1rNodeKey || "");
        return nodeKey && !usedMirrorNodeKeys.has(nodeKey);
    }) || null);
}
function createMirrorWidget(sourceNode, record) {
    const bindings = getMirrorBindings(sourceNode);
    const nodeKey = record.nodeKey;
    if (bindings.has(nodeKey))
        return;
    const targetNode = resolveTargetNode(record);
    const widgetLabel = resolveMirrorWidgetDisplayName(record, targetNode);
    const initialValue = targetNode ? Number(targetNode.mode) === 0 : Boolean(record.enabled);
    let syncing = false;
    const mirrorWidget = sourceNode.addWidget("toggle", widgetLabel, initialValue, (value) => {
        if (syncing)
            return;
        syncing = true;
        try {
            const enabled = Boolean(value);
            record.enabled = enabled;
            applyTargetNodeMode(resolveTargetNode(record), enabled, record.disabledMode);
            syncCollectedRecordsToProperties(sourceNode);
            if (typeof app.graph?.setDirtyCanvas === "function") {
                app.graph.setDirtyCanvas(true, true);
            }
        }
        finally {
            syncing = false;
        }
    });
    if (!mirrorWidget)
        return;
    mirrorWidget.value = initialValue;
    mirrorWidget.__a1rNodeKey = nodeKey;
    const syncTimerId = window.setInterval(() => {
        const stillMounted = Array.isArray(sourceNode.widgets) && sourceNode.widgets.includes(mirrorWidget);
        if (!stillMounted) {
            clearInterval(syncTimerId);
            bindings.delete(nodeKey);
            return;
        }
        const latestTargetNode = resolveTargetNode(record);
        const latestTargetTitle = getNodeTitleSnapshot(latestTargetNode, record.targetNodeType);
        const activeBinding = bindings.get(nodeKey);
        if (activeBinding) {
            const targetNodeChanged = activeBinding.targetNode !== latestTargetNode;
            activeBinding.targetNode = latestTargetNode;
            if (targetNodeChanged) {
                activeBinding.lastTargetTitle = latestTargetTitle;
                rebindMirrorTitleWatch(activeBinding, record, latestTargetNode);
                refreshMirrorWidgetDisplayName(activeBinding, record, latestTargetNode);
            }
            else if (activeBinding.lastTargetTitle !== latestTargetTitle) {
                activeBinding.lastTargetTitle = latestTargetTitle;
                refreshMirrorWidgetDisplayName(activeBinding, record, latestTargetNode);
            }
        }
        const targetEnabled = latestTargetNode ? Number(latestTargetNode.mode) === 0 : Boolean(record.enabled);
        if (!syncing && Boolean(mirrorWidget.value) !== targetEnabled) {
            syncing = true;
            try {
                mirrorWidget.value = targetEnabled;
                if (typeof mirrorWidget.callback === "function") {
                    mirrorWidget.callback(targetEnabled);
                }
            }
            finally {
                syncing = false;
            }
        }
        record.enabled = Boolean(mirrorWidget.value);
    }, 180);
    const originalOnRemove = mirrorWidget.onRemove;
    mirrorWidget.onRemove = function (...args) {
        clearInterval(syncTimerId);
        const binding = bindings.get(nodeKey);
        if (binding?.titleWatchDisposer) {
            binding.titleWatchDisposer();
            binding.titleWatchDisposer = null;
            binding.titleWatchTargetNode = null;
        }
        bindings.delete(nodeKey);
        if (typeof originalOnRemove === "function") {
            originalOnRemove.apply(this, args);
        }
    };
    const binding = {
        nodeKey,
        sourceNode,
        mirrorWidget,
        targetNode,
        lastTargetTitle: getNodeTitleSnapshot(targetNode, record.targetNodeType),
        syncTimerId,
        titleWatchTargetNode: null,
        titleWatchDisposer: null,
    };
    bindings.set(nodeKey, binding);
    refreshMirrorWidgetDisplayName(binding, record, targetNode);
    rebindMirrorTitleWatch(binding, record, targetNode);
    applyTargetNodeMode(targetNode, Boolean(record.enabled), record.disabledMode);
    ensureWidgetAtBottom(sourceNode, sourceNode.__a1rModeCollectButtonWidget);
    syncCollectedRecordsToProperties(sourceNode);
}
export function restoreCollectedNodes(node) {
    const records = getCollectedRecords(node);
    if (records.size === 0)
        return;
    const lockedSize = snapshotNodeSize(node);
    records.forEach((record) => {
        createMirrorWidget(node, record);
    });
    ensureWidgetAtBottom(node, node.__a1rModeCollectButtonWidget);
    restoreNodeSize(node, lockedSize);
    if (typeof app.graph?.setDirtyCanvas === "function") {
        app.graph.setDirtyCanvas(true, true);
    }
}
function collectSelectedNodesToNode(sourceNode) {
    const records = getCollectedRecords(sourceNode);
    const selectedKeys = Array.from(selectedNodeKeys);
    if (selectedKeys.length === 0)
        return;
    const lockedSize = snapshotNodeSize(sourceNode);
    selectedKeys.forEach((nodeKey) => {
        const payload = selectedNodePayloads.get(nodeKey);
        if (!payload)
            return;
        const targetNode = app.graph?.getNodeById?.(payload.targetNodeId);
        if (!targetNode)
            return;
        let record = records.get(nodeKey);
        if (!record) {
            record = createRecordFromPayload(payload, targetNode, sourceNode);
            records.set(nodeKey, record);
        }
        else {
            record.sourceNodeId = payload.sourceNodeId;
            record.targetNodeId = payload.targetNodeId;
            record.targetNodeType = payload.targetNodeType;
            record.targetNodeTitle = payload.targetNodeTitle;
            record.enabled = Number(targetNode.mode) === 0;
            record.disabledMode = normalizeDisabledMode(record.disabledMode);
        }
        createMirrorWidget(sourceNode, record);
    });
    syncCollectedRecordsToProperties(sourceNode);
    restoreNodeSize(sourceNode, lockedSize);
    if (typeof app.graph?.setDirtyCanvas === "function") {
        app.graph.setDirtyCanvas(true, true);
    }
}
function stopCollectorEvent(e) {
    e.preventDefault();
    e.stopPropagation();
}
function isCollectorInternalTarget(target) {
    if (!(target instanceof Element))
        return false;
    return Boolean(target.closest(".collector-overlay, .collector-overlay-container, .collector-overlay-delete, .collector-title-overlay, .collector-title-overlay-delete, .collector-title-target, .collector-button, .collector-container"));
}
function shouldGuardCollectorHostEvent(target) {
    const collectingNodeId = getCollectingNodeId();
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
function applyOverlaySelectionState(overlay, nodeKey) {
    if (selectedNodeKeys.has(nodeKey)) {
        overlay.classList.add("collector-selected");
    }
    else {
        overlay.classList.remove("collector-selected");
    }
}
function toggleOverlaySelection(overlay, nodeKey) {
    if (selectedNodeKeys.has(nodeKey)) {
        selectedNodeKeys.delete(nodeKey);
        overlay.classList.remove("collector-selected");
        return false;
    }
    selectedNodeKeys.add(nodeKey);
    overlay.classList.add("collector-selected");
    return true;
}
function clearAllOverlays() {
    finishMirrorDrag(false);
    clearMirrorDropIndicators();
    for (const overlay of mountedOverlays) {
        overlay.remove();
    }
    mountedOverlays.clear();
    mirrorOverlayByNodeKey.clear();
    for (const row of mountedRows) {
        const hasAnyOverlay = Boolean(row.querySelector(".collector-overlay, .collector-title-overlay"));
        if (!hasAnyOverlay) {
            row.classList.remove("collector-target-row");
        }
    }
    mountedRows.clear();
    for (const container of mountedOverlayContainers) {
        container.remove();
    }
    mountedOverlayContainers.clear();
    for (const host of mountedOverlayHosts) {
        const hasAnyContainer = Boolean(host.querySelector(".collector-overlay-container"));
        if (!hasAnyContainer) {
            host.classList.remove("collector-target-host");
        }
    }
    mountedOverlayHosts.clear();
    document.querySelectorAll(".collector-title-target").forEach((el) => {
        const host = el;
        const hasTitleOverlay = Boolean(host.querySelector(".collector-title-overlay"));
        if (!hasTitleOverlay) {
            host.classList.remove("collector-title-target");
            host.style.position = "";
        }
    });
}
function resolveNodeTitle(targetNodeId, fallbackType) {
    const targetNode = app.graph?.getNodeById?.(targetNodeId);
    return getNodeTitleSnapshot(targetNode, fallbackType);
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
function onNodePicked(payload, isSelected) {
    const nodeKey = createNodeKey(payload.targetNodeId);
    if (isSelected) {
        selectedNodePayloads.set(nodeKey, payload);
    }
    else {
        selectedNodePayloads.delete(nodeKey);
    }
}
function isOverlayOnlyMutation(mutation) {
    if (mutation.type !== "childList")
        return false;
    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    if (changedNodes.length === 0)
        return false;
    return changedNodes.every((node) => node instanceof HTMLElement &&
        (node.classList.contains("collector-overlay") ||
            node.classList.contains("collector-title-overlay") ||
            node.classList.contains("collector-overlay-container")));
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
function mountSourceMirrorOverlayRow(row, sourceNode, sourceNodeId, usedMirrorNodeKeys) {
    const mirrorWidget = resolveSourceMirrorWidgetForRow(sourceNode, row, usedMirrorNodeKeys);
    const nodeKey = String(mirrorWidget?.__a1rNodeKey || "").trim();
    if (!nodeKey)
        return;
    usedMirrorNodeKeys.add(nodeKey);
    const records = getCollectedRecords(sourceNode);
    const record = records.get(nodeKey);
    const sourceWidgetIndex = Array.isArray(sourceNode.widgets) ? sourceNode.widgets.indexOf(mirrorWidget) : -1;
    const sourceWidgetName = getWidgetNameOrLabel(mirrorWidget);
    const overlay = createOverlay();
    overlay.classList.add("collector-overlay", "collector-overlay-mirror");
    overlay.dataset.nodeId = String(sourceNodeId);
    overlay.dataset.nodeType = String(sourceNode?.type || "");
    overlay.dataset.widgetName = record?.targetNodeTitle || sourceWidgetName || "node";
    overlay.dataset.widgetIndex = String(sourceWidgetIndex);
    overlay.dataset.sourceWidgetName = sourceWidgetName;
    overlay.dataset.widgetKey = nodeKey;
    bindCollectorGapGuards(overlay);
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "collector-overlay-delete";
    deleteButton.textContent = "x";
    deleteButton.title = "remove collected node";
    bindCollectorGapGuards(deleteButton);
    deleteButton.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    deleteButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeCollectedNode(sourceNode, nodeKey);
    });
    overlay.appendChild(deleteButton);
    let pointerStartX = 0;
    let pointerStartY = 0;
    let didDragMove = false;
    overlay.addEventListener("pointerdown", (e) => {
        if (e.button !== 0)
            return;
        e.preventDefault();
        e.stopPropagation();
        pointerStartX = e.clientX;
        pointerStartY = e.clientY;
        didDragMove = false;
        if (draggingMirrorNodeKey)
            return;
        if (typeof overlay.setPointerCapture === "function") {
            overlay.setPointerCapture(e.pointerId);
        }
        beginMirrorDrag(sourceNode, sourceNodeId, nodeKey, e.pointerId);
        updateMirrorDropTargetFromPointer(e.clientX, e.clientY);
    });
    overlay.addEventListener("pointermove", (e) => {
        if (mirrorDragPointerId === null || e.pointerId !== mirrorDragPointerId)
            return;
        if (Math.abs(e.clientX - pointerStartX) > 4 || Math.abs(e.clientY - pointerStartY) > 4) {
            didDragMove = true;
        }
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
        if (didDragMove)
            return;
        emitWidgetCollectorPickRequest({
            targetNodeId: sourceNodeId,
            targetNodeType: String(sourceNode?.type || ""),
            widgetName: sourceWidgetName || record?.targetNodeTitle || "node",
            widgetIndex: sourceWidgetIndex,
        });
    });
    mirrorOverlayByNodeKey.set(nodeKey, overlay);
    applyMirrorOverlayManageState(overlay);
    row.classList.add("collector-target-row");
    mountedRows.add(row);
    row.appendChild(overlay);
    mountedOverlays.add(overlay);
}
function mountNodeTitleOverlays(sourceNode) {
    isMountingOverlays = true;
    try {
        clearAllOverlays();
        const sourceNodeId = Number(sourceNode.id);
        if (!Number.isFinite(sourceNodeId))
            return;
        const titleElements = findNodeTitleElements();
        const touchedHosts = new Set();
        const touchedNodes = new Set();
        const usedMirrorNodeKeys = new Set();
        titleElements.forEach((titleEl) => {
            const targetNodeId = getNodeIdFromTitleElement(titleEl);
            if (!Number.isFinite(targetNodeId))
                return;
            if (targetNodeId === sourceNodeId)
                return;
            const targetNode = app.graph?.getNodeById?.(targetNodeId);
            if (targetNode?.comfyClass === "ModeCollector")
                return;
            const targetNodeType = getNodeTypeFromElement(titleEl) || targetNode?.type || '';
            const targetNodeTitle = getNodeTitleSnapshot(targetNode, targetNodeType);
            const nodeKey = createNodeKey(targetNodeId);
            const overlay = createOverlay();
            overlay.classList.add('collector-title-overlay');
            overlay.dataset.nodeId = String(targetNodeId);
            overlay.dataset.nodeType = targetNodeType;
            overlay.dataset.nodeTitle = targetNodeTitle;
            overlay.dataset.widgetKey = nodeKey;
            bindCollectorGapGuards(overlay);
            applyOverlaySelectionState(overlay, nodeKey);
            overlay.addEventListener("pointerdown", (e) => {
                if (e.button !== 0)
                    return;
                e.preventDefault();
                e.stopPropagation();
                const payload = {
                    sourceNodeId,
                    targetNodeId: targetNodeId,
                    targetNodeType,
                    targetNodeTitle,
                };
                onNodePicked(payload, toggleOverlaySelection(overlay, nodeKey));
                if (!selectedNodeKeys.has(nodeKey))
                    return;
                selectTargetNodeForCollect(targetNodeId);
            });
            overlay.addEventListener('pointerup', stopCollectorEvent);
            overlay.addEventListener('click', stopCollectorEvent);
            titleEl.classList.add('collector-title-target');
            titleEl.style.position = 'relative';
            titleEl.appendChild(overlay);
            mountedOverlays.add(overlay);
            touchedNodes.add(targetNodeId);
        });
        const rows = document.querySelectorAll(".lg-node-widget");
        rows.forEach((row) => {
            const metaEl = row.querySelector("[node-id]");
            if (!metaEl)
                return;
            const targetNodeId = Number(metaEl.getAttribute("node-id"));
            if (!Number.isFinite(targetNodeId) || targetNodeId !== sourceNodeId)
                return;
            mountSourceMirrorOverlayRow(row, sourceNode, sourceNodeId, usedMirrorNodeKeys);
            const host = row.closest(".lg-node-widgets");
            if (!host)
                return;
            touchedHosts.add(host);
            getOrCreateOverlayContainer(host, "grab");
        });
        touchedHosts.forEach((host) => {
            updateOverlayContainerBounds(host);
        });
        document.querySelectorAll('.collector-title-target').forEach(el => {
            const nodeId = getNodeIdFromTitleElement(el);
            if (nodeId !== null && !touchedNodes.has(nodeId)) {
                el.classList.remove('collector-title-target');
            }
        });
        if (mirrorManageNodeId !== null &&
            mirrorManageNodeKey !== null &&
            mirrorManageNodeId === sourceNodeId &&
            !mirrorOverlayByNodeKey.has(mirrorManageNodeKey)) {
            setMirrorManageState(null, null);
        }
    }
    finally {
        isMountingOverlays = false;
    }
}
function findNodeTitleElements() {
    const directHeaders = Array.from(document.querySelectorAll(".lg-node[data-node-id] .lg-node-header"));
    if (directHeaders.length > 0)
        return directHeaders;
    return Array.from(document.querySelectorAll(".lgraphnode .node-title"));
}
function getNodeIdFromTitleElement(el) {
    const nodeEl = el.closest(".lg-node[data-node-id], .lgraphnode");
    if (!nodeEl)
        return null;
    const nodeId = Number(nodeEl.dataset?.nodeId || nodeEl.getAttribute("data-node-id") || nodeEl.getAttribute("node-id"));
    if (Number.isFinite(nodeId)) {
        return nodeId;
    }
    return null;
}
function getNodeTypeFromElement(el) {
    const nodeEl = el.closest(".lg-node[data-node-id], .lgraphnode");
    if (!nodeEl)
        return '';
    return String(nodeEl.dataset?.nodeType ||
        nodeEl.getAttribute('data-node-type') ||
        nodeEl.getAttribute('node-type') ||
        '').trim();
}
function activateCollect(node) {
    console.log("[a1rworkshop.modecollector] Collecting nodes...");
    syncCollectorActiveClass();
    installCollectorCaptureGuards();
    if (typeof app.canvas?.deselectAll === "function") {
        app.canvas.deselectAll();
    }
    mountNodeTitleOverlays(node);
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
        attributes: true,
        attributeFilter: ['style', 'transform']
    });
}
export function deactivateCollect() {
    console.log("[a1rworkshop.modecollector] Collecting stopped.");
    syncCollectorActiveClass();
    uninstallCollectorCaptureGuards();
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
    selectedNodeKeys.clear();
    selectedNodePayloads.clear();
    clearAllOverlays();
}
export function setCollectButtonInactive(button) {
    setCollectorButtonState(button, BUTTON_TEXTS, BUTTON_ACTIVE_CLASS, false);
}
function setCollectButtonActive(button) {
    setCollectorButtonState(button, BUTTON_TEXTS, BUTTON_ACTIVE_CLASS, true);
}
export function getCollectButtonFromNode(node) {
    if (!node)
        return null;
    return node.__a1rModeCollectButton || null;
}
export function collectNodes(node, button) {
    const collectButton = button || getCollectButtonFromNode(node);
    if (!collectButton)
        return;
    toggleCollectorState({
        sessionKey: COLLECTOR_SESSION_KEY,
        node,
        button: collectButton,
        getButtonFromNode: getCollectButtonFromNode,
        setButtonActive: setCollectButtonActive,
        setButtonInactive: setCollectButtonInactive,
        onActivate: activateCollect,
        onDeactivate: deactivateCollect,
        onCommit: collectSelectedNodesToNode,
    });
}
