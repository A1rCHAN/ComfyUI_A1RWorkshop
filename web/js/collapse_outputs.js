import { app } from "../../../scripts/app.js";

/* 
 * Add the "Folded Output" attribute to the nodes under A1rSpace:
 * - When folding: Only the first output is displayed, and the rest are hidden. 
 *   All output names are uniformly set to a single space (to avoid overlapping and placeholder exceptions);
 *   No additional shading is drawn.
 * - When expanding: Restore all outputs to their original names (corresponding one by one).
 * - When folding, the height of the nodes is allowed to be reduced
 *   (the height is decreased according to the number of hidden outputs without modifying the Outputs structure or connection slots).
 */

app.registerExtension({
    name: "A1rSpace.CollapseOutputs.All",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (!nodeData?.category || !String(nodeData.category).startsWith("A1rSpace")) return;

        const PROP = "collapse_outputs";

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        const origOnDrawForeground = nodeType.prototype.onDrawForeground;
        const origOnDrawBackground = nodeType.prototype.onDrawBackground;

        function isCollapsed(node) {
            const v = node?.properties?.[PROP];
            return v === true || v === 1 || v === "true";
        }

        function updateOutputsVisibility(node) {
            try {
                if (!node.outputs || node.outputs.length <= 1) return;
                const collapse = isCollapsed(node);
                
                // Save original labels
                if (!node._a1r_orig_output_labels) {
                    node._a1r_orig_output_labels = node.outputs.map(o => (o && typeof o.label === "string") ? o.label : "");
                }
                
                for (let i = 0; i < node.outputs.length; i++) {
                    const out = node.outputs[i];
                    if (!out) continue;

                    // Just set hidden, label
                    out.hidden = collapse ? (i > 0) : false;
                    
                    // Set label for display only
                    if (collapse) {
                        if (Object.prototype.hasOwnProperty.call(out, 'label')) {
                            out.label = " ";
                        }
                    } else if (node._a1r_orig_output_labels) {
                        if (Object.prototype.hasOwnProperty.call(out, 'label')) {
                            out.label = node._a1r_orig_output_labels[i] || "";
                        }
                    }
                }
            } catch (e) {
                console.warn("[A1rSpace] updateOutputsVisibility failed:", e);
            }
        }

        // Determine whether the node size is being manually adjusted ( LiteGraph canvas )
        function isManualResizing(node) {
            try { return !!(app && app.canvas && app.canvas.resizing_node === node); } catch { return false; }
        }

        // Get preferred width (prefer user-set width, fallback to current node width)
        function getPreferredWidth(node) {
            if (typeof node.__a1r_user_width === 'number' && node.__a1r_user_width > 0) return node.__a1r_user_width;
            if (Array.isArray(node.size) && typeof node.size[0] === 'number' && node.size[0] > 0) return node.size[0];
            return undefined;
        }

        nodeType.prototype.onNodeCreated = function () {
            if (origOnNodeCreated) origOnNodeCreated.apply(this, arguments);
            try {
                if (typeof this.addProperty === "function") {
                    if (!this.properties || !Object.prototype.hasOwnProperty.call(this.properties, PROP)) {
                        this.addProperty(PROP, false, "boolean");
                    }
                }
            } catch (e) {
                console.warn("[A1rSpace] addProperty not available:", e);
            }
            this.properties = this.properties || {};
            if (typeof this.properties[PROP] === "undefined") this.properties[PROP] = false;

            // Initialize configuration flag to prevent intercepting connections during node creation and configuration
            this.__a1r_configuring = true;

            // Record current width as default user width during initialization
            try {
                if (Array.isArray(this.size) && typeof this.size[0] === 'number' && this.size[0] > 0) {
                    this.__a1r_user_width = this.size[0];
                }
            } catch {}

            updateOutputsVisibility(this);
            this.setDirtyCanvas(true, true);
            
            // Delay clearing the configuration flag (when creating a new node)
            const self = this;
            setTimeout(() => { self.__a1r_configuring = false; }, 100);

            const origOnConfigure = this.onConfigure;
            this.onConfigure = function (info) {
                // Reset the configuration flag to prevent connection recovery from being intercepted during workflow loading
                this.__a1r_configuring = true;
                
                if (origOnConfigure) origOnConfigure.apply(this, arguments);
                this.properties = this.properties || {};
                if (typeof this.properties[PROP] === "undefined") this.properties[PROP] = false;
                
                // Use a longer latency (200ms) to ensure that all connections have been fully restored
                const self = this;
                setTimeout(() => {
                    try {
                        updateOutputsVisibility(self);
                        self.setDirtyCanvas(true, true);
                    } catch (e) {
                        console.warn("[A1rSpace] delayed updateOutputsVisibility failed:", e);
                    }
                }, 50);
                
                setTimeout(() => {
                    self.__a1r_configuring = false;
                }, 200);
            };

            // Update visibility and refresh the canvas when attributes change
            const origOnPropertyChanged = this.onPropertyChanged;
            this.onPropertyChanged = function (name, value) {
                // Record the width before the change to prevent upstream processes from altering it
                const widthBefore = Array.isArray(this.size) && typeof this.size[0] === 'number' ? this.size[0] : undefined;
                if (typeof widthBefore === 'number' && widthBefore > 0) {
                    this.__a1r_user_width = widthBefore;
                }
                const res = origOnPropertyChanged ? origOnPropertyChanged.apply(this, arguments) : undefined;
                if (name === PROP) {
                    updateOutputsVisibility(this);
                    // Forced refresh and size update (only adjust height, keep width unchanged)
                    try {
                        if (typeof this.computeSize === 'function') {
                            const s = this.computeSize(this.size);
                            if (Array.isArray(s) && typeof this.setSize === 'function') {
                                const wWanted = (typeof this.__a1r_user_width === 'number') ? this.__a1r_user_width : getPreferredWidth(this);
                                this.setSize([typeof wWanted === 'number' ? wWanted : (Array.isArray(this.size) ? this.size[0] : s[0]), s[1]]);
                                // Apply it asynchronously again to offset the subsequent overwriting of the external process
                                if (typeof requestAnimationFrame === 'function') {
                                    const self = this;
                                    requestAnimationFrame(() => {
                                        try {
                                            const w2 = (typeof self.__a1r_user_width === 'number') ? self.__a1r_user_width : getPreferredWidth(self);
                                            if (Array.isArray(self.size)) self.setSize([typeof w2 === 'number' ? w2 : self.size[0], self.size[1]]);
                                        } catch {}
                                    });
                                }
                            }
                        }
                    } catch {}
                    this.setDirtyCanvas(true, true);
                }
                return res;
            };

        };

        // Keep the original background drawing
        nodeType.prototype.onDrawBackground = function (ctx) {
            if (origOnDrawBackground) origOnDrawBackground.apply(this, arguments);
        };

        nodeType.prototype.onDrawForeground = function (ctx) {
            if (origOnDrawForeground) origOnDrawForeground.apply(this, arguments);
            // To prevent attribute updates from being reflected in the drawing phase in some cases, reassert the visibility rules every frame
            try { updateOutputsVisibility(this); } catch {}
            // When manually dragging to adjust size, record user width preference
            try {
                if (isManualResizing(this) && Array.isArray(this.size) && typeof this.size[0] === 'number' && this.size[0] > 0) {
                    this.__a1r_user_width = this.size[0];
                }
            } catch {}
        };

        // When folding, allow nodes to shrink: 
        // Temporarily forge only one output and hand it over to the original algorithm to calculate the precise height (then immediately resume) to avoid a blank bottom
        if (!nodeType.prototype._a1r_orig_computeSize && typeof nodeType.prototype.computeSize === 'function') {
            const origComputeSize = nodeType.prototype.computeSize;
            nodeType.prototype._a1r_orig_computeSize = origComputeSize; 
            nodeType.prototype.computeSize = function(out) { 
                // Always use the current width as the standard to avoid computeSize rewriting the width of this.size through the out reference 
                const curW = Array.isArray(this.size) && typeof this.size[0] === 'number' ? this.size[0] : undefined; 
                const curH = Array.isArray(this.size) && typeof this.size[1] === 'number' ? this.size[1] : undefined; 
                const outLocal = [curW ?? 0, curH ?? 0];

                if (isCollapsed(this) && Array.isArray(this.outputs) && this.outputs.length > 1) { 
                    const backup = this.outputs; 
                    try { 
                        this.outputs = [backup[0]]; 
                        const s = origComputeSize.call(this, outLocal); 
                        const w = (typeof curW === 'number') ? curW : (Array.isArray(s) ? s[0] : 0); 
                        const h = Math.max(40, Array.isArray(s) ? s[1] : (curH ?? 0)); 
                        return [w, h];
                    } finally { 
                        this.outputs = backup; 
                    } 
                } 

                const s = origComputeSize.call(this, outLocal); 
                const w = (typeof curW === 'number') ? curW : (Array.isArray(s) ? s[0] : 0); 
                const h = Array.isArray(s) ? s[1] : (curH ?? 0); 
                return [w, h]; // Non-folding also only uses the current width 
            }; 
        }

        // Right-click menu adds "Collapse outputs" switch (prototype level, correct signature: canvas, options)
        if (!nodeType.prototype._a1r_orig_getExtraMenuOptions) {
            const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype._a1r_orig_getExtraMenuOptions = origGetExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(canvas, options) {
                if (origGetExtraMenuOptions) origGetExtraMenuOptions.apply(this, arguments);
                options = options || [];
                
                const node = this; // Capture node instance
                const collapsed = isCollapsed(node);
                
                options.push({
                    content: (collapsed ? "✔ " : "") + "Collapse outputs",
                    callback: () => {
                        try {
                            // Record the current width once before switching
                            const widthBefore = Array.isArray(node.size) && typeof node.size[0] === 'number' ? node.size[0] : undefined;
                            if (typeof widthBefore === 'number' && widthBefore > 0) node.__a1r_user_width = widthBefore;
                            node.properties[PROP] = !collapsed;
                            updateOutputsVisibility(node);
                            if (typeof node.computeSize === 'function' && typeof node.setSize === 'function') {
                                const s = node.computeSize(node.size);
                                if (Array.isArray(s)) {
                                    const wWanted = (typeof node.__a1r_user_width === 'number') ? node.__a1r_user_width : getPreferredWidth(node);
                                    node.setSize([typeof wWanted === 'number' ? wWanted : (Array.isArray(node.size) ? node.size[0] : s[0]), s[1]]);
                                    if (typeof requestAnimationFrame === 'function') {
                                        requestAnimationFrame(() => {
                                            try {
                                                const w2 = (typeof node.__a1r_user_width === 'number') ? node.__a1r_user_width : getPreferredWidth(node);
                                                if (Array.isArray(node.size)) node.setSize([typeof w2 === 'number' ? w2 : node.size[0], node.size[1]]);
                                            } catch {}
                                        });
                                    }
                                }
                            }
                            node.setDirtyCanvas(true, true);
                            app.graph.setDirtyCanvas(true, true); // Force refresh the entire graph to ensure connection lines are redrawn
                        } catch (e) {
                            console.warn('[A1rSpace] context toggle failed:', e);
                        }
                    }
                });
            };
        }

        // Wrap setSize to record user preferred width when manually adjusting (without changing original behavior)
        if (!nodeType.prototype._a1r_orig_setSize && typeof nodeType.prototype.setSize === 'function') {
            const origSetSize = nodeType.prototype.setSize;
            nodeType.prototype._a1r_orig_setSize = origSetSize;
            nodeType.prototype.setSize = function(size) {
                // Compatible with passing [w,h] or (w,h)
                let w = undefined, h = undefined;
                if (Array.isArray(size)) { w = size[0]; h = size[1]; }
                else if (arguments.length >= 2) { w = arguments[0]; h = arguments[1]; }

                const ret = origSetSize.apply(this, arguments);
                try {
                    if (isManualResizing(this) && typeof w === 'number' && w > 0) {
                        this.__a1r_user_width = w;
                    }
                } catch {}
                return ret;
            };
        }

        // When folding, only the position of the "draw endpoint" is redirected:
        // By overriding getConnectionPos (only mapping coordinates to slot 0 when is_input=false and slot>0),
        // a pure visual effect of "multiple lines starting from one point" is achieved; it does not modify getOutputPos or any outputs/link structure,
        // so that after uncollapsing, the connection positions will naturally restore.
        if (!nodeType.prototype._a1r_orig_getConnectionPos && typeof nodeType.prototype.getConnectionPos === 'function') {
            const origGetConnectionPos = nodeType.prototype.getConnectionPos;
            nodeType.prototype._a1r_orig_getConnectionPos = origGetConnectionPos;
            nodeType.prototype.getConnectionPos = function(is_input, slot) {
                try {
                    if (!is_input && isCollapsed(this) && this.outputs && this.outputs.length > 1 && slot > 0) {
                        // 仅在折叠时重定向额外输出的绘制坐标到 slot 0
                        return origGetConnectionPos.call(this, false, 0);
                    }
                } catch {}
                return origGetConnectionPos.apply(this, arguments);
            };
        }
        if (!nodeType.prototype._a1r_orig_getOutputPos && typeof nodeType.prototype.getOutputPos === 'function') {
            const origGetOutputPos = nodeType.prototype.getOutputPos;
            nodeType.prototype._a1r_orig_getOutputPos = origGetOutputPos;
            nodeType.prototype.getOutputPos = function(slot) {
                try {
                    if (isCollapsed(this) && this.outputs && this.outputs.length > 1 && slot > 0) {
                        return origGetOutputPos.call(this, 0);
                    }
                } catch {}
                return origGetOutputPos.apply(this, arguments);
            };
        }

        // Note: Removed the logic to prevent new connections in collapsed state
        // Reason: This logic interferes with connection recovery when loading workflows
        // Users can still create connections in collapsed state, but visually all connections originate from the first output point
        // This is a purely visual effect and does not affect the actual connection logic
    }
});