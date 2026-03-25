import { app } from "/scripts/app.js";
import { ModelMetadata, getModelFromNode, getTagsDB, isModelLoaderNode } from "../data/config_model.js";
const TAG_SEPARATOR = ", ";
const PENDING_TAGS_KEY = "_pendingEmbeddingTags";
export function setupTagInjector() {
    const extendedApp = app;
    const originalQueuePrompt = extendedApp.queuePrompt;
    const originalGraphToPrompt = extendedApp.graphToPrompt;
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
    extendedApp.graphToPrompt = async function () {
        const result = await originalGraphToPrompt.call(this);
        const pending = extendedApp[PENDING_TAGS_KEY];
        if (pending?.length && result) {
            injectTagsIntoPrompt(result, pending);
            delete extendedApp[PENDING_TAGS_KEY];
        }
        return result;
    };
}
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
        if (node.class_type === "CLIPTextEncode") {
            connectedNodes.push(currentId);
            continue;
        }
        for (const [otherId, otherNode] of Object.entries(outputNodes)) {
            if (visited.has(otherId))
                continue;
            const inputs = otherNode.inputs || {};
            for (const inputValue of Object.values(inputs)) {
                if (Array.isArray(inputValue) && String(inputValue[0]) === currentId) {
                    queue.push(otherId);
                    break;
                }
            }
        }
    }
    return connectedNodes;
}
