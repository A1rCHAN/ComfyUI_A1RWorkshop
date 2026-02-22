import { showToast } from "./style.js";

// ========== 配置常量 ==========

const API_ENDPOINT = "/api/a1rworkshop/config";
const CONFIG_KEYS = {
  EMBEDDING_TAGS: "EmbeddingTags"
};

// ========== 内部状态（模块私有） ==========

let _configCache = null;
let _isLoading = false;
let _loadPromise = null;
let _changeListeners = new Set();

// ========== ModelMetadata 类 ==========

export class ModelMetadata {
  constructor(path, sourceNode = null, widgetName = null) {
    this.path = path;
    this.name = this._extractName(path);
    this.displayName = this._extractNameWithoutExtension(path);
    this.sourceNode = sourceNode;
    this.widgetName = widgetName || (sourceNode ? this._extractWidgetName(sourceNode) : null);
    this._category = null
  };

  _extractName(fullPath) {
    if (!fullPath) return "unknown";
    const parts = fullPath.split(/[\/\\]/);
    return parts[parts.length - 1]
  };

  _extractNameWithoutExtension(fullPath) {
    const name = this._extractName(fullPath);
    const extensions = [
      '.safetensors',
      '.pt',
      '.pth',
      '.ckpt',
      '.bin',
      '.gguf',
      '.onnx',
      '.model',
      '.vae',
      '.clip',
      '.controlnet',
      '.ipadapter'
    ];

    const lowerName = name.toLowerCase();
    for (const ext of extensions) {
      if (lowerName.endsWith(ext)) {
        return name.slice(0, -ext.length)
      }
    };

    return name
  };

  _extractWidgetName(node) {
    const modelWidget = node.widgets?.find(w =>
      w.type === "combo" &&
      (w.name === "ckpt_name" ||
        w.name === "model_name" ||
        w.name === "lora_name" ||
        w.name === "unet_name" ||
        w.name === "clip_name" ||
        w.name === "vae_name" ||
        w.name === "controlnet_name" ||
        w.name === "ipadapter_name" ||
        w.name === "upscale_name" ||
        w.name.includes("model") ||
        w.name.includes("checkpoint"))
    );

    return modelWidget?.name || ""
  };

  getCategory() {
    if (this._category) return this._category;

    // 策略1: 如果有源节点，使用节点分析（更精确）
    if (this.sourceNode) {
      this._category = this._getCategoryFromNode(this.sourceNode, this.widgetName);
      return this._category
    };

    // 策略2: 回退到路径/widget名解析
    this._category = this._getCategoryFromPath(this.path, this.widgetName);
    return this._category
  };

  _getCategoryFromNode(node, widgetName) {
    // 优先使用 widgetName 推断
    if (widgetName) {
      const wn = widgetName.toLowerCase();
      if (wn.includes("ckpt") || wn.includes("checkpoint")) return "checkpoints";
      if (wn.includes("lora") || wn.includes("lycoris")) return "loras";
      if (wn.includes("unet")) return "unets";
      if (wn.includes("vae")) return "vaes";
      if (wn.includes("clip")) return "clips";
      if (wn.includes("controlnet")) return "controlnets";
      if (wn.includes("ipadapter")) return "ipadapters";
      if (wn.includes("upscale")) return "upscalers"
    };

    // 使用节点类型推断
    const nodeClass = (node.comfyClass || node.type || "").toLowerCase();
    if (nodeClass.includes("lora")) return "loras";
    if (nodeClass.includes("checkpoint") || nodeClass.includes("ckpt")) return "checkpoints";
    if (nodeClass.includes("unet")) return "unets";
    if (nodeClass.includes("vae")) return "vaes";
    if (nodeClass.includes("clip")) return "clips";
    if (nodeClass.includes("controlnet")) return "controlnets";
    if (nodeClass.includes("ipadapter")) return "ipadapters";
    if (nodeClass.includes("upscale")) return "upscalers";

    // 默认回退
    return this._getCategoryFromPath("", widgetName)
  };

