import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "A1rSpace.Utils.BooleanToInt",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "A1r Boolean to Int") return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        const originalOnPropertyChanged = nodeType.prototype.onPropertyChanged;
        const originalOnConfigure = nodeType.prototype.onConfigure;
        const originalOnDrawForeground = nodeType.prototype.onDrawForeground;

        // Layout constants (matching slider_custom.js)
        const fontsize = LiteGraph.NODE_SUBTEXT_SIZE;
        const shiftLeft = 10;
        const shiftRight = 120;

        nodeType.prototype.onNodeCreated = function () {
            originalOnNodeCreated?.apply(this, arguments);
            if (this._a1r_b2i_bound) return;

            const bind = () => {
                if (!Array.isArray(this.widgets)) {
                    requestAnimationFrame(bind);
                    return;
                }
                const wTrue = this.widgets.find((w) => w.name === "true_value");
                const wFalse = this.widgets.find((w) => w.name === "false_value");
                const wBool = this.widgets.find((w) => w.name === "input_bool");
                if (!(wTrue && wFalse && wBool)) return;

                this._a1r_b2i_bound = true;

                // 完全隐藏所有widgets
                const hideWidget = (w) => {
                    if (!w) return;
                    w.type = "converted-widget";
                    w.computeSize = () => [0, -4];
                    w.hidden = true;
                };
                hideWidget(wTrue);
                hideWidget(wFalse);
                hideWidget(wBool);

                // 初始化properties
                this.properties = this.properties || {};
                if (typeof this.properties.true_value !== "number") {
                    this.properties.true_value = Number(wTrue.value ?? 1) || 1;
                }
                if (typeof this.properties.false_value !== "number") {
                    this.properties.false_value = Number(wFalse.value ?? 0) || 0;
                }
                if (typeof this.properties.true_label !== "string") {
                    this.properties.true_label = "True";
                }
                if (typeof this.properties.false_label !== "string") {
                    this.properties.false_label = "False";
                }

                // 同步widgets和properties
                wTrue.value = this.properties.true_value;
                wFalse.value = this.properties.false_value;

                // 动画状态
                this._a1r_b2i_animPos = wBool.value ? 1 : 0; // 0=false, 1=true
                this._a1r_b2i_targetPos = this._a1r_b2i_animPos;

                // widgets回调
                const origTrueCb = wTrue.callback;
                const origFalseCb = wFalse.callback;
                const origBoolCb = wBool.callback;

                wTrue.callback = (v) => {
                    origTrueCb?.call(this, v, wTrue, this);
                    const nv = Number(wTrue.value);
                    if (!Number.isNaN(nv)) this.properties.true_value = nv;
                };
                wFalse.callback = (v) => {
                    origFalseCb?.call(this, v, wFalse, this);
                    const nv = Number(wFalse.value);
                    if (!Number.isNaN(nv)) this.properties.false_value = nv;
                };
                wBool.callback = (v) => {
                    origBoolCb?.call(this, v, wBool, this);
                    this._a1r_b2i_targetPos = wBool.value ? 1 : 0;
                    this.setDirtyCanvas?.(true, true);
                    this.graph?.setDirtyCanvas?.(true, true);
                };

                // remove input interfaces
                const removeInputsByNames = (names) => {
                    if (!Array.isArray(this.inputs)) return;
                    for (let i = this.inputs.length - 1; i >= 0; i--) {
                        const inp = this.inputs[i];
                        if (inp && names.includes(inp.name)) {
                            try { this.disconnectInput?.(i); } catch {}
                            try { this.removeInput?.(i); } catch {}
                        }
                    }
                };
                removeInputsByNames(["true_value", "false_value", "input_bool"]);

                // 隐藏widgets区域
                this.widgets_start_y = -2.4e8 * LiteGraph.NODE_SLOT_HEIGHT;
            };
            bind();
        };

        const originalOnAdded = nodeType.prototype.onAdded;
        nodeType.prototype.onAdded = function () {
            if (originalOnAdded) originalOnAdded.apply(this, arguments);
            
            // 隐藏输出名称
            this.outputs[0].name = this.outputs[0].localized_name = "";
        };

        // 绘制自定义开关UI
        nodeType.prototype.onDrawForeground = function (ctx) {
            if (originalOnDrawForeground) originalOnDrawForeground.apply(this, arguments);
            if (this.flags.collapsed) return;
            if (!this._a1r_b2i_bound) return;

            const wBool = this.widgets?.find((w) => w.name === "input_bool");
            if (!wBool) return;

            // 动画更新（平滑过渡）
            const diff = this._a1r_b2i_targetPos - this._a1r_b2i_animPos;
            if (Math.abs(diff) > 0.001) {
                this._a1r_b2i_animPos += diff * 0.25; // 平滑动画，稍慢以显示滑动效果
                this.setDirtyCanvas?.(true, true);
            } else {
                this._a1r_b2i_animPos = this._a1r_b2i_targetPos;
            }

            // 布局计算
            const shY = LiteGraph.NODE_SLOT_HEIGHT / 1.5;
            const trackWidth = this.size[0] - shiftRight - shiftLeft; // 随节点宽度缩放
            
            // 容器参数
            const containerHeight = 18;
            const containerX = shiftLeft;
            const containerY = shY - containerHeight / 2;
            const containerRadius = 4.5;

            // 绘制容器背景
            ctx.fillStyle = "#222222ff";
            ctx.beginPath();
            ctx.roundRect(containerX, containerY, trackWidth, containerHeight, containerRadius);
            ctx.fill();

            // 容器内阴影效果
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(containerX, containerY, trackWidth, containerHeight, containerRadius);
            ctx.clip();
            
            // 顶部阴影
            const topGradient = ctx.createLinearGradient(containerX, containerY, containerX, containerY + 3);
            topGradient.addColorStop(0, "rgba(0,0,0,0.45)");
            topGradient.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = topGradient;
            ctx.fillRect(containerX, containerY, trackWidth, 3);
            
            // 左侧阴影
            const leftGradient = ctx.createLinearGradient(containerX, containerY, containerX + 2, containerY);
            leftGradient.addColorStop(0, "rgba(0,0,0,0.3)");
            leftGradient.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = leftGradient;
            ctx.fillRect(containerX, containerY, 2, containerHeight);
            
            // 底部高光
            const bottomGradient = ctx.createLinearGradient(containerX, containerY + containerHeight - 1, containerX, containerY + containerHeight);
            bottomGradient.addColorStop(0, "rgba(255,255,255,0)");
            bottomGradient.addColorStop(1, "rgba(255,255,255,0.05)");
            ctx.fillStyle = bottomGradient;
            ctx.fillRect(containerX, containerY + containerHeight - 1, trackWidth, 1);
            
            ctx.restore();

            // 绘制滑动按钮
            const buttonWidth = 48; // 按钮宽度
            const buttonHeight = 16; // 按钮高度
            const buttonRadius = 4; // 圆角半径
            const buttonY = shY - buttonHeight / 2;
            const buttonPadding = 1; // 按钮与容器边缘的间距
            
            // 计算按钮X位置（带动画，两端留出padding）
            const buttonMinX = containerX + buttonPadding;
            const buttonMaxX = containerX + trackWidth - buttonWidth - buttonPadding;
            const buttonX = buttonMinX + (buttonMaxX - buttonMinX) * this._a1r_b2i_animPos;

            // 按钮投影
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.beginPath();
            ctx.roundRect(buttonX, buttonY + 1, buttonWidth, buttonHeight, buttonRadius);
            ctx.fill();

            // 按钮主体
            ctx.fillStyle = "#aaaaaaff";
            ctx.beginPath();
            ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, buttonRadius);
            ctx.fill();

            // 显示当前状态文本（在容器右端与输出点之间的中间位置）
            const currentValue = wBool.value;
            const label = currentValue 
                ? String(this.properties.true_label ?? "True")
                : String(this.properties.false_label ?? "False");
            
            // 计算文字区域：容器右端到节点右边缘（输出点左侧）
            const containerRightX = containerX + trackWidth;
            const textAreaLeft = containerRightX + 4; // 容器右端留6px间距
            const textAreaRight = this.size[0] - 12; // 输出点左侧留12px间距
            const textCenterX = (textAreaLeft + textAreaRight) / 2; // 中间位置
            const maxTextWidth = textAreaRight - textAreaLeft - 4; // 最大文字宽度
            
            ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR;
            ctx.font = fontsize + "px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            // 测量文字宽度，超长时截断
            const textMetrics = ctx.measureText(label);
            let displayText = label;
            if (textMetrics.width > maxTextWidth) {
                // 文字过长，逐字符截断直到加上省略号后能放下
                const ellipsis = "...";
                const ellipsisWidth = ctx.measureText(ellipsis).width;
                const availableWidth = maxTextWidth - ellipsisWidth;
                
                for (let i = label.length - 1; i > 0; i--) {
                    const truncated = label.substring(0, i);
                    if (ctx.measureText(truncated).width <= availableWidth) {
                        displayText = truncated + ellipsis;
                        break;
                    }
                }
            }
            
            ctx.fillText(displayText, textCenterX, shY);
        };

        // 鼠标事件处理
        nodeType.prototype.onMouseDown = function (e) {
            const shY = LiteGraph.NODE_SLOT_HEIGHT / 1.5;
            const trackWidth = this.size[0] - shiftRight - shiftLeft;
            const containerHeight = 6;
            const containerX = shiftLeft;
            const containerY = shY - containerHeight / 2;

            // 扩大点击区域（容器上下各扩展5px方便点击）
            const clickX = containerX;
            const clickY = containerY - 5;
            const clickWidth = trackWidth;
            const clickHeight = containerHeight + 10;

            // 检查点击是否在开关区域
            const localX = e.canvasX - this.pos[0];
            const localY = e.canvasY - this.pos[1];

            if (localX >= clickX && localX <= clickX + clickWidth &&
                localY >= clickY && localY <= clickY + clickHeight) {
                
                const wBool = this.widgets?.find((w) => w.name === "input_bool");
                if (wBool) {
                    wBool.value = !wBool.value;
                    wBool.callback?.(wBool.value);
                }
                return true;
            }
            return false;
        };

        // 配置加载
        nodeType.prototype.onConfigure = function () {
            const r = originalOnConfigure?.apply(this, arguments);
            if (Array.isArray(this.inputs)) {
                for (let i = this.inputs.length - 1; i >= 0; i--) {
                    const inp = this.inputs[i];
                    if (inp && ["true_value", "false_value", "input_bool"].includes(inp.name)) {
                        try { this.disconnectInput?.(i); } catch {}
                        try { this.removeInput?.(i); } catch {}
                    }
                }
            }
            
            // 恢复动画状态
            const wBool = this.widgets?.find((w) => w.name === "input_bool");
            if (wBool) {
                this._a1r_b2i_animPos = wBool.value ? 1 : 0;
                this._a1r_b2i_targetPos = this._a1r_b2i_animPos;
            }
            
            return r;
        };

        // 属性变化处理
        nodeType.prototype.onPropertyChanged = function (name, value) {
            const r = originalOnPropertyChanged?.apply(this, arguments);
            if (!Array.isArray(this.widgets)) return r;
            
            if (name === "true_value") {
                const w = this.widgets.find((w) => w.name === "true_value");
                const nv = Number(value);
                if (w && !Number.isNaN(nv)) w.value = nv;
            } else if (name === "false_value") {
                const w = this.widgets.find((w) => w.name === "false_value");
                const nv = Number(value);
                if (w && !Number.isNaN(nv)) w.value = nv;
            }
            
            this.setDirtyCanvas?.(true, true);
            this.graph?.setDirtyCanvas?.(true, true);
            return r;
        };

        // 尺寸计算
        nodeType.prototype.computeSize = function() {
            return [LiteGraph.NODE_WIDTH, Math.floor(LiteGraph.NODE_SLOT_HEIGHT * 1.5)];
        };
    },
});
