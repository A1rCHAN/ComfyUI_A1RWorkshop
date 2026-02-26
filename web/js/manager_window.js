import { getTagsDB, saveFilteredConfig } from "../config.js";
import { ComfyThemeAdapter } from "../adapter.js";
import { custom, showToast, addButtonHover } from "../style.js";
import { hexToRgba } from "../theme.js";
import { DialogBuilder, DIALOG_TYPE } from "../dialog.js";
import { createTagsEditor, EDITOR_MODE } from "./editor_window.js";

// ========== 公开入口 ==========

/**
 * 打开 Tags Manager 对话框
 * 展示所有已配置 tags 的模型条目，支持编辑、新增、批量删除
 */
export function showManager() {
  const db        = getTagsDB();
  const adapter   = new ComfyThemeAdapter();
  const theme     = adapter.theme;
  const isClassic = adapter.isClassic;

  let selectMode = false;
  const selectedItems     = new Set();
  const listItemElements  = new Map();
  const categoryExpandedState = new Map();

  // 退出选择模式（不重新渲染列表，直接更新视觉）
  const exitSelectMode = () => {
    if (!selectMode) return;
    selectMode = false;
    selectedItems.clear();
    updateRemoveButtonVisibility();
    listItemElements.forEach((el, key) => updateListItemVisual(el, key, false, selectedItems, theme));
  };

  // ── 内容区 ──────────────────────────────────────────────
  const content = document.createElement("div");
  content.style.cssText =
    "display: flex; flex-direction: column; gap: 12px; flex: 1; max-height: 80vh; overflow-y: auto;";

  // ── 渲染列表 ──────────────────────────────────────────
  const renderList = () => {
    content.innerHTML = "";
    listItemElements.forEach((el) => { if (el._cleanup) el._cleanup() });
    listItemElements.clear();

    const wrapper = document.createElement("div");
    // 两侧留 padding，防止条目 box-shadow 被裁剪
    wrapper.style.cssText = "display: flex; flex-direction: column; gap: 8px; padding: 2px 3px;";

    const categories = db.getCategories();
    let totalValidEntries = 0;

    categories.forEach(category => {
      const entries = db.getByCategory(category);
      const validEntries = Object.entries(entries).filter(
        ([, entry]) => entry.Tags && entry.Tags.trim().length > 0
      );

      if (validEntries.length === 0) return;
      totalValidEntries += validEntries.length;

      const categoryContainer = document.createElement("div");
      categoryContainer.style.cssText = "display: flex; flex-direction: column; gap: 4px;";

      if (!categoryExpandedState.has(category)) categoryExpandedState.set(category, true);
      const isExpanded = categoryExpandedState.get(category);

      const entriesContainer = document.createElement("div");
      entriesContainer.dataset.role = "entries-container";
      entriesContainer.style.cssText = `
        display: flex; flex-direction: column; gap: 4px; overflow: hidden;
        transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                    margin 0.25s ease;
        ${isClassic ? "" : "will-change: max-height, opacity;"}
      `;

      // 所有 category key（用于全选/全取消）
      const categoryKeys = validEntries.map(([id]) => `${category}:${id}`);

      const catHeader = createCategoryHeader(
        category, validEntries.length, isExpanded,
        theme, isClassic, entriesContainer, categoryExpandedState,
        () => selectMode,
        categoryKeys,
        selectedItems,
        (keys) => {
          keys.forEach(k => selectedItems.add(k));
          updateRemoveButtonVisibility();
          keys.forEach(k => {
            const el = listItemElements.get(k);
            if (el) updateListItemVisual(el, k, true, selectedItems, theme);
          })
        },
        (keys) => {
          keys.forEach(k => selectedItems.delete(k));
          if (selectedItems.size === 0) exitSelectMode();
          else {
            updateRemoveButtonVisibility();
            keys.forEach(k => {
              const el = listItemElements.get(k);
              if (el) updateListItemVisual(el, k, true, selectedItems, theme);
            })
          }
        },
        // 长按类别标题：进入选择模式并全选该类别
        (keys) => {
          selectMode = true;
          keys.forEach(k => selectedItems.add(k));
          updateRemoveButtonVisibility();
          keys.forEach(k => {
            const el = listItemElements.get(k);
            if (el) updateListItemVisual(el, k, true, selectedItems, theme);
          })
        }
      );

      if (!isExpanded) {
        entriesContainer.style.maxHeight  = "0px";
        entriesContainer.style.opacity    = "0";
        entriesContainer.style.marginTop  = "0px";
        entriesContainer.style.visibility = "hidden"
      } else {
        entriesContainer.style.maxHeight  = "none";
        entriesContainer.style.opacity    = "1";
        entriesContainer.style.marginTop  = "4px";
        entriesContainer.style.visibility = "visible"
      }

      validEntries.forEach(([id, entry]) => {
        const item = createListItem(
          category, id, entry, theme,
          () => selectMode,
          selectedItems, listItemElements,
          () => {
            // 全部取消选中时自动退出选择模式
            if (selectedItems.size === 0) exitSelectMode();
            else updateRemoveButtonVisibility();
          },
          db,
          () => {
            // 普通点击：退出选择模式并打开编辑器
            exitSelectMode();
            createTagsEditor({
              mode:     EDITOR_MODE.MANAGER_EDIT,
              entry,
              category,
              onSave:   () => renderList()
            })
          },
          // 长按回调：进入选择模式并选中该条目
          () => {
            const key = `${category}:${id}`;
            selectMode = true;
            selectedItems.add(key);
            updateRemoveButtonVisibility();
            const el = listItemElements.get(key);
            if (el) updateListItemVisual(el, key, true, selectedItems, theme);
          }
        );
        entriesContainer.appendChild(item)
      });

      categoryContainer.appendChild(catHeader);
      categoryContainer.appendChild(entriesContainer);
      wrapper.appendChild(categoryContainer)
    });

    if (totalValidEntries === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.style.cssText =
        "text-align: center; padding: 40px 20px; opacity: 0.6; font-style: italic;";
      emptyMsg.textContent = "No models with tags found.";
      emptyMsg.style.userSelect = "none";
      const msgAdapter = new ComfyThemeAdapter();
      msgAdapter.bindElement(emptyMsg, { color: "text" });
      emptyMsg.addEventListener("remove", () => msgAdapter.destroy());
      wrapper.appendChild(emptyMsg)
    }

    content.appendChild(wrapper);

    // "+" 新增按钮
    const addBtn = custom.dashedButton("+", theme);
    addBtn.addEventListener("click", async () => {
      exitSelectMode();
      await createTagsEditor({
        mode:   EDITOR_MODE.MANAGER_ADD,
        onSave: () => renderList()
      })
    });
    wrapper.appendChild(addBtn)
  };

  // ── 删除选中 ──────────────────────────────────────────
  const deleteSelectedItems = () => {
    if (selectedItems.size === 0) {
      showToast("No items selected", "error");
      return
    }

    if (!confirm(`Delete ${selectedItems.size} selected item(s)?`)) return;

    const itemsToDelete = Array.from(selectedItems).map(key => {
      const [cat, id] = key.split(":");
      return { category: cat, id }
    });

    const success = db.deleteBatch(itemsToDelete);
    if (success) {
      selectMode = false;
      selectedItems.clear();
      updateRemoveButtonVisibility();
      // 仅从内存删除，不立即写磁盘——需在 Manager 中点击 Apply/Save 才写入
      showToast(`Removed ${itemsToDelete.length} item(s). Apply or Save to confirm.`, "info");
      renderList()
    }
  };

  const updateRemoveButtonVisibility = () => {
    const btn = document.querySelector("[data-role=\"remove-selected-btn\"]");
    if (btn) {
      btn.style.display =
        (selectMode && selectedItems.size > 0) ? "flex" : "none"
    }
  };

  // ── 初始渲染 ──────────────────────────────────────────
  renderList();

  // ── DialogBuilder ──────────────────────────────────────
  const builder = new DialogBuilder(DIALOG_TYPE.CUSTOM)
    .setTitle("Tags Manager")
    .setContent(content)
    .setCloseOnOverlayClick(true)
    .setCloseOnEsc(true)
    .setCloseButton(false)
    .setSize("480px", "90vw", "85vh")
    .setAutoFocus(false);

  // 在标题栏注入 Remove 按钮（选中项时才显示）
  const originalBuild = builder._build.bind(builder);
  builder._build = function() {
    originalBuild();

    const titleBar      = this._elements.titleBar;
    const titleControls = document.createElement("div");
    titleControls.style.cssText =
      "position: absolute; right: 12px; top: 0; bottom: 0; display: flex; align-items: center; gap: 8px; z-index: 10;";
    titleControls.dataset.role = "title-controls";

    const removeBtn = custom.dialogButton("Remove", theme);
    removeBtn.dataset.role    = "remove-selected-btn";
    removeBtn.style.display   = "none";
    removeBtn.style.padding   = "6px 14px";
    removeBtn.style.fontSize  = "12px";
    const removeAdapter = new ComfyThemeAdapter();
    removeAdapter.bindElement(removeBtn, { background: "background", color: "text" });
    removeBtn.addEventListener("click", deleteSelectedItems);
    removeBtn.addEventListener("remove", () => removeAdapter.destroy());

    titleControls.appendChild(removeBtn);
    titleBar.appendChild(titleControls)
  };

  builder
    .addButton("Cancel", "secondary", () => {
      exitSelectMode();
      return null
    })
    // 同步返回 false 阻止 dialog.js 立即关闭；保存完成后手动关闭
    .addButton("Save", "secondary", (e, dlg) => {
      exitSelectMode();
      saveFilteredConfig(db).then(result => {
        if (result === "unchanged") showToast("Nothing has changed", "info");
        dlg.close(true);
      });
      return false
    })
    // Apply 只保存，不关闭窗口
    .addButton("Apply", "secondary", () => {
      exitSelectMode();
      saveFilteredConfig(db).then(result => {
        if (result === "unchanged") showToast("Nothing has changed", "info");
      });
      return false
    });

  builder.onClose(() => {
    exitSelectMode();
    setTimeout(() => {
      adapter.destroy();
      listItemElements.forEach((el) => { if (el._cleanup) el._cleanup() })
    }, 300)
  });

  return builder.open()
}