  _getCategoryFromPath(modelPath, widgetName) {
    if (!modelPath) return "unknown";

    if (widgetName) {
      const wn = widgetName.toLowerCase();
      if (wn.includes("ckpt") || wn.includes("checkpoint")) return "checkpoints";
      if (wn.includes("lora")) return "loras";
      if (wn.includes("unet")) return "unets";
      if (wn.includes("vae")) return "vaes";
      if (wn.includes("clip")) return "clips";
      if (wn.includes("controlnet")) return "controlnets";
      if (wn.includes("ipadapter")) return "ipadapters";
      if (wn.includes("upscale")) return "upscalers";
    }

    const parts = modelPath.split(/[\/\\]/);
    const firstDir = parts[0]?.toLowerCase() || "unknown";
    const lower = modelPath.toLowerCase();

    if (lower.includes("lora") || lower.includes("lycoris")) return "loras";
    if (lower.includes("checkpoint") || lower.includes("checkpoints")) return "checkpoints";
    if (lower.includes("unet")) return "unets";
    if (lower.includes("vae")) return "vaes";
    if (lower.includes("clip")) return "clips";
    if (lower.includes("controlnet")) return "controlnets";
    if (lower.includes("ipadapter")) return "ipadapters";
    if (lower.includes("upscale")) return "upscalers";

    if (firstDir.includes("lora") || firstDir.includes("lycoris")) return "loras";
    if (firstDir.includes("checkpoint")) return "checkpoints";
    if (firstDir.includes("unet")) return "unets";
    if (firstDir.includes("vae")) return "vaes";
    if (firstDir.includes("clip")) return "clips";
    if (firstDir.includes("controlnet")) return "controlnets";
    if (firstDir.includes("ipadapter")) return "ipadapters";
    if (firstDir.includes("upscale")) return "upscalers";

    return "unknown"
  };

  getDisplayName() {
    return this.displayName
  };

  getFullFileName() {
    return this.name
  };

  getNodeType() {
    return this.sourceNode?.comfyClass || this.sourceNode?.type || "Unknown"
  };

  toJSON() {
    return {
      path: this.path,
      widgetName: this.widgetName,
      category: this.getCategory()
    }
  };

  static fromJSON(data, sourceNode = null) {
    const meta = new ModelMetadata(data.path, sourceNode, data.widgetName);
    if (data.category) meta._category = data.category;

    return meta
  }
};

// ========== TagsDatabase 类 ==========

export class TagsDatabase {
  constructor(rawData = {}) {
    this._data = this._normalizeData(rawData);
    this._nextIds = this._calculateNextIds()
  };

  _normalizeData(rawData) {
    // 确保所有类别都是对象格式
    const normalized = {};
    Object.entries(rawData).forEach(([category, entries]) => {
      if (typeof entries === "object" && entries !== null) {
        normalized[category] = { ...entries }
      }
    });

    return normalized
  };

  _calculateNextIds() {
    const nextIds = {};
    Object.keys(this._data).forEach(category => {
      const ids = Object.keys(this._data[category] || {})
        .map(Number)
        .filter(n => !isNaN(n));
      nextIds[category] = ids.length > 0 ? Math.max(...ids) + 1 : 1
    });

    return nextIds
  };

  // ========== CRUD 操作 ==========

  add(categoryOrMetadata, modelNameOrTags, tagsText) {
    let category, modelName, tags;

    if (categoryOrMetadata instanceof ModelMetadata) {
      const metadata = categoryOrMetadata;
      category = metadata.getCategory();
      modelName = metadata.path;
      tags = modelNameOrTags || "";
    } else {
      category = categoryOrMetadata;
      modelName = modelNameOrTags;
      tags = tagsText || "";
    }

    if (!category) category = "unknown";
    if (!this._data[category]) {
      this._data[category] = {};
      this._nextIds[category] = 1;
    }

    const baseName = this._extractModelName(modelName);
    if (!baseName) return null;

    // 检查是否已存在
    const existing = this.findByModelName(modelName);
    if (existing) {
      // 更新现有条目
      return this.update(existing.category, existing.id, modelName, tags);
    }

    const id = String(this._nextIds[category]++);
    this._data[category][id] = {
      Model: modelName,
      Tags: tags.trim()
    };

    this._notifyChange("add", { category, id, entry: this._data[category][id] });

    return {
      id,
      category,
      entry: this._data[category][id]
    };
  }

  update(category, id, modelName, tags) {
    if (!this._data[category]?.[id]) return false;

    this._data[category][id] = {
      Model: modelName,
      Tags: (tags || "").trim()
    };

    this._notifyChange("update", { category, id, entry: this._data[category][id] });
    return true;
  }

  delete(category, id) {
    if (!this._data[category]?.[id]) return false;

    const deletedEntry = this._data[category][id];
    delete this._data[category][id];

    // 清理空类别
    if (Object.keys(this._data[category]).length === 0) {
      delete this._data[category];
      delete this._nextIds[category];
    }

    this._notifyChange("delete", { category, id, entry: deletedEntry });
    return true;
  }

  deleteBatch(items) {
    const results = [];
    items.forEach(({ category, id }) => {
      results.push(this.delete(category, id));
    });
    return results.every(r => r);
  }

