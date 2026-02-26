import { app } from "/scripts/app.js";
import { ModelMetadata, getTagsDB, isModelLoaderNode, getModelFromNode } from "./config.js";

// 注入 tags 与已有正向提示词之间的分隔符
const TAG_SEPARATOR = ", ";

// ========== 队列拦截 ==========

/**
 * 拦截 app.queuePrompt 和 app.graphToPrompt，
 * 在提交队列时将匹配模型的 tags 前置注入到关联的 CLIPTextEncode 节点
 */
export function setupTagInjector() {
  const originalQueuePrompt = app.queuePrompt;

  app.queuePrompt = async function(number, batchCount) {
    const db = getTagsDB();
    if (db) {
      const embeddingTags = collectEmbeddingTags(db);
      if (embeddingTags.length > 0) {
        app._pendingEmbeddingTags = embeddingTags;
        console.log(
          "[A1R EmbeddingTags] Collected for queue:",
          embeddingTags.map(t =>
            `${new ModelMetadata(t.model).getDisplayName()}: "${t.text.substring(0, 50)}${t.text.length > 50 ? "..." : ""}"`
          )
        )
      }
    }

    return originalQueuePrompt.call(this, number, batchCount)
  };

  const originalGraphToPrompt = app.graphToPrompt;
  app.graphToPrompt = async function() {
    const result = await originalGraphToPrompt.call(this);

    if (app._pendingEmbeddingTags?.length > 0) {
      injectTagsIntoPrompt(result, app._pendingEmbeddingTags);
      delete app._pendingEmbeddingTags
    }

    return result
  }
}

// ========== 标签收集 ==========

function collectEmbeddingTags(db) {
  const tags = [];
  if (!app.graph?._nodes) return tags;

  for (const node of app.graph._nodes) {
    if (!isModelLoaderNode(node)) continue;

    const currentModel = getModelFromNode(node);
    if (!currentModel) continue;

    const entry = db.findByModelName(currentModel);
    if (entry && entry.entry?.Tags?.trim()) {
      tags.push({
        nodeId: node.id,
        nodeType: node.comfyClass || node.type,
        model: currentModel,
        text: entry.entry.Tags.trim(),
        entryId: entry.id,
        category: entry.category
      })
    }
  }

  return tags
}

// ========== 注入逻辑 ==========

/**
 * 将 embeddingTags 中的 tags 文本前置注入每个关联 CLIPTextEncode 节点的 text 输入
 * 分隔符由 TAG_SEPARATOR 控制；若文本已以该 tags 开头则跳过（幂等）
 */
function injectTagsIntoPrompt(promptData, embeddingTags) {
  if (!promptData?.output) return;

  for (const tagData of embeddingTags) {
    const connectedNodes = findConnectedTextEncodeNodes(promptData, tagData.nodeId);

    for (const textEncodeId of connectedNodes) {
      const node = promptData.output[textEncodeId];
      if (!node || node.class_type !== "CLIPTextEncode") continue;

      const currentText = (node.inputs?.text || "").trim();

      // 幂等检查：避免重复注入
      if (currentText.startsWith(tagData.text)) continue;

      node.inputs.text = tagData.text + (currentText ? TAG_SEPARATOR + currentText : "");

      console.log(
        `[A1R EmbeddingTags] Injected into CLIPTextEncode#${textEncodeId}:`,
        `"${tagData.text.substring(0, 40)}..." prepended`
      )
    }
  }
}

/**
 * BFS 从 modelNodeId 出发，沿图连接遍历，收集所有下游 CLIPTextEncode 节点 ID
 */
function findConnectedTextEncodeNodes(promptData, modelNodeId) {
  const connectedNodes = [];
  const visited = new Set();
  const queue = [String(modelNodeId)];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = promptData.output[currentId];
    if (!node) continue;

    if (node.class_type === "CLIPTextEncode") {
      connectedNodes.push(currentId);
      continue
    }

    // 找所有以 currentId 为输入源的下游节点
    for (const [otherId, otherNode] of Object.entries(promptData.output)) {
      if (visited.has(otherId)) continue;
      for (const inputValue of Object.values(otherNode.inputs || {})) {
        if (Array.isArray(inputValue) && String(inputValue[0]) === currentId) {
          queue.push(otherId);
          break
        }
      }
    }
  }

  return connectedNodes
}