// ========== 类别标题组件 ==========

function createCategoryHeader(
  category, itemCount, initialExpanded, theme, isClassic,
  entriesContainer, stateMap,
  getSelectMode, categoryKeys, selectedItems,
  selectAll, deselectAll, onLongPress
) {
  const adapter = new ComfyThemeAdapter();

  const header = document.createElement("div");
  header.dataset.role = "category-header";

  Object.assign(header.style, {
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "space-between",
    padding:         isClassic ? "6px 10px" : "8px 12px",
    borderRadius:    isClassic ? "0px" : "6px",
    cursor:          "pointer",
    userSelect:      "none",
    transition:      "outline 0.15s ease, background-color 0.15s ease, opacity 0.15s ease",
    outline:         "2px solid transparent",
    outlineOffset:   "-2px",
    gap:             "12px",
    background:      "transparent"
  });

  adapter.bindElement(header, { color: "text" });

  // 左侧：SVG 三角形 + 类别名
  const leftSection = document.createElement("div");
  leftSection.style.cssText =
    "display: flex; align-items: center; gap: 10px; flex: 1; overflow: hidden;";

  const triangleWrapper = document.createElement("div");
  triangleWrapper.style.cssText = `
    width: 14px; height: 14px; display: flex; align-items: center;
    justify-content: center; flex-shrink: 0;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: ${initialExpanded ? "rotate(90deg)" : "rotate(0deg)"};
  `;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg   = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "10"); svg.setAttribute("height", "10");
  svg.setAttribute("viewBox", "0 0 10 10");
  svg.style.cssText = "display: block;";
  const svgPath = document.createElementNS(svgNS, "path");
  svgPath.setAttribute("d",
    "M2 1.5 L8 5 L2 8.5 Q1.5 9 1 8.5 Q0.5 8 1 7.5 L5 5 L1 2.5 Q0.5 2 1 1.5 Q1.5 1 2 1.5 Z"
  );
  svgPath.setAttribute("fill", "currentColor");
  svg.appendChild(svgPath);
  triangleWrapper.appendChild(svg);

  const catLabel = document.createElement("span");
  catLabel.style.cssText = `
    font-size: ${isClassic ? "11px" : "12px"};
    font-weight: 600; text-transform: uppercase;
    letter-spacing: ${isClassic ? "0.5px" : "1px"};
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-family: ${isClassic ? "Courier New, monospace" : "system-ui"};
  `;
  catLabel.textContent = category;

  leftSection.appendChild(triangleWrapper);
  leftSection.appendChild(catLabel);

  const badge = document.createElement("span");
  badge.style.cssText = `
    font-size: ${isClassic ? "10px" : "11px"}; font-weight: 500;
    padding: ${isClassic ? "2px 6px" : "2px 8px"};
    border-radius: ${isClassic ? "0px" : "10px"};
    background: ${hexToRgba(theme.text, 0.15)}; flex-shrink: 0;
  `;
  badge.textContent = itemCount;

  header.appendChild(leftSection);
  header.appendChild(badge);

  let isExpanded = initialExpanded;

  const toggle = () => {
    isExpanded = !isExpanded;
    stateMap.set(category, isExpanded);
    triangleWrapper.style.transform = isExpanded ? "rotate(90deg)" : "rotate(0deg)";
    header.setAttribute("aria-expanded", isExpanded.toString());

    if (isExpanded) {
      entriesContainer.style.maxHeight  = "none";
      entriesContainer.style.visibility = "visible";
      const targetH = entriesContainer.scrollHeight;
      entriesContainer.style.maxHeight = "0px";
      entriesContainer.style.opacity   = "0";
      entriesContainer.style.marginTop = "0px";
      entriesContainer.offsetHeight;
      entriesContainer.style.maxHeight = targetH + "px";
      entriesContainer.style.opacity   = "1";
      entriesContainer.style.marginTop = "4px";
      const onEnd = (e) => {
        if (e.propertyName === "max-height" && isExpanded) {
          entriesContainer.style.maxHeight = "none";
          entriesContainer.removeEventListener("transitionend", onEnd)
        }
      };
      entriesContainer.addEventListener("transitionend", onEnd)
    } else {
      const currentH = entriesContainer.scrollHeight;
      entriesContainer.style.maxHeight  = currentH + "px";
      entriesContainer.style.opacity    = "1";
      entriesContainer.style.marginTop  = "4px";
      entriesContainer.style.visibility = "visible";
      entriesContainer.offsetHeight;
      entriesContainer.style.maxHeight = "0px";
      entriesContainer.style.opacity   = "0";
      entriesContainer.style.marginTop = "0px";
      const onEnd = (e) => {
        if (e.propertyName === "max-height" && !isExpanded) {
          entriesContainer.style.visibility = "hidden";
          entriesContainer.removeEventListener("transitionend", onEnd)
        }
      };
      entriesContainer.addEventListener("transitionend", onEnd)
    }
  };

  header.addEventListener("mouseenter", () => {
    header.style.backgroundColor = hexToRgba(theme.title, 0.8)
  });
  header.addEventListener("mouseleave", () => {
    header.style.backgroundColor = "transparent";
    header.style.outline         = "2px solid transparent"
  });
  header.addEventListener("click", (e) => {
    e.stopPropagation();
    // 长按已触发，忽略随后的 click 事件
    if (hdrIsLongPress) { hdrIsLongPress = false; return }

    if (getSelectMode()) {
      // 选择模式：点击类别标题一键选/取消选当前类别下所有条目
      const allSelected = categoryKeys.every(k => selectedItems.has(k));
      if (allSelected) {
        deselectAll(categoryKeys)
      } else {
        selectAll(categoryKeys)
      }
    } else {
      toggle()
    }
  });
  // 长按检测（类别标题）
  const LONG_PRESS_MS = 500;
  let hdrLongPressTimer = null;
  let hdrIsLongPress    = false;

  header.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    hdrIsLongPress = false;
    header.style.outline = `2px solid ${theme.text}`;
    hdrLongPressTimer = setTimeout(() => {
      hdrLongPressTimer = null;
      hdrIsLongPress = true;
      if (onLongPress) onLongPress(categoryKeys)
    }, LONG_PRESS_MS)
  });
  const cancelHdrLongPress = () => {
    if (hdrLongPressTimer) {
      clearTimeout(hdrLongPressTimer);
      hdrLongPressTimer = null;
      hdrIsLongPress = false
    }
    setTimeout(() => { header.style.outline = "2px solid transparent" }, 150)
  };
  header.addEventListener("pointerup",     cancelHdrLongPress);
  header.addEventListener("pointercancel", cancelHdrLongPress);
  header.addEventListener("pointermove", (e) => {
    if (hdrLongPressTimer && (Math.abs(e.movementX) > 4 || Math.abs(e.movementY) > 4)) {
      cancelHdrLongPress()
    }
  });

  header.setAttribute("tabindex",      "0");
  header.setAttribute("role",          "button");
  header.setAttribute("aria-expanded", isExpanded.toString());
  header.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); getSelectMode() ? null : toggle() }
  });
  header.addEventListener("remove", () => adapter.destroy());

  return header
}

