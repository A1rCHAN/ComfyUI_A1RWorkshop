import { getTagsDB, saveFilteredConfig } from "../data/config_model.js";
import { createTagsEditor, EDITOR_MODE } from "./editor_window.js";
import { createButton, createLabel, showToast, } from "../theme/themeUtils.js";
import { DialogBuilder, DIALOG_TYPE } from "../theme/dialog.js";
export const MANAGER_MODE = {
    DEFAULT: "default",
};
export function showManager() {
    return createTagsManager();
}
export function createTagsManager(options = {}) {
    const { mode = MANAGER_MODE.DEFAULT, onClose = null, } = options;
    const db = getTagsDB();
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
            updateListItemVisual(element, key, false, selectedItems);
        });
    };
    const updateRemoveButtonVisibility = () => {
        if (!removeButton)
            return;
        removeButton.style.display = selectMode && selectedItems.size > 0 ? "flex" : "none";
    };
    const content = document.createElement("div");
    content.className = "a1r-manager-content";
    const renderList = () => {
        content.innerHTML = "";
        listItemElements.forEach((element) => {
            element._cleanup?.();
        });
        listItemElements.clear();
        const wrapper = document.createElement("div");
        wrapper.className = "a1r-manager-list";
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
            const categoryContainer = document.createElement("div");
            categoryContainer.className = "a1r-manager-category";
            const entriesContainer = document.createElement("div");
            entriesContainer.className = "a1r-manager-entries";
            const isExpanded = categoryExpandedState.get(category);
            if (isExpanded) {
                entriesContainer.style.maxHeight = "none";
                entriesContainer.style.opacity = "1";
                entriesContainer.style.marginTop = "4px";
                entriesContainer.style.visibility = "visible";
            }
            else {
                entriesContainer.style.maxHeight = "0px";
                entriesContainer.style.opacity = "0";
                entriesContainer.style.marginTop = "0";
                entriesContainer.style.visibility = "hidden";
            }
            const categoryKeys = validEntries.map(([id]) => `${category}:${id}`);
            const categoryHeader = createCategoryHeader(category, validEntries.length, categoryExpandedState.get(category) ?? true, entriesContainer, categoryExpandedState, () => selectMode, categoryKeys, selectedItems, (keys) => {
                keys.forEach((k) => selectedItems.add(k));
                updateRemoveButtonVisibility();
                keys.forEach((k) => {
                    const element = listItemElements.get(k);
                    if (element) {
                        updateListItemVisual(element, k, true, selectedItems);
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
                        updateListItemVisual(element, k, true, selectedItems);
                    }
                });
            }, (keys) => {
                selectMode = true;
                keys.forEach((k) => selectedItems.add(k));
                updateRemoveButtonVisibility();
                keys.forEach((k) => {
                    const element = listItemElements.get(k);
                    if (element) {
                        updateListItemVisual(element, k, true, selectedItems);
                    }
                });
            });
            validEntries.forEach(([id, entry]) => {
                const item = createListItem(category, id, entry, () => selectMode, selectedItems, listItemElements, () => {
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
                        updateListItemVisual(element, key, true, selectedItems);
                    }
                });
                entriesContainer.appendChild(item);
            });
            categoryContainer.appendChild(categoryHeader);
            categoryContainer.appendChild(entriesContainer);
            wrapper.appendChild(categoryContainer);
        });
        if (totalValidEntries === 0) {
            wrapper.appendChild(createEmptyState());
        }
        wrapper.appendChild(createAddRow({
            onAdd: async () => {
                exitSelectMode();
                await createTagsEditor({
                    mode: EDITOR_MODE.MANAGER_ADD,
                    onSave: () => renderList(),
                });
            }
        }));
        content.appendChild(wrapper);
    };
    const deleteSelectedItems = () => {
        if (selectedItems.size === 0) {
            showToast("No items selected", "error");
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
            showToast(`Removed ${itemsToDelete.length} item(s). Apply or Save to confirm.`, "info");
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
        .addButton("Cancel", "secondary", () => null)
        .addButton("Save", "secondary", async () => {
        exitSelectMode();
        const result = await saveFilteredConfig(db);
        if (result === "unchanged") {
            showToast("Nothing has changed", "info");
        }
        return true;
    })
        .addButton("Apply", "secondary", async () => {
        exitSelectMode();
        const result = await saveFilteredConfig(db);
        if (result === "unchanged") {
            showToast("Nothing has changed", "info");
        }
    }, { closeAfterClick: false });
    builder.onClose(() => {
        onClose?.();
        exitSelectMode();
        setTimeout(() => {
            listItemElements.forEach((element) => {
                element._cleanup?.();
            });
        }, 250);
    });
    return builder.open();
}
function createCategoryHeader(category, itemCount, initialExpanded, entriesContainer, stateMap, getSelectMode, categoryKeys, selectedItems, selectAll, deselectAll, onLongPress) {
    const header = document.createElement("div");
    header.className = "a1r-manager-category-header";
    const leftSection = document.createElement("div");
    leftSection.className = "a1r-manager-category-left";
    const triangleWrapper = document.createElement("div");
    triangleWrapper.className = "a1r-manager-triangle";
    triangleWrapper.style.transform = initialExpanded ? "rotate(90deg)" : "rotate(0deg)";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "10");
    svg.setAttribute("height", "10");
    svg.setAttribute("viewBox", "0 0 10 10");
    const svgPath = document.createElementNS(svgNS, "path");
    svgPath.setAttribute("d", "M2 1.5 L8 5 L2 8.5 Q1.5 9 1 8.5 Q0.5 8 1 7.5 L5 5 L1 2.5 Q0.5 2 1 1.5 Q1.5 1 2 1.5 Z");
    svgPath.setAttribute("fill", "currentColor");
    svg.appendChild(svgPath);
    triangleWrapper.appendChild(svg);
    const categoryLabel = document.createElement("span");
    categoryLabel.className = "a1r-manager-category-label";
    categoryLabel.textContent = category;
    leftSection.appendChild(triangleWrapper);
    leftSection.appendChild(categoryLabel);
    const badge = document.createElement("span");
    badge.className = "a1r-manager-badge";
    badge.textContent = String(itemCount);
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
    header.addEventListener("mouseleave", () => {
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
        header.style.outline = "2px solid var(--a1r-color-text)";
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
function createListItem(category, id, entry, getSelectMode, selectedItems, listItemElements, onSelectionChange, onClick, onLongPress) {
    const key = `${category}:${id}`;
    const wrapper = document.createElement("div");
    wrapper.className = "a1r-manager-list-item";
    const contentElement = document.createElement("div");
    contentElement.className = "a1r-manager-item-content";
    const storagePath = entry.Model || "";
    const fileName = storagePath.split(/[\/\\]/).pop() || storagePath;
    const displayName = fileName.replace(/\.(safetensors|sft|pt|pth|ckpt|bin|gguf|onnx|model)$/i, "");
    const nameElement = document.createElement("span");
    nameElement.className = "a1r-manager-item-name";
    nameElement.textContent = displayName;
    const subFolder = storagePath.split(/[\/\\]/).slice(0, -1).join("/");
    const previewElement = document.createElement("span");
    previewElement.className = "a1r-manager-item-preview";
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
    wrapper.addEventListener("pointerdown", (event) => {
        if (event.button !== 0)
            return;
        isLongPress = false;
        longPressTimer = window.setTimeout(() => {
            longPressTimer = null;
            isLongPress = true;
            onLongPress();
            updateListItemVisual(wrapper, key, true, selectedItems);
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
            updateListItemVisual(wrapper, key, true, selectedItems);
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
function updateListItemVisual(element, key, inSelectMode, selectedItems) {
    if (!element)
        return;
    if (inSelectMode && selectedItems.has(key)) {
        element.classList.add("a1r-manager-list-item--selected");
    }
    else {
        element.classList.remove("a1r-manager-list-item--selected");
    }
}
function createEmptyState() {
    const empty = document.createElement("div");
    empty.className = "a1r-manager-empty";
    const label = createLabel("No models with tags found.");
    label.classList.add("a1r-manager-empty-label");
    empty.appendChild(label);
    return empty;
}
function createAddRow(options) {
    const addRow = document.createElement("div");
    addRow.className = "a1r-manager-add-row";
    const addButton = createButton("+");
    addButton.classList.add("a1r-manager-add-btn");
    addButton.addEventListener("click", () => options.onAdd());
    addRow.appendChild(addButton);
    return addRow;
}
