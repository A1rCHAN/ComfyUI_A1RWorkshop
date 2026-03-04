import { createOverlay, createDialog, createContainer, createButton, createLabel, } from "./themeUtils.js";
import { resolveThemeToken } from "./themeWatcher.js";
export const DIALOG_TYPE = {
    STANDARD: "standard",
    FORM: "form",
    LIST: "list",
    CONFIRM: "confirm",
    CUSTOM: "custom",
};
function cleanupThemeWatchers(root) {
    const walk = (element) => {
        ;
        element.__a1rStopThemeWatch?.();
        Array.from(element.children).forEach((child) => {
            if (child instanceof HTMLElement) {
                walk(child);
            }
        });
    };
    walk(root);
}
export class DialogBuilder {
    constructor(type = DIALOG_TYPE.STANDARD, theme = {}) {
        this.title = "";
        this.content = null;
        this.buttons = [];
        this.headerButtons = [];
        this.closeOnOverlay = true;
        this.closeOnEsc = true;
        this.showCloseButton = true;
        this.autoFocus = true;
        this.dialogWidth = "500px";
        this.dialogMinHeight = null;
        this.dialogMaxWidth = "90vw";
        this.dialogMaxHeight = "90vh";
        this.onCloseCallback = null;
        this.onOpenCallback = null;
        this.resolveOpen = null;
        this.overlayEl = null;
        this.dialogEl = null;
        this.titleBarEl = null;
        this.contentEl = null;
        this.buttonBarEl = null;
        this.keydownHandler = null;
        this.type = type;
        this.theme = theme;
    }
    setTitle(title) {
        this.title = title;
        return this;
    }
    setContent(content) {
        if (typeof content === "string") {
            const wrapper = createContainer(this.theme, {
                display: "block",
                minHeight: "unset",
            });
            wrapper.innerHTML = content;
            this.content = wrapper;
        }
        else {
            this.content = content;
        }
        return this;
    }
    addButton(label, type = "default", onClick = null, options = {}) {
        this.buttons.push({ label, type, onClick, options });
        return this;
    }
    addCustomHeaderButton(label, type, onClick, options = {}) {
        this.headerButtons.push({ label, type, onClick, options });
        return this;
    }
    setSize(width, maxWidth = null, maxHeight = null) {
        this.dialogWidth = width;
        if (maxWidth)
            this.dialogMaxWidth = maxWidth;
        if (maxHeight)
            this.dialogMaxHeight = maxHeight;
        return this;
    }
    setMinHeight(minHeight) {
        this.dialogMinHeight = minHeight;
        return this;
    }
    setCloseButton(show) {
        this.showCloseButton = show;
        return this;
    }
    setCloseOnOverlayClick(close) {
        this.closeOnOverlay = close;
        return this;
    }
    setCloseOnEsc(close) {
        this.closeOnEsc = close;
        return this;
    }
    setAutoFocus(autoFocus) {
        this.autoFocus = autoFocus;
        return this;
    }
    onClose(callback) {
        this.onCloseCallback = callback;
        return this;
    }
    onOpen(callback) {
        this.onOpenCallback = callback;
        return this;
    }
    open() {
        this.build();
        return new Promise((resolve) => {
            this.resolveOpen = resolve;
        });
    }
    close(result = null) {
        if (!this.overlayEl)
            return;
        this.onCloseCallback?.(result);
        if (this.keydownHandler) {
            window.removeEventListener("keydown", this.keydownHandler);
            this.keydownHandler = null;
        }
        cleanupThemeWatchers(this.overlayEl);
        this.overlayEl.remove();
        this.overlayEl = null;
        this.dialogEl = null;
        this.titleBarEl = null;
        this.contentEl = null;
        this.buttonBarEl = null;
        this.resolveOpen?.(result);
        this.resolveOpen = null;
    }
    build() {
        const overlay = createOverlay(this.theme);
        const theme = resolveThemeToken(this.theme);
        let minHeight = "320px";
        if (this.dialogMinHeight !== null) {
            minHeight = this.dialogMinHeight;
        }
        else if (this.type === DIALOG_TYPE.CONFIRM || this.type === DIALOG_TYPE.CUSTOM) {
            minHeight = "unset";
        }
        const dialog = createDialog(this.theme, {
            width: this.dialogWidth,
            maxWidth: this.dialogMaxWidth,
            maxHeight: this.dialogMaxHeight,
            minHeight: minHeight,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: "0",
        });
        const titleBar = createContainer(this.theme, {
            flexShrink: "0",
            minHeight: "42px",
            justifyContent: "space-between",
            gap: "8px",
            borderBottom: "1px solid rgba(128,128,128,0.2)",
            padding: "0 12px",
            background: "transparent",
        });
        const titleLabel = createLabel(this.title || "Dialog", this.theme, {
            minWidth: "unset",
            flexShrink: "1",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: "bold",
            color: theme.color.title,
        });
        const titleActions = createContainer(this.theme, {
            minHeight: "unset",
            width: "auto",
            justifyContent: "flex-end",
            gap: "6px",
            padding: "0",
            background: "transparent",
        });
        this.headerButtons.forEach((button) => {
            const buttonEl = createButton(button.label, this.theme, {
                minHeight: "26px",
                padding: "2px 10px",
                flex: "0",
                ...(button.options?.style ?? {}),
            });
            if (button.options?.dataRole) {
                buttonEl.dataset.role = button.options.dataRole;
            }
            buttonEl.addEventListener("click", () => button.onClick?.());
            titleActions.appendChild(buttonEl);
        });
        if (this.showCloseButton) {
            const closeButton = createButton("×", this.theme, {
                minHeight: "26px",
                minWidth: "28px",
                maxWidth: "28px",
                padding: "0",
                flex: "0",
                fontSize: "18px",
            });
            closeButton.addEventListener("click", () => this.close(null));
            titleActions.appendChild(closeButton);
        }
        titleBar.appendChild(titleLabel);
        titleBar.appendChild(titleActions);
        const content = createContainer(this.theme, {
            display: "flex",
            flex: "1",
            flexDirection: "column",
            alignItems: "stretch",
            overflowY: "auto",
            width: "100%",
            minHeight: "unset",
            gap: "16px",
            padding: "12px",
            background: "transparent",
        });
        if (this.content) {
            content.appendChild(this.content);
        }
        const buttonBar = createContainer(this.theme, {
            flexShrink: "0",
            minHeight: "44px",
            display: this.buttons.length > 0 ? "flex" : "none",
            justifyContent: "flex-end",
            gap: "8px",
            borderTop: "1px solid rgba(128,128,128,0.2)",
            padding: "0 12px",
            background: "transparent",
        });
        this.buttons.forEach((button) => {
            const buttonEl = createButton(button.label, this.theme, {
                minHeight: "30px",
                padding: "4px 12px",
                flex: "0",
                ...(button.options?.style ?? {}),
            });
            if (button.options?.disabled) {
                buttonEl.disabled = true;
                buttonEl.style.opacity = "0.6";
                buttonEl.style.cursor = "not-allowed";
            }
            buttonEl.addEventListener("click", (event) => {
                const result = button.onClick?.(event, this);
                if (result !== false) {
                    this.close(result);
                }
            });
            buttonBar.appendChild(buttonEl);
        });
        dialog.appendChild(titleBar);
        dialog.appendChild(content);
        if (this.buttons.length > 0) {
            dialog.appendChild(buttonBar);
        }
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        if (this.closeOnOverlay) {
            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) {
                    this.close(null);
                }
            });
        }
        if (this.closeOnEsc) {
            this.keydownHandler = (event) => {
                if (event.key === "Escape") {
                    this.close(null);
                }
            };
            window.addEventListener("keydown", this.keydownHandler);
        }
        this.overlayEl = overlay;
        this.dialogEl = dialog;
        this.titleBarEl = titleBar;
        this.contentEl = content;
        this.buttonBarEl = buttonBar;
        this.onOpenCallback?.(dialog);
        if (this.autoFocus) {
            const focusTarget = dialog.querySelector("button, input, select, textarea");
            focusTarget?.focus();
        }
    }
}
