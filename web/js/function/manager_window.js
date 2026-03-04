import { getTagsDB, saveFilteredConfig } from "./config_model.js";
import { createTagsEditor, EDITOR_MODE } from "./editor_window.js";
import { createButton, createContainer, createLabel, hexToRGBA, showToast, } from "../theme/themeUtils.js";
import { DialogBuilder, DIALOG_TYPE } from "../theme/dialog.js";
import { resolveThemeToken } from "../theme/themeWatcher.js";
export function showManager() {
    const db = getTagsDB();
    const token = resolveThemeToken({});
    const isClassic = token.isClassic;
    const selectedItems = new Set();
    const listItemElements = new Map();
    const categoryExpandedState = new Map();
    let selectMode = false;
    let removeButton = null;
    const exitSelectMode = () => {
        if (!selectMode)
            return;
        selectMode = false;
        selectedItems.clear();
        updateRemoveButtonVisibility();
        listItemElements.forEach((element, key) => {
            updateListItemVisual(element, key, false, selectedItems, token.color.prompt, token.color.background);
        });
    };
    const updateRemoveButtonVisibility = () => {
        if (!removeButton)
            return;
        removeButton.style.display = selectMode && selectedItems.size > 0 ? "flex" : "none";
    };
    const content = createContainer({}, {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        minHeight: "0",
        maxHeight: "80vh",
        overflowY: "auto",
        gap: "12px",
        flex: "1",
        padding: "2px 3px",
        background: "transparent",
    });
    const renderList = () => {
        content.innerHTML = "";
        listItemElements.forEach((element) => {
            element._cleanup?.();
        });
        listItemElements.clear();
        const wrapper = createContainer({}, {
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: "8px",
            minHeight: "unset",
            padding: "2px 3px",
            background: "transparent",
        });
        const categories = db.getCategories();
        let totalValidEntries = 0;
        categories.forEach((category) => {
            const entries = db.getByCategory(category);
            const validEntries = Object.entries(entries).filter(([, entry]) => (entry.Tags.positive && entry.Tags.positive.trim()) || (entry.Tags.negative && entry.Tags.negative.trim()));
            if (validEntries.length === 0)
                return;
            totalValidEntries += validEntries.length;
            if (!categoryExpandedState.has(category)) {
                categoryExpandedState.set(category, true);
            }
            const categoryContainer = createContainer({}, {
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: "4px",
                minHeight: "unset",
                padding: "0",
                background: "transparent",
            });
            const entriesContainer = createContainer({}, {
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: "4px",
                minHeight: "unset",
                overflow: "hidden",
                marginTop: categoryExpandedState.get(category) ? "4px" : "0",
                visibility: categoryExpandedState.get(category) ? "visible" : "hidden",
                maxHeight: categoryExpandedState.get(category) ? "none" : "0px",
                opacity: categoryExpandedState.get(category) ? "1" : "0",
                transition: "max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), margin 0.25s ease",
                background: "transparent",
            });
            const categoryKeys = validEntries.map(([id]) => `${category}:${id}`);
            const categoryHeader = createCategoryHeader(category, validEntries.length, categoryExpandedState.get(category) ?? true, entriesContainer, categoryExpandedState, token, isClassic, () => selectMode, categoryKeys, selectedItems, (keys) => {
                keys.forEach((k) => selectedItems.add(k));
                updateRemoveButtonVisibility();
                keys.forEach((k) => {
                    const element = listItemElements.get(k);
                    if (element) {
                        updateListItemVisual(element, k, true, selectedItems, token.color.prompt, token.color.background);
                    }
                });
            }, (keys) => {
                keys.forEach((k) => selectedItems.delete(k));
                if (selectedItems.size === 0) {
                    exitSelectMode();
                }
                else {
                    updateRemoveButtonVisibility();
                }
                keys.forEach((k) => {
                    const element = listItemElements.get(k);
                    if (element) {
                        updateListItemVisual(element, k, true, selectedItems, token.color.prompt, token.color.background);
                    }
                });
            }, (keys) => {
                selectMode = true;
                keys.forEach((k) => selectedItems.add(k));
                updateRemoveButtonVisibility();
                keys.forEach((k) => {
                    const element = listItemElements.get(k);
                    if (element) {
                        updateListItemVisual(element, k, true, selectedItems, token.color.prompt, token.color.background);
                    }
                });
            });
            validEntries.forEach(([id, entry]) => {
                const item = createListItem(category, id, entry, token, isClassic, () => selectMode, selectedItems, listItemElements, () => {
                    if (selectedItems.size === 0) {
                        exitSelectMode();
                    }
                    else {
                        updateRemoveButtonVisibility();
                    }
                }, () => {
                    exitSelectMode();
                    createTagsEditor({
                        mode: EDITOR_MODE.MANAGER_EDIT,
                        entry,
                        category,
                        onSave: () => renderList(),
                    });
                }, () => {
                    const key = `${category}:${id}`;
                    selectMode = true;
                    selectedItems.add(key);
                    updateRemoveButtonVisibility();
                    const element = listItemElements.get(key);
                    if (element) {
                        updateListItemVisual(element, key, true, selectedItems, token.color.prompt, token.color.background);
                    }
                });
                entriesContainer.appendChild(item);
            });
            categoryContainer.appendChild(categoryHeader);
            categoryContainer.appendChild(entriesContainer);
            wrapper.appendChild(categoryContainer);
        });
        if (totalValidEntries === 0) {
            const empty = createContainer({}, {
                minHeight: "80px",
                justifyContent: "center",
                alignItems: "center",
                background: "transparent",
            });
            empty.appendChild(createLabel("No models with tags found.", {}, {
                minWidth: "unset",
                opacity: "0.6",
                fontStyle: "italic",
            }));
            wrapper.appendChild(empty);
        }
        const addRow = createContainer({}, {
            minHeight: "40px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
            padding: "0",
            background: "transparent",
        });
        const addButton = createButton("+", {}, {
            minHeight: "30px",
            minWidth: "100%", maxWidth: "100%", flex: "1",
            fontSize: "18px",
            lineHeight: "1",
        });
        addButton.addEventListener("click", async () => {
            exitSelectMode();
            await createTagsEditor({
                mode: EDITOR_MODE.MANAGER_ADD,
                onSave: () => renderList(),
            });
        });
        addRow.appendChild(addButton);
        wrapper.appendChild(addRow);
        content.appendChild(wrapper);
    };
    const deleteSelectedItems = () => {
        if (selectedItems.size === 0) {
            showToast({}, {}, "No items selected", "error");
            return;
        }
        if (!confirm(`Delete ${selectedItems.size} selected item(s)?`))
            return;
        const itemsToDelete = Array.from(selectedItems).map((key) => {
            const [cat, id] = key.split(":");
            return { category: cat || "", id: id || "" };
        });
        const success = db.deleteBatch(itemsToDelete);
        if (success) {
            selectMode = false;
            selectedItems.clear();
            updateRemoveButtonVisibility();
            showToast({}, {}, `Removed ${itemsToDelete.length} item(s). Apply or Save to confirm.`, "info");
            renderList();
        }
    };
    renderList();
    const builder = new DialogBuilder(DIALOG_TYPE.CUSTOM)
        .setTitle("Tags Manager")
        .setContent(content)
        .setCloseOnOverlayClick(true)
        .setCloseOnEsc(true)
        .setCloseButton(false)
        .setSize("480px", "90vw", "85vh")
        .setAutoFocus(false)
        .addCustomHeaderButton("Remove", "secondary", () => deleteSelectedItems(), {
        dataRole: "remove-selected-btn",
        style: {
            display: "none",
            padding: "6px 14px",
            fontSize: "12px",
            minHeight: "28px",
        },
    })
        .onOpen((dialogElement) => {
        removeButton = dialogElement.querySelector("[data-role='remove-selected-btn']");
        updateRemoveButtonVisibility();
    });
    builder
        .addButton("Cancel", "secondary", () => {
        exitSelectMode();
        return null;
    })
        .addButton("Apply", "secondary", async () => {
        exitSelectMode();
        const result = await saveFilteredConfig(db);
        if (result === "unchanged") {
            showToast({}, {}, "Nothing has changed", "info");
        }
        return false;
    })
        .addButton("Save", "secondary", async (_event, dialog) => {
        exitSelectMode();
        const result = await saveFilteredConfig(db);
        if (result === "unchanged") {
            showToast({}, {}, "Nothing has changed", "info");
        }
        dialog.close(true);
        return false;
    });
    builder.onClose(() => {
        exitSelectMode();
        setTimeout(() => {
            listItemElements.forEach((element) => {
                element._cleanup?.();
            });
        }, 250);
    });
    return builder.open();
}
function createCategoryHeader(category, itemCount, initialExpanded, entriesContainer, stateMap, token, isClassic, getSelectMode, categoryKeys, selectedItems, selectAll, deselectAll, onLongPress) {
    const header = createContainer({}, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isClassic ? "6px 10px" : "8px 12px",
        borderRadius: isClassic ? "0px" : "6px",
        cursor: "pointer",
        userSelect: "none",
        transition: "outline 0.15s ease, background-color 0.15s ease, opacity 0.15s ease",
        outline: "2px solid transparent",
        outlineOffset: "-2px",
        gap: "12px",
        background: "transparent",
        minHeight: "unset",
    });
    const leftSection = createContainer({}, {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flex: "1",
        overflow: "hidden",
        minHeight: "unset",
        padding: "0",
        background: "transparent",
    });
    const triangleWrapper = createContainer({}, {
        width: "14px",
        height: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: "0",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: initialExpanded ? "rotate(90deg)" : "rotate(0deg)",
        minHeight: "unset",
        padding: "0",
        background: "transparent",
    });
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "10");
    svg.setAttribute("height", "10");
    svg.setAttribute("viewBox", "0 0 10 10");
    const svgPath = document.createElementNS(svgNS, "path");
    svgPath.setAttribute("d", "M2 1.5 L8 5 L2 8.5 Q1.5 9 1 8.5 Q0.5 8 1 7.5 L5 5 L1 2.5 Q0.5 2 1 1.5 Q1.5 1 2 1.5 Z");
    svgPath.setAttribute("fill", token.color.text);
    svg.appendChild(svgPath);
    triangleWrapper.appendChild(svg);
    const categoryLabel = document.createElement("span");
    categoryLabel.textContent = category;
    categoryLabel.style.cssText = `
    color: ${token.color.text};
    font-size: ${isClassic ? "11px" : "12px"};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: ${isClassic ? "0.5px" : "1px"};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: ${isClassic ? "Courier New, monospace" : "system-ui"};
  `;
    leftSection.appendChild(triangleWrapper);
    leftSection.appendChild(categoryLabel);
    const badge = document.createElement("span");
    badge.textContent = String(itemCount);
    badge.style.cssText = `
    color: ${token.color.text};
    font-size: ${isClassic ? "10px" : "11px"};
    font-weight: 500;
    padding: ${isClassic ? "2px 6px" : "2px 8px"};
    border-radius: ${isClassic ? "0px" : "10px"};
    background: ${hexToRGBA(token.color.text, 0.15)};
    flex-shrink: 0;
  `;
    header.appendChild(leftSection);
    header.appendChild(badge);
    let isExpanded = initialExpanded;
    let longPressTimer = null;
    let isLongPress = false;
    const LONG_PRESS_MS = 500;
    const toggle = () => {
        isExpanded = !isExpanded;
        stateMap.set(category, isExpanded);
        triangleWrapper.style.transform = isExpanded ? "rotate(90deg)" : "rotate(0deg)";
        header.setAttribute("aria-expanded", String(isExpanded));
        if (isExpanded) {
            entriesContainer.style.maxHeight = "none";
            entriesContainer.style.visibility = "visible";
            const targetHeight = entriesContainer.scrollHeight;
            entriesContainer.style.maxHeight = "0px";
            entriesContainer.style.opacity = "0";
            entriesContainer.style.marginTop = "0px";
            entriesContainer.offsetHeight;
            entriesContainer.style.maxHeight = `${targetHeight}px`;
            entriesContainer.style.opacity = "1";
            entriesContainer.style.marginTop = "4px";
            const onEnd = (event) => {
                if (event.propertyName === "max-height" && isExpanded) {
                    entriesContainer.style.maxHeight = "none";
                    entriesContainer.removeEventListener("transitionend", onEnd);
                }
            };
            entriesContainer.addEventListener("transitionend", onEnd);
        }
        else {
            const currentHeight = entriesContainer.scrollHeight;
            entriesContainer.style.maxHeight = `${currentHeight}px`;
            entriesContainer.style.opacity = "1";
            entriesContainer.style.marginTop = "4px";
            entriesContainer.style.visibility = "visible";
            entriesContainer.offsetHeight;
            entriesContainer.style.maxHeight = "0px";
            entriesContainer.style.opacity = "0";
            entriesContainer.style.marginTop = "0px";
            const onEnd = (event) => {
                if (event.propertyName === "max-height" && !isExpanded) {
                    entriesContainer.style.visibility = "hidden";
                    entriesContainer.removeEventListener("transitionend", onEnd);
                }
            };
            entriesContainer.addEventListener("transitionend", onEnd);
        }
    };
    header.addEventListener("mouseenter", () => {
        header.style.backgroundColor = hexToRGBA(token.color.title, 0.8);
    });
    header.addEventListener("mouseleave", () => {
        header.style.backgroundColor = "transparent";
        header.style.outline = "2px solid transparent";
    });
    header.addEventListener("click", (event) => {
        event.stopPropagation();
        if (isLongPress) {
            isLongPress = false;
            return;
        }
        if (getSelectMode()) {
            const allSelected = categoryKeys.every((key) => selectedItems.has(key));
            if (allSelected) {
                deselectAll(categoryKeys);
            }
            else {
                selectAll(categoryKeys);
            }
        }
        else {
            toggle();
        }
    });
    header.addEventListener("pointerdown", (event) => {
        if (event.button !== 0)
            return;
        isLongPress = false;
        header.style.outline = `2px solid ${token.color.text}`;
        longPressTimer = window.setTimeout(() => {
            longPressTimer = null;
            isLongPress = true;
            onLongPress(categoryKeys);
        }, LONG_PRESS_MS);
    });
    const cancelLongPress = () => {
        if (longPressTimer) {
            window.clearTimeout(longPressTimer);
            longPressTimer = null;
            isLongPress = false;
        }
        setTimeout(() => {
            header.style.outline = "2px solid transparent";
        }, 150);
    };
    header.addEventListener("pointerup", cancelLongPress);
    header.addEventListener("pointercancel", cancelLongPress);
    header.addEventListener("pointermove", (event) => {
        if (longPressTimer && (Math.abs(event.movementX) > 4 || Math.abs(event.movementY) > 4)) {
            cancelLongPress();
        }
    });
    header.setAttribute("tabindex", "0");
    header.setAttribute("role", "button");
    header.setAttribute("aria-expanded", String(isExpanded));
    header.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!getSelectMode())
                toggle();
        }
    });
    return header;
}
function createListItem(category, id, entry, token, isClassic, getSelectMode, selectedItems, listItemElements, onSelectionChange, onClick, onLongPress) {
    const key = `${category}:${id}`;
    const wrapper = createContainer({}, {
        position: "relative",
        padding: "10px 14px",
        border: "none",
        borderRadius: isClassic ? "0px" : "6px",
        cursor: "pointer",
        transition: "background 0.2s, box-shadow 0.15s",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        minHeight: "unset",
        background: token.color.background,
    });
    const contentElement = createContainer({}, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flex: "1",
        overflow: "hidden",
        minHeight: "unset",
        padding: "0",
        background: "transparent",
    });
    const storagePath = entry.Model || "";
    const fileName = storagePath.split(/[\/\\]/).pop() || storagePath;
    const displayName = fileName.replace(/\.(safetensors|sft|pt|pth|ckpt|bin|gguf|onnx|model)$/i, "");
    const nameElement = document.createElement("span");
    nameElement.textContent = displayName;
    nameElement.style.cssText = `
    color: ${token.color.text};
    font-size: 13px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    user-select: none;
  `;
    const subFolder = storagePath.split(/[\/\\]/).slice(0, -1).join("/");
    const previewElement = document.createElement("span");
    previewElement.style.cssText = `
    color: ${token.color.text};
    font-size: 11px;
    opacity: 0.6;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: 12px;
    user-select: none;
  `;
    const tagsText = entry.Tags?.positive || entry.Tags?.negative || "";
    previewElement.textContent = subFolder || (tagsText ? `${tagsText.substring(0, 25)}${tagsText.length > 25 ? "..." : ""}` : "No tags");
    contentElement.appendChild(nameElement);
    contentElement.appendChild(previewElement);
    wrapper.appendChild(contentElement);
    listItemElements.set(key, wrapper);
    let longPressTimer = null;
    let isLongPress = false;
    const LONG_PRESS_MS = 500;
    const cancelLongPress = () => {
        if (longPressTimer) {
            window.clearTimeout(longPressTimer);
            longPressTimer = null;
            isLongPress = false;
        }
    };
    wrapper.addEventListener("mouseenter", () => {
        if (!(getSelectMode() && selectedItems.has(key))) {
            wrapper.style.background = hexToRGBA(token.color.border, isClassic ? 0.15 : 0.3);
        }
    });
    wrapper.addEventListener("mouseleave", () => {
        if (!(getSelectMode() && selectedItems.has(key))) {
            wrapper.style.background = token.color.background;
            wrapper.style.boxShadow = "none";
        }
    });
    wrapper.addEventListener("pointerdown", (event) => {
        if (event.button !== 0)
            return;
        isLongPress = false;
        longPressTimer = window.setTimeout(() => {
            longPressTimer = null;
            isLongPress = true;
            onLongPress();
            updateListItemVisual(wrapper, key, true, selectedItems, token.color.prompt, token.color.background);
        }, LONG_PRESS_MS);
    });
    wrapper.addEventListener("pointerup", cancelLongPress);
    wrapper.addEventListener("pointercancel", cancelLongPress);
    wrapper.addEventListener("pointermove", (event) => {
        if (longPressTimer && (Math.abs(event.movementX) > 4 || Math.abs(event.movementY) > 4)) {
            cancelLongPress();
        }
    });
    wrapper.addEventListener("click", () => {
        if (isLongPress) {
            isLongPress = false;
            return;
        }
        if (getSelectMode()) {
            if (selectedItems.has(key)) {
                selectedItems.delete(key);
            }
            else {
                selectedItems.add(key);
            }
            updateListItemVisual(wrapper, key, true, selectedItems, token.color.prompt, token.color.background);
            onSelectionChange();
        }
        else {
            onClick();
        }
    });
    wrapper._cleanup = () => {
        cancelLongPress();
    };
    return wrapper;
}
function updateListItemVisual(element, key, inSelectMode, selectedItems, promptColor, backgroundColor) {
    if (!element)
        return;
    if (inSelectMode && selectedItems.has(key)) {
        element.style.boxShadow = `inset 0 0 0 2px ${promptColor}`;
        element.style.background = hexToRGBA(promptColor, 0.08);
    }
    else {
        element.style.boxShadow = "none";
        element.style.background = backgroundColor;
    }
}