  findByModelName(modelName) {
    const baseName = this._extractModelName(modelName);

    // 先尝试快速路径：从路径推断类别
    const inferredCategory = new ModelMetadata(modelName).getCategory();
    if (this._data[inferredCategory]) {
      for (const [id, entry] of Object.entries(this._data[inferredCategory])) {
        if (this._extractModelName(entry.Model) === baseName) {
          return { id, category: inferredCategory, entry };
        }
      }
    }

    // 全局搜索
    for (const [category, entries] of Object.entries(this._data)) {
      for (const [id, entry] of Object.entries(entries)) {
        if (this._extractModelName(entry.Model) === baseName) {
          return { id, category, entry };
        }
      }
    }
    return null;
  }

  getOrCreate(modelName, widgetName = null, sourceNode = null) {
    const existing = this.findByModelName(modelName);
    if (existing) return existing;

    const metadata = new ModelMetadata(modelName, sourceNode, widgetName);
    return this.add(metadata, "");
  }

  getByCategory(category) {
    return this._data[category] || {};
  }

  getCategories() {
    return Object.keys(this._data);
  }

  toJSON() {
    return { ...this._data };
  }

  get count() {
    return Object.values(this._data).reduce((sum, entries) => 
      sum + Object.keys(entries).length, 0
    );
  }

  _extractModelName(fullName) {
    if (!fullName) return "";
    const parts = fullName.split(/[\/\\]/);
    return parts[parts.length - 1];
  }

  // ========== 事件系统 ==========

  _notifyChange(type, data) {
    _changeListeners.forEach(listener => {
      try {
        listener(type, data, this);
      } catch (err) {
        console.warn("[TagsDatabase] Change listener error:", err);
      }
    });
  }

  onChange(listener) {
    _changeListeners.add(listener);
    return () => _changeListeners.delete(listener);
  }
}

// ========== ConfigManager 单例（API 交互层） ==========

class ConfigManager {
  constructor() {
    this._db = null;
    this._isInitialized = false;
  }

  async init() {
    if (this._isInitialized) return this._db;
    if (_isLoading) return _loadPromise;

    _isLoading = true;
    _loadPromise = this._loadFromAPI();

    try {
      const data = await _loadPromise;
      this._db = new TagsDatabase(data);
      this._isInitialized = true;
      _configCache = this._db;
      return this._db;
    } finally {
      _isLoading = false;
      _loadPromise = null;
    }
  }

  async _loadFromAPI() {
    try {
      const response = await fetch(API_ENDPOINT);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const config = await response.json();
      return config[CONFIG_KEYS.EMBEDDING_TAGS] || {};
    } catch (err) {
      console.warn("[ConfigManager] Failed to load config:", err);
      return {};
    }
  }

