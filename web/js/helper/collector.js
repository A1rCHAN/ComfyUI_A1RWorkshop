// @ts-expect-error ComfyUI frontend module
import { app } from "/scripts/app.js";
import { createButton, createContainer } from "../theme/themeUtils.js";
const nodeTitleListenerRegistry = new WeakMap();
const collectorSessionRegistry = new Map();
export const WIDGET_COLLECTOR_PICK_REQUEST_EVENT = "a1r:widget-collector-pick-request";
export function emitWidgetCollectorPickRequest(detail) {
    document.dispatchEvent(new CustomEvent(WIDGET_COLLECTOR_PICK_REQUEST_EVENT, {
        detail,
    }));
}
export function subscribeWidgetCollectorPickRequest(handler) {
    const listener = (event) => {
        const customEvent = event;
        const detail = customEvent?.detail;
        if (!detail || typeof detail !== "object")
            return;
        const targetNodeId = Number(detail.targetNodeId);
        const widgetName = String(detail.widgetName || "").trim();
        const widgetIndex = Number(detail.widgetIndex);
        if (!Number.isFinite(targetNodeId))
            return;
        if (!widgetName)
            return;
        if (!Number.isFinite(widgetIndex))
            return;
        handler({
            targetNodeId,
            targetNodeType: String(detail.targetNodeType || "").trim(),
            widgetName,
            widgetIndex,
        });
    };
    document.addEventListener(WIDGET_COLLECTOR_PICK_REQUEST_EVENT, listener);
    return () => {
        document.removeEventListener(WIDGET_COLLECTOR_PICK_REQUEST_EVENT, listener);
    };
}
export function getCollectorSessionState(sessionKey) {
    const key = String(sessionKey || "default").trim() || "default";
    let state = collectorSessionRegistry.get(key);
    if (!state) {
        state = {
            isCollecting: false,
            collectingNodeId: null,
        };
        collectorSessionRegistry.set(key, state);
    }
    return state;
}
function hasAnyCollectorCollecting() {
    for (const state of collectorSessionRegistry.values()) {
        if (state.isCollecting && state.collectingNodeId !== null)
            return true;
    }
    return false;
}
export function syncCollectorActiveClass() {
    document.documentElement.classList.toggle("collector-active", hasAnyCollectorCollecting());
}
// === 按钮文案与激活态 === //
export function setCollectorButtonText(button, text) {
    const textElement = button.querySelector(".a1r-button-text");
    if (textElement) {
        textElement.textContent = text;
    }
    else {
        button.textContent = text;
    }
}
export function setCollectorButtonState(button, texts, activeClassName, isActive) {
    setCollectorButtonText(button, isActive ? texts.active : texts.inactive);
    button.classList.toggle(activeClassName, isActive);
}
// === Widget 排序工具 === //
export function ensureWidgetAtBottom(node, targetWidget) {
    if (!Array.isArray(node?.widgets) || node.widgets.length <= 1)
        return;
    const index = node.widgets.indexOf(targetWidget);
    if (index < 0 || index === node.widgets.length - 1)
        return;
    node.widgets.splice(index, 1);
    node.widgets.push(targetWidget);
}
// === 创建 Collector DOM 按钮 Widget === //
export function createCollectorButton(node, options) {
    const { text, onClick, disabled = false, ellipsis = false, serialize = false, widgetName = "collector_button", widgetType = "COLLECTOR_BUTTON", buttonRefKey = "__a1rCollectorButton", widgetRefKey = "__a1rCollectorButtonWidget", } = options;
    const container = createContainer();
    container.classList.add("collector-container");
    const button = createButton(text, { ellipsis });
    button.classList.add("collector-button");
    button.disabled = Boolean(disabled);
    button.addEventListener("click", (event) => {
        onClick(event, button);
    });
    container.appendChild(button);
    const widget = node.addDOMWidget(widgetName, widgetType, container, { serialize, hideOnZoom: false });
    widget.computeSize = (width) => [width, 34];
    node[buttonRefKey] = button;
    node[widgetRefKey] = widget;
    ensureWidgetAtBottom(node, widget);
    return {
        widget,
        button,
        updateText: (nextText) => {
            setCollectorButtonText(button, nextText);
        },
        setDisabled: (nextDisabled) => {
            button.disabled = Boolean(nextDisabled);
        },
    };
}
// === 激活 / 提交 / 关闭 切换 === //
export function toggleCollectorState(options) {
    const { sessionKey, node, button, getButtonFromNode, setButtonActive, setButtonInactive, onActivate, onDeactivate, onCommit, } = options;
    const session = getCollectorSessionState(sessionKey);
    const nodeId = Number(node?.id);
    if (!Number.isFinite(nodeId))
        return;
    if (!session.isCollecting || session.collectingNodeId !== nodeId) {
        if (session.isCollecting && session.collectingNodeId !== null && session.collectingNodeId !== nodeId) {
            const previousNode = app.graph?.getNodeById?.(session.collectingNodeId);
            const previousButton = getButtonFromNode ? getButtonFromNode(previousNode) : null;
            if (previousButton) {
                setButtonInactive(previousButton);
            }
            onDeactivate();
            session.isCollecting = false;
            session.collectingNodeId = null;
        }
        session.isCollecting = true;
        session.collectingNodeId = nodeId;
        setButtonActive(button);
        onActivate(node);
        return;
    }
    if (typeof onCommit === "function") {
        onCommit(node);
    }
    session.isCollecting = false;
    session.collectingNodeId = null;
    setButtonInactive(button);
    onDeactivate();
}
// === 生命周期保护：Collector 节点移除时自动停止 === //
export function stopCollectorForRemovedNode(options) {
    const { sessionKey, removedNode, getButtonFromNode, setButtonInactive, onDeactivate, } = options;
    const session = getCollectorSessionState(sessionKey);
    const removedNodeId = Number(removedNode?.id);
    if (!Number.isFinite(removedNodeId))
        return;
    if (!session.isCollecting || session.collectingNodeId !== removedNodeId)
        return;
    session.isCollecting = false;
    session.collectingNodeId = null;
    const button = getButtonFromNode ? getButtonFromNode(removedNode) : null;
    if (button) {
        setButtonInactive(button);
    }
    onDeactivate();
}
// === 会话重置工具 === //
export function resetCollectorSession(sessionKey) {
    const session = getCollectorSessionState(sessionKey);
    session.isCollecting = false;
    session.collectingNodeId = null;
}
// === 镜像 widget 标签 === //
export function watchNodeTitleChanges(targetNode, listener) {
    if (!targetNode || typeof targetNode !== "object")
        return null;
    let entry = nodeTitleListenerRegistry.get(targetNode);
    if (!entry) {
        const originalTitleDescriptor = Object.getOwnPropertyDescriptor(targetNode, "title");
        if (originalTitleDescriptor && originalTitleDescriptor.configurable === false) {
            return null;
        }
        const enumerable = originalTitleDescriptor?.enumerable ?? true;
        const listeners = new Set();
        const currentTitle = originalTitleDescriptor && "value" in originalTitleDescriptor ? originalTitleDescriptor.value : targetNode.title;
        entry = {
            listeners,
            originalTitleDescriptor,
            currentTitle,
        };
        Object.defineProperty(targetNode, "title", {
            configurable: true,
            enumerable,
            get() {
                if (typeof originalTitleDescriptor?.get === "function") {
                    return originalTitleDescriptor.get.call(this);
                }
                return entry?.currentTitle;
            },
            set(value) {
                const prevTitle = typeof originalTitleDescriptor?.get === "function"
                    ? originalTitleDescriptor.get.call(this)
                    : entry?.currentTitle;
                if (typeof originalTitleDescriptor?.set === "function") {
                    originalTitleDescriptor.set.call(this, value);
                }
                else if (entry) {
                    entry.currentTitle = value;
                }
                const nextTitle = typeof originalTitleDescriptor?.get === "function"
                    ? originalTitleDescriptor.get.call(this)
                    : entry?.currentTitle;
                if (prevTitle === nextTitle || !entry)
                    return;
                entry.listeners.forEach((cb) => {
                    try {
                        cb();
                    }
                    catch {
                        // 监听器异常不应阻塞标题更新。
                    }
                });
            },
        });
        nodeTitleListenerRegistry.set(targetNode, entry);
    }
    entry.listeners.add(listener);
    return () => {
        const currentEntry = nodeTitleListenerRegistry.get(targetNode);
        if (!currentEntry)
            return;
        currentEntry.listeners.delete(listener);
        if (currentEntry.listeners.size > 0)
            return;
        const finalTitle = targetNode.title;
        const originalTitleDescriptor = currentEntry.originalTitleDescriptor;
        if (originalTitleDescriptor) {
            if ("value" in originalTitleDescriptor) {
                Object.defineProperty(targetNode, "title", {
                    ...originalTitleDescriptor,
                    value: finalTitle,
                });
            }
            else {
                Object.defineProperty(targetNode, "title", originalTitleDescriptor);
            }
        }
        else {
            delete targetNode.title;
            targetNode.title = finalTitle;
        }
        nodeTitleListenerRegistry.delete(targetNode);
    };
}
export function getNodeTitleSnapshot(targetNode, fallbackType = "") {
    const title = String(targetNode?.title || targetNode?.type || fallbackType || "node").trim();
    return title || "node";
}
export function getWidgetNameOrLabel(widget) {
    if (typeof widget?.name === "string" && widget.name.trim()) {
        return widget.name.trim();
    }
    if (typeof widget?.label === "string" && widget.label.trim()) {
        return widget.label.trim();
    }
    return "";
}
export function extractCollectorRowDisplayName(row) {
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
export function ensureCollectButtonAtBottom(node) {
    const buttonWidget = node.__a1rCollectButtonWidget;
    if (!buttonWidget)
        return;
    ensureWidgetAtBottom(node, buttonWidget);
}
