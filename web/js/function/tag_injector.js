// @ts-expect-error ComfyUI 运行时注入模块
import { app } from "/scripts/app.js";
import { ModelMetadata, getModelFromNode, getTagsDB, isModelLoaderNode } from "../data/config_model.js";
// 常量
const TAG_SEPARATOR = ", ";
const PENDING_TAGS_KEY = "_pendingEmbeddingTags";
/**
 * 设置标签注入器钩子到 ComfyUI 的主函数
 */
export function setupTagInjector() {
    const extendedApp = app;
    const originalQueuePrompt = extendedApp.queuePrompt;
    const originalGraphToPrompt = extendedApp.graphToPrompt;
    // 挂钩到 queuePrompt 以在处理前收集标签
    extendedApp.queuePrompt = async function (number, batchCount) {
        const db = getTagsDB();
        if (db) {
            const embeddingTags = collectEmbeddingTags();
            if (embeddingTags.length > 0) {
                extendedApp[PENDING_TAGS_KEY] = embeddingTags;
                console.log("[A1R EmbeddingTags] Collected for queue:", embeddingTags.map((tag) => `${new ModelMetadata(tag.model).getDisplayName()}: "${tag.text.substring(0, 50)}${tag.text.length > 50 ? "..." : ""}"`));
            }
        }
        return originalQueuePrompt.call(this, number, batchCount);
    };
    // 挂钩到 graphToPrompt 以将标签注入到最终的提示词输出中
    extendedApp.graphToPrompt = async function () {
        // 还原逻辑：完全移除之前的 app.graph.serialize() 和 links_dirty 操作。
        // 这不会影响 LiteGraph 的内部状态，是最安全的方式。
        const result = await originalGraphToPrompt.call(this);
        const pending = extendedApp[PENDING_TAGS_KEY];
        if (pending?.length && result) {
            injectTagsIntoPrompt(result, pending);
            delete extendedApp[PENDING_TAGS_KEY];
        }
        return result;
    };
}
/**
 * 扫描当前图中的模型加载节点并收集关联的标签。
 */
function collectEmbeddingTags() {
    const tags = [];
    const db = getTagsDB();
    if (!app.graph?._nodes || !db)
        return tags;
    for (const node of app.graph._nodes) {
        if (!isModelLoaderNode(node))
            continue;
        const currentModel = getModelFromNode(node);
        if (!currentModel)
            continue;
        const entry = db.findByModelName(currentModel);
        if (entry) {
            const positiveText = entry.entry?.Tags?.positive || "";
            const negativeText = entry.entry?.Tags?.negative || "";
            if (positiveText || negativeText) {
                tags.push({
                    nodeId: String(node.id ?? ""),
                    nodeType: node.comfyClass || node.type || "Unknown",
                    model: currentModel,
                    text: positiveText.trim(),
                    negativeText: negativeText.trim(),
                    entryId: entry.id,
                    category: entry.category,
                });
            }
        }
    }
    return tags;
}
/**
 * 将收集到的标签注入到提示词数据中已连接的 CLIPTextEncode 节点。
 */
function injectTagsIntoPrompt(promptData, embeddingTags) {
    if (!promptData?.output)
        return;
    const nodeRoles = detectClipTextEncodeRoles(promptData);
    for (const tagData of embeddingTags) {
        const connectedNodes = findConnectedTextEncodeNodes(promptData, String(tagData.nodeId));
        for (const textEncodeId of connectedNodes) {
            const node = promptData.output[textEncodeId];
            if (!node || node.class_type !== "CLIPTextEncode")
                continue;
            const role = nodeRoles.get(textEncodeId);
            let tagToInject = "";
            if (role === "negative") {
                tagToInject = tagData.negativeText;
            }
            else {
                tagToInject = tagData.text;
            }
            if (!tagToInject)
                continue;
            const currentText = String(node.inputs?.text || "").trim();
            if (currentText.startsWith(tagToInject))
                continue;
            if (!node.inputs)
                node.inputs = {};
            node.inputs.text = tagToInject + (currentText ? TAG_SEPARATOR + currentText : "");
            console.log(`[A1R EmbeddingTags] Injected (${role || "default"}) into CLIPTextEncode#${textEncodeId}:`, `"${tagToInject.substring(0, 40)}..." prepended`);
        }
    }
}
function detectClipTextEncodeRoles(promptData) {
    const roles = new Map();
    const outputNodes = promptData.output || {};
    for (const [nodeId, node] of Object.entries(outputNodes)) {
        const inputs = node.inputs || {};
        if (inputs.positive && Array.isArray(inputs.positive)) {
            traceUpstreamRole(promptData, String(inputs.positive[0]), "positive", roles);
        }
        if (inputs.negative && Array.isArray(inputs.negative)) {
            traceUpstreamRole(promptData, String(inputs.negative[0]), "negative", roles);
        }
    }
    return roles;
}
function traceUpstreamRole(promptData, startNodeId, role, roles, visited = new Set()) {
    if (visited.has(startNodeId))
        return;
    visited.add(startNodeId);
    const node = promptData.output?.[startNodeId];
    if (!node)
        return;
    if (node.class_type === "CLIPTextEncode") {
        roles.set(startNodeId, role);
        return;
    }
    const inputs = node.inputs || {};
    const potentialInputs = ["conditioning", "condition", "clip", "samples"];
    for (const [key, value] of Object.entries(inputs)) {
        if (key.includes("conditioning") || potentialInputs.includes(key)) {
            if (Array.isArray(value)) {
                traceUpstreamRole(promptData, String(value[0]), role, roles, visited);
            }
        }
    }
}
/**
 * 遍历图输出（工作流结构）以查找连接到源节点的 CLIPTextEncode 节点。
 */
function findConnectedTextEncodeNodes(promptData, modelNodeId) {
    const connectedNodes = [];
    const visited = new Set();
    const queue = [String(modelNodeId)];
    const outputNodes = promptData.output || {};
    while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId || visited.has(currentId))
            continue;
        visited.add(currentId);
        const node = outputNodes[currentId];
        if (!node)
            continue;
        // 如果找到 CLIPTextEncode 节点，加入结果并停止遍历此分支
        // (通常我们不想遍历 *穿过* 文本编码器)
        if (node.class_type === "CLIPTextEncode") {
            connectedNodes.push(currentId);
            continue;
        }
        // 查找将 'currentId' 作为输入的节点
        for (const [otherId, otherNode] of Object.entries(outputNodes)) {
            if (visited.has(otherId))
                continue;
            const inputs = otherNode.inputs || {};
            for (const inputValue of Object.values(inputs)) {
                // ComfyUI 提示词结构链接是数组: ["sourceNodeId", outputIndex]
                if (Array.isArray(inputValue) && String(inputValue[0]) === currentId) {
                    queue.push(otherId);
                    break; // 找到到此节点的链接，加入队列
                }
            }
        }
    }
    return connectedNodes;
}