  async save() {
    if (!this._db) throw new Error("Config not initialized");

    const config = {
      [CONFIG_KEYS.EMBEDDING_TAGS]: this._db.toJSON()
    };

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      showToast("Configuration saved", "success");
      return true;
    } catch (err) {
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

// ========== 导出单例实例 ==========

export const configManager = new ConfigManager();

// ========== 便捷导出函数（常用操作简化） ==========

/**
 * 初始化配置（在扩展 setup 中调用）
 */
export async function initConfig() {
  return configManager.init();
}

/**
 * 获取标签数据库
 */
export function getTagsDB() {
  return configManager.db;
}

/**
 * 保存配置
 */
export async function saveConfig() {
  return configManager.save();
}

/**
 * 重新加载配置
 */
export async function reloadConfig() {
  return configManager.reload();
}

/**
 * 检查配置是否已加载
 */
export function isConfigReady() {
  return configManager.isInitialized;
}

// ========== 模型收集工具函数（从 model_tag.js 迁移） ==========

/**
 * 从 ComfyUI 图中收集所有可用模型
 * 返回按类别分组的 ModelMetadata 映射
 */
export function collectModelsFromGraph(app) {
  const modelsByCategory = new Map();

  if (!app?.graph?._nodes) return modelsByCategory;

  app.graph._nodes.forEach(node => {
    if (!isModelLoaderNode(node)) return;

    const models = getModelListFromNode(node);
    const widgetName = getModelWidgetName(node);

    models.forEach(modelPath => {
      const metadata = new ModelMetadata(modelPath, node, widgetName);
      const category = metadata.getCategory();

      if (!modelsByCategory.has(category)) {
        modelsByCategory.set(category, new Map());
      }

      const categoryMap = modelsByCategory.get(category);
      if (!categoryMap.has(modelPath)) {
        categoryMap.set(modelPath, metadata);
      }
    });
  });

  return modelsByCategory;
}

// ========== 节点检测工具（从 model_tag.js 迁移） ==========

const MODEL_LOADER_CLASSES = [
  "CheckpointLoaderSimple", "CheckpointLoader", "UNETLoader",
  "CLIPLoader", "VAELoader", "LoraLoader", "LoraLoaderModelOnly",
  "ControlNetLoader", "DiffControlNetLoader", "StyleModelLoader",
  "CLIPVisionLoader", "IPAdapterModelLoader", "UpscaleModelLoader",
  "UNETLoaderGGUF", "DualCLIPLoader", "TripleCLIPLoader",
  "UNETLoaderINPAINT", "VideoLinearCFGGuidance",
  "ImageOnlyCheckpointLoader", "SVD_img2vid_Conditioning",
  "InpaintModelConditioning", "LoadDiffusionModel", "LoadCLIP",
  "LoadVAE", "LoadLoRA", "LoadCheckpoint"
];

export function isModelLoaderNode(node) {
  if (!node) return false;
  if (MODEL_LOADER_CLASSES.includes(node.comfyClass)) return true;
  if (MODEL_LOADER_CLASSES.includes(node.type)) return true;

  const hasModelOutput = node.outputs?.some(output =>
    ["MODEL", "CLIP", "VAE", "CHECKPOINT", "UNET", "LORA"].includes(output.type)
  );
  const hasModelInput = node.inputs?.some(input =>
    ["MODEL", "CLIP", "VAE", "CHECKPOINT", "UNET"].includes(input.type)
  );

  return hasModelOutput || hasModelInput;
}

export function getModelListFromNode(node) {
  const modelWidget = node.widgets?.find(w =>
    w.type === "combo" &&
    (w.name === "ckpt_name" ||
      w.name === "model_name" ||
      w.name === "lora_name" ||
      w.name === "unet_name" ||
      w.name === "clip_name" ||
      w.name === "vae_name" ||
      w.name.includes("model") ||
      w.name.includes("checkpoint"))
  );

  if (modelWidget?.options?.values) {
    const values = Array.isArray(modelWidget.options.values)
      ? modelWidget.options.values
      : modelWidget.options.values();
    return values;
  }
  return [];
}

export function getModelWidgetName(node) {
  const modelWidget = node.widgets?.find(w =>
    w.type === "combo" &&
    (w.name === "ckpt_name" ||
      w.name === "model_name" ||
      w.name === "lora_name" ||
      w.name === "unet_name" ||
      w.name === "clip_name" ||
      w.name === "vae_name" ||
      w.name === "controlnet_name" ||
      w.name === "ipadapter_name" ||
      w.name === "upscale_name" ||
      w.name.includes("model") ||
      w.name.includes("checkpoint"))
  );
  return modelWidget?.name || "";
}

export function getModelFromNode(node) {
  const modelWidget = node.widgets?.find(w =>
    w.type === "combo" &&
    (w.name === "ckpt_name" ||
      w.name === "model_name" ||
      w.name === "lora_name" ||
      w.name === "unet_name" ||
      w.name === "clip_name" ||
      w.name === "vae_name" ||
      w.name.includes("model") ||
      w.name.includes("checkpoint"))
  );
  return modelWidget?.value || "";
}

/**
 * 保存配置，但过滤掉空tags的条目
 * 如果没有有效数据，则不写入文件
 * @returns {Promise<boolean>} 是否有实际数据被保存
 */
export async function saveFilteredConfig(db) {
  if (!db) {
    db = configManager.db;
  }

  // 创建过滤后的数据副本
  const filteredData = {};
  let hasValidData = false;

  Object.entries(db.toJSON()).forEach(([category, entries]) => {
    const filteredEntries = {};
    
    Object.entries(entries).forEach(([id, entry]) => {
      // 只保留有非空tags的条目
      if (entry.Tags && entry.Tags.trim().length > 0) {
        filteredEntries[id] = entry;
        hasValidData = true;
      }
    });

    if (Object.keys(filteredEntries).length > 0) {
      filteredData[category] = filteredEntries;
    }
  });

  // 如果没有有效数据，直接返回false，不调用API
  if (!hasValidData) {
    console.log("[ConfigManager] No valid data to save, skipping API call");
    return false;
  }

  // 构建配置对象
  const config = {
    [CONFIG_KEYS.EMBEDDING_TAGS]: filteredData
  };

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    showToast("Configuration saved", "success");
    return true;
  } catch (err) {
    console.error("[ConfigManager] Failed to save config:", err);
    showToast("Failed to save configuration", "error");
    return false;
  }
}

// 默认导出
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
  getModelFromNode
};