// ========== 列表条目组件 ==========

function createListItem(
  category, id, entry, theme,
  getSelectMode, selectedItems, listItemElements,
  onSelectionChange, db, onClick, onLongPress
) {
  const key       = `${category}:${id}`;
  const adapter   = new ComfyThemeAdapter();
  const isClassic = adapter.isClassic;

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position: relative; padding: 10px 14px; border: none; border-radius: 6px; " +
    "cursor: pointer; transition: background 0.2s, box-shadow 0.15s; " +
    "display: flex; align-items: center; gap: 10px;";

  addButtonHover(wrapper, theme, isClassic ? 0.15 : 0.3);
  adapter.bindElement(wrapper, { background: "background" });

  const contentEl = document.createElement("div");
  contentEl.style.cssText =
    "display: flex; align-items: center; justify-content: space-between; flex: 1; overflow: hidden;";

  const storagePath = entry.Model || "";
  const fileName    = storagePath?.split(/[\/\\]/).pop() || storagePath;
  const displayName = fileName.replace(
    /\.(safetensors|sft|pt|pth|ckpt|bin|gguf|onnx|model)$/i, ""
  );

  const nameEl = document.createElement("span");
  nameEl.style.cssText =
    "font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: none;";
  nameEl.textContent = displayName;
  const nameAdapter = new ComfyThemeAdapter();
  nameAdapter.bindElement(nameEl, { color: "text" });

  const subFolder  = storagePath.split(/[\/\\]/).slice(0, -1).join("/");
  const previewEl  = document.createElement("span");
  previewEl.style.cssText =
    "font-size: 11px; opacity: 0.6; max-width: 120px; overflow: hidden; " +
    "text-overflow: ellipsis; white-space: nowrap; margin-left: 12px; user-select: none;";

  if (subFolder) {
    previewEl.textContent = subFolder
  } else {
    const tags = entry.Tags || "";
    previewEl.textContent = tags
      ? tags.substring(0, 25) + (tags.length > 25 ? "..." : "")
      : "No tags"
  }

  const previewAdapter = new ComfyThemeAdapter();
  previewAdapter.bindElement(previewEl, { color: "text" });

  contentEl.appendChild(nameEl);
  contentEl.appendChild(previewEl);
  wrapper.appendChild(contentEl);

  listItemElements.set(key, wrapper);

  // ── 长按检测 ──────────────────────────────────────────
  const LONG_PRESS_MS = 500;
  let longPressTimer = null;
  let isLongPress    = false;

  const cancelLongPress = () => {
    // 只有计时器还未触发时才重置 isLongPress；若已触发（longPressTimer 已被设为 null），
    // 则保留 isLongPress = true 供 click 事件判断，避免长按松手时 click 误触发
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      isLongPress = false
    }
  };

  wrapper.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;  // 清除引用，使 cancelLongPress 不再重置 isLongPress
      isLongPress = true;
      if (onLongPress) onLongPress();
      updateListItemVisual(wrapper, key, true, selectedItems, theme)
    }, LONG_PRESS_MS)
  });
  wrapper.addEventListener("pointerup",     cancelLongPress);
  wrapper.addEventListener("pointercancel", cancelLongPress);
  // 拖动时也取消
  wrapper.addEventListener("pointermove", (e) => {
    if (longPressTimer && (Math.abs(e.movementX) > 4 || Math.abs(e.movementY) > 4)) {
      cancelLongPress()
    }
  });

  // ── 点击 ──────────────────────────────────────────────
  wrapper.addEventListener("click", (e) => {
    // 长按已触发，忽略随后的 click 事件
    if (isLongPress) { isLongPress = false; return }

    if (getSelectMode()) {
      if (selectedItems.has(key)) selectedItems.delete(key);
      else                        selectedItems.add(key);
      updateListItemVisual(wrapper, key, true, selectedItems, theme);
      if (onSelectionChange) onSelectionChange()
    } else {
      onClick()
    }
  });

  wrapper._cleanup = () => {
    cancelLongPress();
    adapter.destroy();
    nameAdapter.destroy();
    previewAdapter.destroy()
  };

  wrapper.addEventListener("remove", wrapper._cleanup);
  return wrapper
}

function updateListItemVisual(el, key, inSelectMode, selectedItems, theme) {
  if (!el) return;
  if (inSelectMode && selectedItems.has(key)) {
    // 用 box-shadow 代替 outline，不受容器 overflow:hidden 裁剪
    el.style.boxShadow = `inset 0 0 0 2px ${theme.prompt}`;
    el.style.background = hexToRgba(theme.prompt, 0.08)
  } else {
    el.style.boxShadow  = "none";
    el.style.background = theme.background
  }
}