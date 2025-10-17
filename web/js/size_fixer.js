import { app } from "../../../scripts/app.js";

/*
 * Fix the size of nodes that have been resized incorrectly.
 */

function isA1rNode(nodeName) {
    return nodeName.startsWith("A1r");
}

const DEFAULT_SIZE = {
    // config nodes
    "A1r KSampler Config": [230, 330],
    "A1r KSampler Config Values": [230, 200],
    "A1r KSampler Config Values Lite": [230, 170],
    "A1r LoRA Config": [210, 230],
    "A1r ControlNet Config": [210, 280],

    // control nodes
    "A1r KSampler ControlPad Advanced": [220, 280],
    "A1r LoRA ControlPad": [220, 310],

    // text nodes
    "A1r Text Box": [400, 200],
    "A1r Merge Text": [220, 280],
    "A1r Translate ClipEncode Merge": [220, 470],

    // Utils nodes
    "A1r Slider Custom": [210, 30],
    "A1r Boolean to Int": [210, 30],
};

// 最小尺寸限制（节点不能缩小到这个尺寸以下）
const MIN_SIZE = {
    // Utils nodes
    "A1r Slider Custom": [210, 30],
    "A1r Boolean to Int": [210, 30],
};

window.A1rSpace_SizeFixer = {
    registerDefaultSize: function (nodeName, size) {
        if (!DEFAULT_SIZE[nodeName]) {
            DEFAULT_SIZE[nodeName] = size;
            console.log(`[A1rSpace] Registered default size for ${nodeName}: ${size}`);
        } else {
            console.log(`[A1rSpace] Ignored registering default size for ${nodeName}, already registered`);
        }
    },

    hasDefaultSize: function (nodeName) {
        return DEFAULT_SIZE.hasOwnProperty(nodeName);
    }
};

app.registerExtension({
    name: "A1rSpace.NodeSizeFixer",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!isA1rNode(nodeData.name)) {
            return;
        }

        // Save original methods
        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        const origOnConfigure = nodeType.prototype.onConfigure;
        const origOnResize = nodeType.prototype.onResize;
        const origOnSerialize = nodeType.prototype.onSerialize;

        // Size protection
        nodeType.prototype.onNodeCreated = function() {
            const result = origOnNodeCreated ? origOnNodeCreated.apply(this, arguments) : undefined;

            // console.log(`[A1rSpace] Size fixer applied to node type: ${nodeData.name}`);

            if (!this._a1r_size_data) {
                this._a1r_size_data = {};
            }

            this._a1r_size_data = {
                userModified: false,
                lastWidth: this.size ? this.size[0] : null,
                lastHeight: this.size ? this.size[1] : null,
            };

            if (!this._a1r_size_data.lastWidth || !this._a1r_size_data.lastHeight) {
                const defaultSize = DEFAULT_SIZE[nodeData.name];
                if (defaultSize) {
                    this.size = [...defaultSize];
                    this._a1r_size_data.lastWidth = defaultSize[0];
                    this._a1r_size_data.lastHeight = defaultSize[1];
                }
            }

            return result;
        };

        nodeType.prototype.onConfigure = function(info) {
            // Save current size
            const prevUserModified = this._a1r_size_data?.userModified;
            const prevSize = this.size ? [...this.size] : null;

            const result = origOnConfigure ? origOnConfigure.apply(this, arguments) : undefined;

            if (!this._a1r_size_data) {
                this._a1r_size_data = { userModified: false };
            }

            // 获取最小尺寸限制
            const minSize = MIN_SIZE[nodeData.name];
            const minWidth = minSize ? minSize[0] : 0;
            const minHeight = minSize ? minSize[1] : 0;

            if (info && info.size) {
                if (info._a1r_size_userModified) {
                    this._a1r_size_data.userModified = true;
                }
            
                this._a1r_size_data.lastWidth = Math.max(info.size[0], minWidth);
                this._a1r_size_data.lastHeight = Math.max(info.size[1], minHeight);

                this.size = [this._a1r_size_data.lastWidth, this._a1r_size_data.lastHeight];
            } else if (prevUserModified && prevSize) {
                this._a1r_size_data.userModified = true;

                this._a1r_size_data.lastWidth = Math.max(prevSize[0], minWidth);
                this._a1r_size_data.lastHeight = Math.max(prevSize[1], minHeight);

                this.size = [this._a1r_size_data.lastWidth, this._a1r_size_data.lastHeight];
            } else {
                const defaultSize = DEFAULT_SIZE[nodeData.name];
                if (defaultSize) {
                    this.size = [...defaultSize];

                    this._a1r_size_data.lastWidth = defaultSize[0];
                    this._a1r_size_data.lastHeight = defaultSize[1];
                }
            }

            return result;
        };

        nodeType.prototype.onResize = function(size) {
            const result = origOnResize ? origOnResize.apply(this, arguments) : undefined;

            if (!this._a1r_size_data) {
                this._a1r_size_data = {};
            }

            if (this.size) {
                // 获取最小尺寸限制
                const minSize = MIN_SIZE[nodeData.name];
                const minWidth = minSize ? minSize[0] : 0;
                const minHeight = minSize ? minSize[1] : 0;

                // 确保尺寸不低于最小尺寸
                this.size[0] = Math.max(this.size[0], minWidth);
                this.size[1] = Math.max(this.size[1], minHeight);

                this._a1r_size_data.userModified = true;
                this._a1r_size_data.lastWidth = this.size[0];
                this._a1r_size_data.lastHeight = this.size[1];
            }

            return result;
        };

        nodeType.prototype.onSerialize = function(info) {
            const result = origOnSerialize ? origOnSerialize.apply(this, arguments) : undefined;

            if (this._a1r_size_data) {
                if (this._a1r_size_data.lastWidth || this._a1r_size_data.lastHeight) {
                    info.size = [
                        this._a1r_size_data.lastWidth,
                        this._a1r_size_data.lastHeight
                    ];
                }

                if (this._a1r_size_data.userModified) {
                    info._a1r_size_userModified = true;
                }
            }

            return result;
        };
    },

    async afterGraphLoad() {
        setTimeout(() => {
            for (const node of app.graph.nodes) {
                if (isA1rNode(node.type)) {
                    if (!node._a1r_size_data) {
                        node._a1r_size_data = {};
                    }

                    if ((!node.size || node.size.length !== 2) && !node._a1r_size_data.userModified) {
                        const defaultSize = DEFAULT_SIZE[node.type];
                        if (defaultSize) {
                            node.size = [...defaultSize];
                        }
                    }

                    if (node._a1r_size_data.lastWidth && node._a1r_size_data.lastHeight) {
                        node.size = [
                            node._a1r_size_data.lastWidth,
                            node._a1r_size_data.lastHeight
                        ];
                    }

                    node.setDirtyCanvas(true, true);
                }
            }
        }, 100);
    }
});