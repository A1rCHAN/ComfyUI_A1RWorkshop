import { api } from "/scripts/api.js";
import { ModelMetadata } from "../data/config_model.js";
import { DialogBuilder, DIALOG_TYPE } from "../theme/dialog.js";
import { createPreviewEditor, EDITOR_MODE } from "./popover_editor.js";
const PREVIEW_API = "/api/a1rworkshop";
const SUPPORTED_FOLDERS = {
    checkpoints: "checkpoints",
    loras: "loras",
};
async function fetchAllModelPreviews() {
    const folders = Object.keys(SUPPORTED_FOLDERS).join(",");
    try {
        const resp = await api.fetchApi(`${PREVIEW_API}/all_model_previews?folders=${encodeURIComponent(folders)}`);
        if (!resp.ok)
            return [];
        const data = await resp.json();
        return data.models || [];
    }
    catch {
        return [];
    }
}
export function showPreviewManager() {
    return createPreviewManager();
}
export async function createPreviewManager(options = {}) {
    const { onClose = null } = options;
    const content = document.createElement("div");
    content.className = "a1r-pm-content";
    const grid = document.createElement("div");
    grid.className = "a1r-pm-grid";
    content.appendChild(grid);
    const builder = new DialogBuilder(DIALOG_TYPE.CUSTOM)
        .setTitle("Preview Manager")
        .setContent(content)
        .setCloseOnOverlayClick(true)
        .setCloseOnEsc(true)
        .setCloseButton(false)
        .setSize("720px", "90vw", "85vh")
        .setAutoFocus(false);
    builder.addButton("Close", "secondary", () => null);
    builder.onClose(() => onClose?.());
    const dialogPromise = builder.open();
    await renderGrid(grid, builder);
    return dialogPromise;
}
async function renderGrid(grid, builder) {
    grid.innerHTML = "";
    const loadingEl = document.createElement("div");
    loadingEl.className = "a1r-pm-loading";
    loadingEl.textContent = "Loading...";
    grid.appendChild(loadingEl);
    const models = await fetchAllModelPreviews();
    grid.innerHTML = "";
    const withPreviews = models.filter((m) => m.firstImage);
    for (const model of withPreviews) {
        grid.appendChild(createModelCard(model, grid, builder));
    }
    const addCard = document.createElement("div");
    addCard.className = "a1r-pm-card a1r-pm-card--add";
    addCard.addEventListener("click", () => {
        createPreviewEditor({
            mode: EDITOR_MODE.MANAGER_ADD,
            onDone: () => renderGrid(grid, builder),
        });
    });
    const addIcon = document.createElement("div");
    addIcon.className = "a1r-pm-add-icon";
    addIcon.textContent = "+";
    addCard.appendChild(addIcon);
    grid.appendChild(addCard);
}
function createModelCard(model, grid, builder) {
    const card = document.createElement("div");
    card.className = "a1r-pm-card";
    if (model.firstImage) {
        const img = document.createElement("img");
        img.className = "a1r-pm-card-img";
        img.src = model.firstImage;
        img.draggable = false;
        card.appendChild(img);
    }
    const overlay = document.createElement("div");
    overlay.className = "a1r-pm-card-overlay";
    const label = document.createElement("div");
    label.className = "a1r-pm-card-label";
    const metadata = new ModelMetadata(model.filename);
    label.textContent = metadata.getDisplayName();
    label.title = model.filename;
    overlay.appendChild(label);
    card.appendChild(overlay);
    card.addEventListener("click", () => {
        createPreviewEditor({
            mode: EDITOR_MODE.MANAGER_EDIT,
            folder: model.folder,
            filename: model.filename,
            onDone: () => renderGrid(grid, builder),
        });
    });
    return card;
}
