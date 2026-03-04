import { showToast as themedShowToast } from "../theme/themeUtils.js";
const API_ENDPOINT = "/api/a1rworkshop/config";
const CONFIG_KEYS = { EMBEDDING_TAGS: "EmbeddingTags" };
let _configCache = null;
let _isLoading = false;
let _loadPromise = null;
const _changeListeners = new Set();
let _lastSavedJSON = null;
function showToast(message, type = "success", duration = 2500) {
    themedShowToast({}, {}, message, type, duration);
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
export class ModelMetadata {
    constructor(path, sourceNode = null, widgetName = null) {
        this._category = null;
        this._relativePath = null;
        this._storagePath = null;
        this.path = path;
        this.name = this.extractName(path);
        this.displayName = this.extractNameWithoutExtension(path);
        this.sourceNode = sourceNode;
        this.widgetName = widgetName || (sourceNode ? this.extractWidgetName(sourceNode) : "");
    }
    extractName(fullPath) {
        if (!fullPath)
            return "unknown";
        const parts = fullPath.split(/[\/\\]/);
        return parts[parts.length - 1] || "unknown";
    }
    extractNameWithoutExtension(fullPath) {
        const name = this.extractName(fullPath);
        const lowerName = name.toLowerCase();
        const sortedExts = [...ModelMetadata.MODEL_EXTENSIONS].sort((a, b) => b.length - a.length);
        for (const ext of sortedExts) {
            if (lowerName.endsWith(ext)) {
                return name.slice(0, -ext.length);
            }
        }
        return name;
    }
    extractWidgetName(node) {
        const modelWidget = node.widgets?.find((widget) => widget.type === "combo" &&
            (widget.name === "ckpt_name" ||
                widget.name === "model_name" ||
                widget.name === "lora_name" ||
                widget.name === "unet_name" ||
                widget.name === "clip_name" ||
                widget.name === "vae_name" ||
                widget.name === "controlnet_name" ||
                widget.name === "ipadapter_name" ||
                widget.name === "upscale_name" ||
                widget.name.includes("model") ||
                widget.name.includes("checkpoint")));
        return modelWidget?.name || "";
    }
    normalizeCategoryName(rawName) {
        const name = rawName.toLowerCase();
        const mappings = {
            checkpoints: "checkpoints",
            checkpoint: "checkpoints",
            loras: "loras",
            lora: "loras",
            lycoris: "loras",
            unets: "unets",
            unet: "unets",
            vaes: "vaes",
            vae: "vaes",
            clips: "clips",
            clip: "clips",
            controlnets: "controlnets",
            controlnet: "controlnets",
            ipadapters: "ipadapters",
            ipadapter: "ipadapters",
            upscalers: "upscalers",
            upscale: "upscalers",
            upscale_models: "upscalers",
        };
        return mappings[name] || name;
    }
    getCategoryFromWidgetName(widgetName) {
        const value = widgetName.toLowerCase();
        if (value.includes("ckpt") || value.includes("checkpoint"))
            return "checkpoints";
        if (value.includes("lora") || value.includes("lycoris"))
            return "loras";
        if (value.includes("unet"))
            return "unets";
        if (value.includes("vae"))
            return "vaes";
        if (value.includes("clip"))
            return "clips";
        if (value.includes("controlnet"))
            return "controlnets";
        if (value.includes("ipadapter"))
            return "ipadapters";
        if (value.includes("upscale"))
            return "upscalers";
        return null;
    }
    parseModelPath(fullPath) {
        if (!fullPath) {
            return { category: "unknown", relativePath: fullPath, rawCategory: "unknown" };
        }
        const normalizedPath = fullPath.replace(/\\/g, "/");
        const modelsMatch = normalizedPath.match(/[\/\\]models[\/\\]([^\/\\]+)[\/\\](.+)$/i);
        if (modelsMatch) {
            const rawCategory = modelsMatch[1] || "unknown";
            const relativePath = modelsMatch[2] || this.extractName(fullPath);
            return {
                category: this.normalizeCategoryName(rawCategory),
                relativePath,
                rawCategory,
            };
        }
        const categoryPatterns = [
            { pattern: /[\/\\](checkpoints?)[\/\\]/i, category: "checkpoints" },
            { pattern: /[\/\\](loras?|lycoris)[\/\\]/i, category: "loras" },
            { pattern: /[\/\\](unets?)[\/\\]/i, category: "unets" },
            { pattern: /[\/\\](vaes?)[\/\\]/i, category: "vaes" },
            { pattern: /[\/\\](clips?)[\/\\]/i, category: "clips" },
            { pattern: /[\/\\](controlnets?)[\/\\]/i, category: "controlnets" },
            { pattern: /[\/\\](ipadapters?)[\/\\]/i, category: "ipadapters" },
            { pattern: /[\/\\](upscalers?|upscale_models)[\/\\]/i, category: "upscalers" },
        ];
        for (const { pattern, category } of categoryPatterns) {
            const match = normalizedPath.match(pattern);
            if (match) {
                const marker = match[0];
                const afterCategory = normalizedPath.split(marker)[1] || this.extractName(fullPath);
                return {
                    category,
                    relativePath: afterCategory,
                    rawCategory: match[1] || category,
                };
            }
        }
        return {
            category: "unknown",
            relativePath: normalizedPath,
            rawCategory: "unknown",
        };
    }
    getCategory() {
        if (this._category)
            return this._category;
        if (this.widgetName) {
            const fromWidget = this.getCategoryFromWidgetName(this.widgetName);
            if (fromWidget) {
                this._category = fromWidget;
                return fromWidget;
            }
        }
        const parsed = this.parseModelPath(this.path);
        this._category = parsed.category;
        this._relativePath = parsed.relativePath;
        return this._category;
    }
    getRelativePath() {
        if (this._relativePath)
            return this._relativePath;
        const parsed = this.parseModelPath(this.path);
        this._relativePath = parsed.relativePath;
        return this._relativePath;
    }
    getStoragePath() {
        if (this._storagePath)
            return this._storagePath;
        this._storagePath = this.getRelativePath().replace(/\//g, "\\");
        return this._storagePath;
    }
    getDisplayPath() {
        return this.getRelativePath();
    }
    getManagerDisplayName() {
        const relativePath = this.getRelativePath();
        const fileName = relativePath.split(/[\/\\]/).pop() || this.name;
        return this.extractNameWithoutExtension(fileName);
    }
    getDisplayName() {
        return this.displayName;
    }
    getFullFileName() {
        return this.name;
    }
    getNodeType() {
        return this.sourceNode?.comfyClass || this.sourceNode?.type || "Unknown";
    }
    toJSON() {
        return {
            path: this.path,
            widgetName: this.widgetName,
            category: this.getCategory(),
        };
    }
    static fromJSON(data, sourceNode = null) {
        const metadata = new ModelMetadata(data.path, sourceNode, data.widgetName ?? null);
        if (data.category) {
            metadata._category = data.category;
        }
        return metadata;
    }
}
ModelMetadata.MODEL_EXTENSIONS = [
    ".safetensors",
    ".sft",
    ".pt",
    ".pth",
    ".ckpt",
    ".bin",
    ".gguf",
    ".onnx",
    ".model",
    ".vae",
    ".clip",
    ".controlnet",
    ".ipadapter",
    ".lora",
    ".lycoris",
    ".upscale",
    ".upscaler",
    ".unet",
    ".diffusion",
    ".inpaint",
];
export class TagsDatabase {
    constructor(rawData = {}) {
        this._data = this.normalizeData(rawData);
        this._nextIds = this.calculateNextIds();
    }
    normalizeData(rawData) {
        const normalized = {};
        Object.entries(rawData).forEach(([category, entries]) => {
            if (isRecord(entries)) {
                const sanitizedEntries = {};
                Object.entries(entries).forEach(([id, entry]) => {
                    if (isRecord(entry)) {
                        const rawTags = entry.Tags;
                        const finalTags = { positive: "", negative: "" };
                        if (typeof rawTags === "string") {
                            finalTags.positive = rawTags;
                        }
                        else if (isRecord(rawTags)) {
                            finalTags.positive = String(rawTags.positive || "");
                            finalTags.negative = String(rawTags.negative || "");
                        }
                        sanitizedEntries[id] = {
                            Model: String(entry.Model ?? ""),
                            Tags: finalTags,
                        };
                    }
                });
                normalized[category] = sanitizedEntries;
            }
        });
        return normalized;
    }
    calculateNextIds() {
        const nextIds = {};
        Object.keys(this._data).forEach((category) => {
            const ids = Object.keys(this._data[category] || {})
                .map(Number)
                .filter((value) => !Number.isNaN(value));
            nextIds[category] = ids.length > 0 ? Math.max(...ids) + 1 : 1;
        });
        return nextIds;
    }
    add(categoryOrMetadata, modelNameOrTags, tagsValues) {
        let category;
        let modelPath;
        let tags;
        if (categoryOrMetadata instanceof ModelMetadata) {
            category = categoryOrMetadata.getCategory();
            modelPath = categoryOrMetadata.getStoragePath();
            const rawTags = modelNameOrTags;
            if (typeof rawTags === "object" && rawTags !== null) {
                tags = rawTags;
            }
            else {
                tags = { positive: String(rawTags || ""), negative: "" };
            }
        }
        else {
            category = categoryOrMetadata || "unknown";
            modelPath = String(modelNameOrTags || "");
            const rawTags = tagsValues;
            if (typeof rawTags === "object" && rawTags !== null) {
                tags = rawTags;
            }
            else {
                tags = { positive: String(rawTags || ""), negative: "" };
            }
        }
        // Ensure safe strings
        tags.positive = tags.positive?.trim() || "";
        tags.negative = tags.negative?.trim() || "";
        if (!this._data[category]) {
            this._data[category] = {};
            this._nextIds[category] = 1;
        }
        const existing = this.findByModelName(modelPath);
        if (existing) {
            this.update(existing.category, existing.id, modelPath, tags);
            return {
                id: existing.id,
                category: existing.category,
                entry: this._data[existing.category][existing.id],
            };
        }
        const id = String(this._nextIds[category]++);
        this._data[category][id] = {
            Model: modelPath,
            Tags: tags,
        };
        this.notifyChange("add", { category, id, entry: this._data[category][id] });
        return { id, category, entry: this._data[category][id] };
    }
    findByModelName(modelName) {
        const searchName = this.normalizeModelName(modelName);
        const inferredCategory = new ModelMetadata(modelName).getCategory();
        if (inferredCategory !== "unknown" && this._data[inferredCategory]) {
            for (const [id, entry] of Object.entries(this._data[inferredCategory])) {
                if (this.matchModelName(entry.Model, searchName)) {
                    return { id, category: inferredCategory, entry };
                }
            }
        }
        for (const [category, entries] of Object.entries(this._data)) {
            for (const [id, entry] of Object.entries(entries)) {
                if (this.matchModelName(entry.Model, searchName)) {
                    return { id, category, entry };
                }
            }
        }
        return null;
    }
    normalizeModelName(modelPath) {
        if (!modelPath)
            return "";
        const normalized = modelPath.replace(/\\/g, "/");
        const parts = normalized.split("/");
        if (parts.length > 1 && normalized.includes("/")) {
            return parts.slice(-2).join("/");
        }
        return parts.pop() || modelPath;
    }
    matchModelName(storedPath, searchPath) {
        if (!storedPath || !searchPath)
            return false;
        if (storedPath === searchPath)
            return true;
        const stored = storedPath.replace(/\\/g, "/").toLowerCase();
        const search = searchPath.replace(/\\/g, "/").toLowerCase();
        if (stored === search)
            return true;
        if (stored.endsWith("/" + search))
            return true;
        if (search.endsWith("/" + stored))
            return true;
        const storedFile = stored.split("/").pop();
        const searchFile = search.split("/").pop();
        return storedFile === searchFile;
    }
    update(category, id, modelName, tags) {
        if (!this._data[category]?.[id])
            return false;
        let finalTags;
        if (typeof tags === "string") {
            finalTags = { positive: tags.trim(), negative: "" };
        }
        else {
            finalTags = {
                positive: tags.positive?.trim() || "",
                negative: tags.negative?.trim() || ""
            };
        }
        if (!finalTags.positive && !finalTags.negative) {
            return this.delete(category, id);
        }
        this._data[category][id] = {
            Model: modelName,
            Tags: finalTags,
        };
        this.notifyChange("update", { category, id, entry: this._data[category][id] });
        return true;
    }
    delete(category, id) {
        if (!this._data[category]?.[id])
            return false;
        const deletedEntry = this._data[category][id];
        delete this._data[category][id];
        if (Object.keys(this._data[category]).length === 0) {
            delete this._data[category];
            delete this._nextIds[category];
        }
        this.notifyChange("delete", { category, id, entry: deletedEntry });
        return true;
    }
    deleteBatch(items) {
        const results = items.map(({ category, id }) => this.delete(category, id));
        return results.every(Boolean);
    }
    getOrCreate(modelName, widgetName = null, sourceNode = null) {
        const existing = this.findByModelName(modelName);
        if (existing)
            return existing;
        const metadata = new ModelMetadata(modelName, sourceNode, widgetName);
        return this.add(metadata, "");
    }
    getByCategory(category) {
        return this._data[category] || {};
    }
    getCategories() {
        return Object.keys(this._data).sort(sortCategories);
    }
    toJSON() {
        return { ...this._data };
    }
    get count() {
        return Object.values(this._data).reduce((sum, entries) => sum + Object.keys(entries).length, 0);
    }
    notifyChange(type, data) {
        _changeListeners.forEach((listener) => {
            try {
                listener(type, data, this);
            }
            catch (err) {
                console.warn("[TagsDatabase] Change listener error:", err);
            }
        });
    }
    onChange(listener) {
        _changeListeners.add(listener);
        return () => _changeListeners.delete(listener);
    }
}
class ConfigManager {
    constructor() {
        this._db = null;
        this._isInitialized = false;
    }
    async init() {
        if (this._isInitialized && this._db)
            return this._db;
        if (_isLoading && _loadPromise) {
            const data = await _loadPromise;
            this._db = new TagsDatabase(data);
            this._isInitialized = true;
            return this._db;
        }
        _isLoading = true;
        _loadPromise = this.loadFromAPI();
        try {
            const data = await _loadPromise;
            this._db = new TagsDatabase(data);
            this._isInitialized = true;
            _configCache = this._db;
            _lastSavedJSON = buildFilteredJSON(this._db);
            return this._db;
        }
        finally {
            _isLoading = false;
            _loadPromise = null;
        }
    }
    async loadFromAPI() {
        try {
            const response = await fetch(API_ENDPOINT);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const config = (await response.json());
            const payload = config[CONFIG_KEYS.EMBEDDING_TAGS];
            return isRecord(payload) ? payload : {};
        }
        catch (err) {
            console.warn("[ConfigManager] Failed to load config:", err);
            return {};
        }
    }
    async save() {
        if (!this._db) {
            throw new Error("Config not initialized");
        }
        const filteredData = buildFilteredData(this._db);
        const config = { [CONFIG_KEYS.EMBEDDING_TAGS]: filteredData };
        try {
            const response = await fetch(API_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            _lastSavedJSON = JSON.stringify(filteredData);
            showToast("Configuration saved", "success");
            return true;
        }
        catch (err) {
            console.error("[ConfigManager] Failed to save config:", err);
            showToast("Failed to save configuration", "error");
            return false;
        }
    }
    get db() {
        if (!this._db) {
            throw new Error("Config not initialized. Call init() first.");
        }
        return this._db;
    }
    get isInitialized() {
        return this._isInitialized;
    }
    async reload() {
        this._isInitialized = false;
        this._db = null;
        return this.init();
    }
}
export const configManager = new ConfigManager();
export async function initConfig() {
    return configManager.init();
}
export function getTagsDB() {
    return configManager.db;
}
export async function saveConfig() {
    return configManager.save();
}
export async function reloadConfig() {
    return configManager.reload();
}
export function isConfigReady() {
    return configManager.isInitialized;
}
export function collectModelsFromGraph(app) {
    const modelsByCategory = new Map();
    if (!app?.graph?._nodes)
        return modelsByCategory;
    app.graph._nodes.forEach((node) => {
        if (!isModelLoaderNode(node))
            return;
        const models = getModelListFromNode(node);
        const widgetName = getModelWidgetName(node);
        models.forEach((modelPath) => {
            const metadata = new ModelMetadata(modelPath, node, widgetName);
            const category = metadata.getCategory();
            if (!modelsByCategory.has(category)) {
                modelsByCategory.set(category, new Map());
            }
            const categoryMap = modelsByCategory.get(category);
            if (categoryMap && !categoryMap.has(modelPath)) {
                categoryMap.set(modelPath, metadata);
            }
        });
    });
    return modelsByCategory;
}
const MODEL_LOADER_CLASSES = [
    "CheckpointLoaderSimple",
    "CheckpointLoader",
    "UNETLoader",
    "CLIPLoader",
    "VAELoader",
    "LoraLoader",
    "LoraLoaderModelOnly",
    "ControlNetLoader",
    "DiffControlNetLoader",
    "StyleModelLoader",
    "CLIPVisionLoader",
    "IPAdapterModelLoader",
    "UpscaleModelLoader",
    "UNETLoaderGGUF",
    "DualCLIPLoader",
    "TripleCLIPLoader",
    "UNETLoaderINPAINT",
    "VideoLinearCFGGuidance",
    "ImageOnlyCheckpointLoader",
    "SVD_img2vid_Conditioning",
    "InpaintModelConditioning",
    "LoadDiffusionModel",
    "LoadCLIP",
    "LoadVAE",
    "LoadLoRA",
    "LoadCheckpoint",
];
export function isModelLoaderNode(node) {
    if (!node)
        return false;
    if (node.comfyClass && MODEL_LOADER_CLASSES.includes(node.comfyClass))
        return true;
    if (node.type && MODEL_LOADER_CLASSES.includes(node.type))
        return true;
    const hasModelOutput = node.outputs?.some((output) => ["MODEL", "CLIP", "VAE", "CHECKPOINT", "UNET", "LORA"].includes(output.type || ""));
    const hasModelInput = node.inputs?.some((input) => ["MODEL", "CLIP", "VAE", "CHECKPOINT", "UNET"].includes(input.type || ""));
    return Boolean(hasModelOutput || hasModelInput);
}
export function getModelListFromNode(node) {
    if (!node)
        return [];
    const modelWidget = node.widgets?.find((widget) => widget.type === "combo" &&
        (widget.name === "ckpt_name" ||
            widget.name === "model_name" ||
            widget.name === "lora_name" ||
            widget.name === "unet_name" ||
            widget.name === "clip_name" ||
            widget.name === "vae_name" ||
            widget.name.includes("model") ||
            widget.name.includes("checkpoint")));
    const values = modelWidget?.options?.values;
    if (!values)
        return [];
    return Array.isArray(values) ? values : values();
}
export function getModelWidgetName(node) {
    if (!node)
        return "";
    const modelWidget = node.widgets?.find((widget) => widget.type === "combo" &&
        (widget.name === "ckpt_name" ||
            widget.name === "model_name" ||
            widget.name === "lora_name" ||
            widget.name === "unet_name" ||
            widget.name === "clip_name" ||
            widget.name === "vae_name" ||
            widget.name === "controlnet_name" ||
            widget.name === "ipadapter_name" ||
            widget.name === "upscale_name" ||
            widget.name.includes("model") ||
            widget.name.includes("checkpoint")));
    return modelWidget?.name || "";
}
export function getModelFromNode(node) {
    if (!node)
        return "";
    const modelWidget = node.widgets?.find((widget) => widget.type === "combo" &&
        (widget.name === "ckpt_name" ||
            widget.name === "model_name" ||
            widget.name === "lora_name" ||
            widget.name === "unet_name" ||
            widget.name === "clip_name" ||
            widget.name === "vae_name" ||
            widget.name.includes("model") ||
            widget.name.includes("checkpoint")));
    return String(modelWidget?.value || "");
}
function sortCategories(a, b) {
    const rank = (category) => {
        if (category === "checkpoints")
            return 0;
        if (category === "loras")
            return 1;
        return 2;
    };
    const rankA = rank(a);
    const rankB = rank(b);
    if (rankA !== rankB)
        return rankA - rankB;
    return a.localeCompare(b);
}
function buildFilteredData(db) {
    const filteredData = {};
    const sortedCategories = Object.keys(db.toJSON()).sort(sortCategories);
    sortedCategories.forEach((category) => {
        const entries = db.toJSON()[category] || {};
        const filteredEntries = {};
        Object.entries(entries).forEach(([id, entry]) => {
            const hasPositive = entry.Tags?.positive && entry.Tags.positive.trim().length > 0;
            const hasNegative = entry.Tags?.negative && entry.Tags.negative.trim().length > 0;
            if (hasPositive || hasNegative) {
                filteredEntries[id] = {
                    Model: entry.Model,
                    Tags: {
                        positive: entry.Tags.positive || "",
                        negative: entry.Tags.negative || ""
                    }
                };
            }
        });
        if (Object.keys(filteredEntries).length > 0) {
            filteredData[category] = filteredEntries;
        }
    });
    return filteredData;
}
function buildFilteredJSON(db) {
    return JSON.stringify(buildFilteredData(db));
}
export async function saveFilteredConfig(db) {
    const targetDb = db ?? configManager.db;
    const filteredData = buildFilteredData(targetDb);
    const currentJSON = JSON.stringify(filteredData);
    if (_lastSavedJSON !== null && currentJSON === _lastSavedJSON) {
        return "unchanged";
    }
    const config = { [CONFIG_KEYS.EMBEDDING_TAGS]: filteredData };
    try {
        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        _lastSavedJSON = currentJSON;
        showToast("Configuration saved", "success");
        return true;
    }
    catch (err) {
        console.error("[ConfigManager] Failed to save config:", err);
        showToast("Failed to save configuration", "error");
        return false;
    }
}
export default {
    ModelMetadata,
    TagsDatabase,
    configManager,
    initConfig,
    getTagsDB,
    saveConfig,
    saveFilteredConfig,
    reloadConfig,
    isConfigReady,
    collectModelsFromGraph,
    isModelLoaderNode,
    getModelListFromNode,
    getModelWidgetName,
    getModelFromNode,
};
