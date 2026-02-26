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
    this._category = null;
    this._relativePath = null;
    this._storagePath = null
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
      '.sft',
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
      '.ipadapter',
      '.lora',
      '.lycoris',
      '.upscale',
      '.upscaler',
      '.unet',
      '.diffusion',
      '.inpaint'
    ];

    const lowerName = name.toLowerCase();
    const sortedExts = extensions.sort((a, b) => b.length - a.length);

    for (const ext of sortedExts) {
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
      if (wn.includes("lora") || wn.includes("lycoris")) return "loras";
      if (wn.includes("unet")) return "unets";
      if (wn.includes("vae")) return "vaes";
      if (wn.includes("clip")) return "clips";
      if (wn.includes("controlnet")) return "controlnets";
      if (wn.includes("ipadapter")) return "ipadapters";
      if (wn.includes("upscale")) return "upscalers"
    };

    const lower = modelPath.toLowerCase();

    if (/[\\\/]checkpoints?[\\\/]/i.test(modelPath)) return "checkpoints";
    if (/[\\\/]loras?[\\\/]/i.test(modelPath)) return "loras";
    if (/[\\\/]unets?[\\\/]/i.test(modelPath)) return "unets";
    if (/[\\\/]vaes?[\\\/]/i.test(modelPath)) return "vaes";
    if (/[\\\/]clips?[\\\/]/i.test(modelPath)) return "clips";
    if (/[\\\/]controlnets?[\\\/]/i.test(modelPath)) return "controlnets";
    if (/[\\\/]ipadapters?[\\\/]/i.test(modelPath)) return "ipadapters";
    if (/[\\\/]upscalers?[\\\/]/i.test(modelPath)) return "upscalers";

    const parts = modelPath.split(/[\/\\]/);

    for (const part of parts) {
      const dir = part.toLowerCase();
      if (dir === "checkpoints" || dir === "checkpoint" || dir === "models") return "checkpoints";
      if (dir === "loras" || dir === "lycoris" || dir === "lora") return "loras";
      if (dir === "unet" || dir === "unets" || dir === "diffusion_models") return "unets";
      if (dir === "vae" || dir === "vaes") return "vaes";
      if (dir === "clip" || dir === "clips") return "clips";
      if (dir === "controlnet" || dir === "controlnets") return "controlnets";
      if (dir === "ipadapter" || dir === "ipadapters") return "ipadapters";
      if (dir === "upscale" || dir === "upscalers" || dir === "upscale_models") return "upscalers";
  }

    const fileName = parts[parts.length - 1].toLowerCase();
    if (fileName.includes("checkpoint") || fileName.includes("ckpt") || fileName.includes(".ckpt")) return "checkpoints";
    if (fileName.includes("lora") || fileName.includes("lycoris")) return "loras";
    if (fileName.includes("unet")) return "unets";
    if (fileName.includes("vae")) return "vaes";
    if (fileName.includes("clip")) return "clips";
    if (fileName.includes("controlnet")) return "controlnets";
    if (fileName.includes("ipadapter")) return "ipadapters";
    if (fileName.includes("upscale")) return "upscalers";

    return "unknown"
  };

    /**
   * 从路径中提取类别和相对路径
   * 路径格式: .../models/checkpoints/SubFolder/File.safetensors
   * 返回: { category: 'checkpoints', relativePath: 'SubFolder/File.safetensors' }
   */
  _parseModelPath(fullPath) {
    if (!fullPath) return { category: 'unknown', relativePath: fullPath };

    // 统一使用正斜杠处理
    const normalizedPath = fullPath.replace(/\\/g, '/');
    
    // 匹配 models/类别/... 或 models\类别\... 格式
    const modelsMatch = normalizedPath.match(/[\/\\]models[\/\\]([^\/\\]+)[\/\\](.+)$/i);
    
    if (modelsMatch) {
      const category = modelsMatch[1].toLowerCase();
      const relativePath = modelsMatch[2];  // SubFolder/File.safetensors
      
      // 标准化类别名（复数转单数或统一格式）
      const normalizedCategory = this._normalizeCategoryName(category);
      
      return {
        category: normalizedCategory,
        relativePath: relativePath,
        rawCategory: category
      }
    };

    // 回退：尝试直接匹配已知类别文件夹
    const categoryPatterns = [
      { pattern: /[\/\\](checkpoints?)[\/\\]/i, category: 'checkpoints' },
      { pattern: /[\/\\](loras?|lycoris)[\/\\]/i, category: 'loras' },
      { pattern: /[\/\\](unets?)[\/\\]/i, category: 'unets' },
      { pattern: /[\/\\](vaes?)[\/\\]/i, category: 'vaes' },
      { pattern: /[\/\\](clips?)[\/\\]/i, category: 'clips' },
      { pattern: /[\/\\](controlnets?)[\/\\]/i, category: 'controlnets' },
      { pattern: /[\/\\](ipadapters?)[\/\\]/i, category: 'ipadapters' },
      { pattern: /[\/\\](upscalers?|upscale_models)[\/\\]/i, category: 'upscalers' }
    ];

    for (const { pattern, category } of categoryPatterns) {
      const match = normalizedPath.match(pattern);
      if (match) {
        // 提取类别后的路径
        const afterCategory = normalizedPath.split(match[0])[1];
        return {
          category: category,
          relativePath: afterCategory || this._extractName(fullPath),
          rawCategory: match[1]
        }
      }
    };

    // 最终回退
    return {
      category: 'unknown',
      relativePath: this._extractName(fullPath),
      rawCategory: 'unknown'
    }
  };

  /**
   * 标准化类别名称
   */
  _normalizeCategoryName(rawName) {
    const name = rawName.toLowerCase();
    
    // 复数转单数标准化
    const mappings = {
      'checkpoints': 'checkpoints',
      'checkpoint': 'checkpoints',
      'loras': 'loras',
      'lora': 'loras',
      'lycoris': 'loras',
      'unets': 'unets',
      'unet': 'unets',
      'vaes': 'vaes',
      'vae': 'vaes',
      'clips': 'clips',
      'clip': 'clips',
      'controlnets': 'controlnets',
      'controlnet': 'controlnets',
      'ipadapters': 'ipadapters',
      'ipadapter': 'ipadapters',
      'upscalers': 'upscalers',
      'upscale': 'upscalers',
      'upscale_models': 'upscalers'
    };
    
    return mappings[name] || name
  };

  /**
   * 获取类别（优先使用缓存）
   */
  getCategory() {
    if (this._category) return this._category;
    
    // 优先使用 widgetName 推断
    if (this.widgetName) {
      const cat = this._getCategoryFromWidgetName(this.widgetName);
      if (cat) {
        this._category = cat;
        return cat
      }
    };

    // 使用路径解析
    const parsed = this._parseModelPath(this.path);
    this._category = parsed.category;
    this._relativePath = parsed.relativePath;
    
    return this._category
  };

  /**
   * 获取相对路径（含子文件夹）
   * 例如: "MLiang/MLiang 国游_MLiang 国游 V1.safetensors"
   */
  getRelativePath() {
    if (this._relativePath) return this._relativePath;
    
    const parsed = this._parseModelPath(this.path);
    this._relativePath = parsed.relativePath;
    this._category = parsed.category; // 顺便缓存类别
    
    return this._relativePath
  };

  /**
   * 获取存储路径（用于保存到数据库）
   * 格式: "子文件夹\\文件名.safetensors"（使用双反斜杠便于Windows路径兼容）
   */
  getStoragePath() {
    if (this._storagePath) return this._storagePath;
    
    const relativePath = this.getRelativePath();
    // 统一使用双反斜杠作为存储格式，兼容Windows
    this._storagePath = relativePath.replace(/\//g, '\\');
    
    return this._storagePath
  };

  /**
   * 获取用于显示的完整路径（Editor下拉框使用）
   * 包含子文件夹，但去掉 models/类别 前缀
   */
  getDisplayPath() {
    return this.getRelativePath()
  };

  /**
   * 获取用于Manager列表显示的短名称（无后缀）
   */
  getManagerDisplayName() {
    // 只返回文件名，不含路径和后缀
    const relativePath = this.getRelativePath();
    const fileName = relativePath.split(/[\/\\]/).pop();
    
    // 去掉扩展名
    const extensions = [
      '.safetensors', '.sft', '.pt', '.pth', '.ckpt', 
      '.bin', '.gguf', '.onnx', '.model'
    ];
    
    const lowerName = fileName.toLowerCase();
    for (const ext of extensions.sort((a, b) => b.length - a.length)) {
      if (lowerName.endsWith(ext)) {
        return fileName.slice(0, -ext.length)
      }
    };
    
    return fileName
  };

  _getCategoryFromWidgetName(widgetName) {
    if (!widgetName) return null;
    const wn = widgetName.toLowerCase();
    
    if (wn.includes("ckpt") || wn.includes("checkpoint")) return "checkpoints";
    if (wn.includes("lora") || wn.includes("lycoris")) return "loras";
    if (wn.includes("unet")) return "unets";
    if (wn.includes("vae")) return "vaes";
    if (wn.includes("clip")) return "clips";
    if (wn.includes("controlnet")) return "controlnets";
    if (wn.includes("ipadapter")) return "ipadapters";
    if (wn.includes("upscale")) return "upscalers";
    
    return null
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
    let category, modelPath, tags;

    if (categoryOrMetadata instanceof ModelMetadata) {
      const metadata = categoryOrMetadata;
      category = metadata.getCategory();
      modelPath = metadata.getStoragePath();
      tags = modelNameOrTags || ""
    } else {
      category = categoryOrMetadata;
      modelPath = modelNameOrTags;
      tags = tagsText || ""
    };

    if (!category) category = "unknown";
    if (!this._data[category]) {
      this._data[category] = {};
      this._nextIds[category] = 1
    };

    // 检查是否已存在
    const existing = this.findByModelName(modelPath);
    if (existing) {
      // 更新现有条目
      return this.update(existing.category, existing.id, modelPath, tags);
    }

    const id = String(this._nextIds[category]++);
    this._data[category][id] = {
      Model: modelPath,
      Tags: tags.trim()
    };

    this._notifyChange("add", { category, id, entry: this._data[category][id] });

    return {
      id,
      category,
      entry: this._data[category][id]
    }
  };

  findByModelName(modelName) {
    const searchName = this._normalizeModelName(modelName);
    const tempMeta = new ModelMetadata(modelName);
    const inferredCategory = tempMeta.getCategory();

    if (inferredCategory !== "unknown" && this._data[inferredCategory]) {
      for (const [id, entry] of Object.entries(this._data[inferredCategory])) {
        if (this._matchModelName(entry.Model, searchName)) {
          return { id, category: inferredCategory, entry }
        }
      }
    };

    for (const [category, entries] of Object.entries(this._data)) {
      for (const [id, entry] of Object.entries(entries)) {
        if (this._matchModelName(entry.Model, searchName)) {
          return { id, category, entry }
        }
      }
    };

    return null
  };

  _normalizeModelName(modelPath) {
    if (!modelPath) return "";

    const normalized = modelPath.replace(/\\/g, '/');

    const parts = normalized.split('/');
    if (parts.length > 1 && normalized.includes('/')) {
      return parts.slice(-2).join('/')
    };

    return parts.pop() || modelPath
  };

  _matchModelName(storedPath, searchPath) {
    if (!storedPath || !searchPath) return false;
    if (storedPath === searchPath) return true;

    const stored = storedPath.replace(/\\/g, '/').toLowerCase();
    const search = searchPath.replace(/\\/g, '/').toLowerCase();
    
    if (stored === search) return true;
    if (stored.endsWith('/' + search)) return true;
    if (search.endsWith('/' + stored)) return true;

    const storedFile = stored.split('/').pop();
    const searchFile = search.split('/').pop();
    if (storedFile === searchFile) return true;

    return false
  };

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