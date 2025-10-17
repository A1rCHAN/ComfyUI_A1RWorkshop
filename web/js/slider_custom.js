import { app } from "../../../scripts/app.js";

app.registerExtension({
    name: "A1rSpace.SliderCustom",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "A1r Slider Custom") return;

        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        const originalOnPropertyChanged = nodeType.prototype.onPropertyChanged;
        const originalOnConfigure = nodeType.prototype.onConfigure;
        const originalOnDrawForeground = nodeType.prototype.onDrawForeground;

        // 布局常量
        const fontsize = LiteGraph.NODE_SUBTEXT_SIZE;
        const shiftLeft = 10;
        const shiftRight = 60;

        nodeType.prototype.onNodeCreated = function() {
            originalOnNodeCreated?.apply(this, arguments);
            if (this._a1r_sc_bound) return;

            const bind = () => {
                if (!Array.isArray(this.widgets)) {
                    requestAnimationFrame(bind);
                    return;
                }
                const wInt = this.widgets.find((w) => w.name === "int_value");
                const wFloat = this.widgets.find((w) => w.name === "float_value");
                const wSwitch = this.widgets.find((w) => w.name === "switch_type");
                if (!(wInt && wFloat && wSwitch)) return;

                this._a1r_sc_bound = true;

                // 隐藏所有原始控件
                const hideWidget = (w) => {
                    if (!w) return;
                    w.type = "converted-widget";
                    w.computeSize = () => [0, -4];
                    w.hidden = true;
                };
                hideWidget(wInt);
                hideWidget(wFloat);
                hideWidget(wSwitch);

                // 初始化属性
                this.properties = this.properties || {};
                this.properties.value = 20;
                this.properties.min = 0;
                this.properties.max = 100;
                this.properties.step = 1;
                this.properties.decimals = 0;
                this.properties.snap = true;

                // 初始化滑块位置
                this.intpos = { x: 0.2 };

                // 保存原始widget值变更回调
                const origIntCallback = wInt.callback;
                const origFloatCallback = wFloat.callback;
                const origSwitchCallback = wSwitch.callback;

                // 覆盖回调以同步属性
                wInt.callback = (v) => {
                    origIntCallback?.call(this, v, wInt, this);
                    if (this.properties.decimals === 0) {
                        this.properties.value = Number(wInt.value);
                        this.intpos.x = Math.max(0, Math.min(1,
                            (this.properties.value-this.properties.min)/
                            (this.properties.max-this.properties.min)));
                        this.setDirtyCanvas?.(true, true);
                    }
                };

                wFloat.callback = (v) => {
                    origFloatCallback?.call(this, v, wFloat, this);
                    if (this.properties.decimals > 0) {
                        this.properties.value = Number(wFloat.value);
                        this.intpos.x = Math.max(0, Math.min(1,
                            (this.properties.value-this.properties.min)/
                            (this.properties.max-this.properties.min)));
                        this.setDirtyCanvas?.(true, true);
                    }
                };

                wSwitch.callback = (v) => {
                    origSwitchCallback?.call(this, v, wSwitch, this);
                    this.properties.decimals = v > 0 ? 2 : 0;
                    this.onPropertyChanged("decimals");
                    this.setDirtyCanvas?.(true, true);
                };
            };
            bind();
        };

        // 节点添加到图表时的处理
        const originalOnAdded = nodeType.prototype.onAdded;
        nodeType.prototype.onAdded = function() {
            const r = originalOnAdded?.apply(this, arguments);
            
            // 隐藏输出名称
            if (this.outputs && this.outputs[0]) {
                this.outputs[0].name = this.outputs[0].localized_name = "";
            }
            
            // 隐藏widgets区域
            this.widgets_start_y = -2.4e8 * LiteGraph.NODE_SLOT_HEIGHT;
            
            // 计算滑块位置
            this.intpos = this.intpos || { x: 0.2 };
            this.intpos.x = Math.max(0, Math.min(1,
                (this.properties.value-this.properties.min)/
                (this.properties.max-this.properties.min)));
                
            // 更新输出类型
            this.outputs[0].type = (this.properties.decimals > 0) ? "FLOAT" : "INT";
            
            return r;
        };

        // 配置恢复
        nodeType.prototype.onConfigure = function(info) {
            const r = originalOnConfigure?.apply(this, arguments);
            
            // 确保 intpos 存在
            this.intpos = this.intpos || { x: 0.2 };
            
            // 计算滑块位置
            this.intpos.x = Math.max(0, Math.min(1,
                (this.properties.value-this.properties.min)/
                (this.properties.max-this.properties.min)));
                
            // 更新输出类型
            this.outputs[0].type = (this.properties.decimals > 0) ? "FLOAT" : "INT";
            
            // 标记为已配置
            this.configured = true;
            
            return r;
        };
        
        // 图表配置完成后的处理
        nodeType.prototype.onGraphConfigured = function() {
            // 标记为已配置
            this.configured = true;
            // 触发属性变更
            this.onPropertyChanged();
        };

        // 属性变更处理
        nodeType.prototype.onPropertyChanged = function(propName) {
            if (!this.configured) return;
            
            // 验证和修正属性值
            // step必须大于0
            if (this.properties.step <= 0) this.properties.step = 1;
            
            // value必须在min和max之间
            if (isNaN(this.properties.value)) this.properties.value = this.properties.min;
            
            // max必须大于min
            if (this.properties.min >= this.properties.max) this.properties.max = this.properties.min + this.properties.step;
            
            // 当min/max变更时调整value
            if ((propName === "min") && (this.properties.value < this.properties.min)) this.properties.value = this.properties.min;
            if ((propName === "max") && (this.properties.value > this.properties.max)) this.properties.value = this.properties.max;
            
            // decimals必须在0到4之间
            this.properties.decimals = Math.floor(this.properties.decimals);
            if (this.properties.decimals > 4) this.properties.decimals = 4;
            if (this.properties.decimals < 0) this.properties.decimals = 0;
            
            // 按小数位四舍五入value
            this.properties.value = Math.round(Math.pow(10, this.properties.decimals) * this.properties.value) / Math.pow(10, this.properties.decimals);
            
            // 更新滑块位置(0-1)
            this.intpos.x = Math.max(0, Math.min(1,
                (this.properties.value - this.properties.min) / (this.properties.max - this.properties.min)));
                
            // 当小数位变更时切断不兼容的连接
            if ((this.properties.decimals > 0 && this.outputs[0].type !== "FLOAT") || 
                (this.properties.decimals === 0 && this.outputs[0].type !== "INT")) {
                if (this.outputs[0].links !== null) {
                    for (let i = this.outputs[0].links.length; i > 0; i--) {
                        const tlinkId = this.outputs[0].links[i-1];
                        const tlink = app.graph.links[tlinkId];
                        if (tlink) {
                            app.graph.getNodeById(tlink.target_id).disconnectInput(tlink.target_slot);
                        }
                    }
                }
            }
            
            // 更新输出类型和widget值
            this.outputs[0].type = (this.properties.decimals > 0) ? "FLOAT" : "INT";
            
            // 更新类型切换widget
            this.widgets[2].value = (this.properties.decimals > 0) ? 1 : 0;
            
            // 更新value widget
            this.widgets[1].value = this.properties.value;
            
            // 更新int value widget
            this.widgets[0].value = Math.floor(this.properties.value);
        };

        // 前景绘制
        nodeType.prototype.onDrawForeground = function(ctx) {
            if (originalOnDrawForeground) originalOnDrawForeground.apply(this, arguments);
            
            // 折叠时不绘制
            if (this.flags.collapsed) return;
            if (!this._a1r_sc_bound) return;
            
            // 获取小数位
            const dgt = parseInt(this.properties.decimals);
            
            // 布局计算
            const shY = LiteGraph.NODE_SLOT_HEIGHT / 1.5;
            const trackWidth = this.size[0] - shiftRight - shiftLeft;
            
            // 绘制滑轨
            const trackHeight = 6;
            const trackRadius = 3;
            const trackX = shiftLeft;
            const trackY = shY - trackHeight/2;
            
            // 滑轨背景 (#222222ff)
            ctx.fillStyle = "#222222ff";
            ctx.beginPath();
            ctx.roundRect(trackX, trackY, trackWidth, trackHeight, trackRadius);
            ctx.fill();
            
            // 保存上下文用于裁剪
            ctx.save();
            
            // 创建裁剪路径（确保阴影在滑轨内）
            ctx.beginPath();
            ctx.roundRect(trackX, trackY, trackWidth, trackHeight, trackRadius);
            ctx.clip();
            
            // 顶部内阴影效果（渐变）
            const topGradient = ctx.createLinearGradient(trackX, trackY, trackX, trackY + 3);
            topGradient.addColorStop(0, "rgba(0,0,0,0.45)");
            topGradient.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = topGradient;
            ctx.fillRect(trackX, trackY, trackWidth, 3);
            
            // 左侧内阴影效果（渐变）
            const leftGradient = ctx.createLinearGradient(trackX, trackY, trackX + 2, trackY);
            leftGradient.addColorStop(0, "rgba(0,0,0,0.3)");
            leftGradient.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = leftGradient;
            ctx.fillRect(trackX, trackY, 2, trackHeight);
            
            // 底部内高光效果（渐变）
            const bottomGradient = ctx.createLinearGradient(trackX, trackY + trackHeight - 1, trackX, trackY + trackHeight);
            bottomGradient.addColorStop(0, "rgba(255,255,255,0)");
            bottomGradient.addColorStop(1, "rgba(255,255,255,0.05)");
            ctx.fillStyle = bottomGradient;
            ctx.fillRect(trackX, trackY + trackHeight - 1, trackWidth, 1);
            
            // 恢复上下文（移除裁剪）
            ctx.restore();
            
            // 创建刻度标记（9个分隔，在滑轨内部）
            for (let i = 1; i <= 9; i++) {
                const position = i * 10; // 10%, 20%, ..., 90%
                const isMajor = i === 5; // 50%处为主要刻度
                const tickX = shiftLeft + (trackWidth * position / 100);
                const tickHeight = isMajor ? 4 : 3;
                
                ctx.fillStyle = isMajor ? "rgba(102,102,102,0.5)" : "rgba(85,85,85,0.35)";
                ctx.beginPath();
                ctx.fillRect(tickX - 0.5, shY - tickHeight/2, 1, tickHeight);
                ctx.fill();
            }
            
            // 绘制滑块把手
            const thumbX = shiftLeft + trackWidth * this.intpos.x;
            const thumbY = shY;
            const thumbRadius = 8; // 16px直径
            
            // 滑块阴影
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.beginPath();
            ctx.arc(thumbX, thumbY + 1, thumbRadius, 0, 2 * Math.PI, false);
            ctx.fill();
            
            // 主滑块
            ctx.fillStyle = "#aaaaaaff";
            ctx.beginPath();
            ctx.arc(thumbX, thumbY, thumbRadius, 0, 2 * Math.PI, false);
            ctx.fill();
            
            // 显示当前值
            ctx.fillStyle = LiteGraph.NODE_TEXT_COLOR;
            ctx.font = fontsize + "px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            // 在右侧显示值
            const valueX = this.size[0] - shiftRight + 24;
            const valueY = shY;
            const displayText = this.properties.value.toFixed(dgt);
            
            // 计算文本宽度，超长时截断
            const textMetrics = ctx.measureText(displayText);
            let finalText = displayText;
            const maxWidth = shiftRight - 4;
            
            if (textMetrics.width > maxWidth) {
                // 逐个字符截断，直到加上省略号后能放下
                const ellipsis = "...";
                const ellipsisWidth = ctx.measureText(ellipsis).width;
                const availableWidth = maxWidth - ellipsisWidth;
                
                for (let i = displayText.length - 1; i > 0; i--) {
                    const truncated = displayText.substring(0, i);
                    if (ctx.measureText(truncated).width <= availableWidth) {
                        finalText = truncated + ellipsis;
                        break;
                    }
                }
            }
            
            // 显示值
            ctx.fillText(finalText, valueX, valueY);
        };
        
        // 鼠标事件处理
        nodeType.prototype.onMouseDown = function(e) {
            // 检查鼠标是否在滑块区域内
            const shY = LiteGraph.NODE_SLOT_HEIGHT / 1.5;
            
            // 节点上方区域
            if (e.canvasY - this.pos[1] < 0) return false;
            
            // 滑块框架左右区域
            if (e.canvasX < this.pos[0] + shiftLeft - 5 || 
                e.canvasX > this.pos[0] + this.size[0] - shiftRight + 5) return false;
                
            // 滑块框架上下区域
            if (e.canvasY < this.pos[1] + shiftLeft - 5 || 
                e.canvasY > this.pos[1] + this.size[1] - shiftLeft + 5) return false;
                
            // 开始捕获鼠标输入
            this.capture = true;
            // 重置位置解锁标记
            this.unlock = false;
            // 立即更新值
            this.valueUpdate(e);
            return true;
        };
        
        // 鼠标移动事件
        nodeType.prototype.onMouseMove = function(e, pos, canvas) {
            // 未在捕获状态时返回
            if (!this.capture) return;
            
            // 鼠标释放时停止捕获
            if (canvas.pointer.isDown === false) {
                this.onMouseUp(e);
                return;
            }
            
            // 更新滑块值
            this.valueUpdate(e);
        };
        
        // 鼠标释放事件
        nodeType.prototype.onMouseUp = function(e) {
            // 未在捕获状态时返回
            if (!this.capture) return;
            
            this.capture = false;
            
            // 更新widgets以同步值
            this.widgets[0].value = Math.floor(this.properties.value);
            this.widgets[1].value = this.properties.value;
        };
        
        // 计算核心：更新滑块值
        nodeType.prototype.valueUpdate = function(e) {
            // 保存旧值用于后续比较
            let prevX = this.properties.value;
            
            // 计算精度系数
            let rn = Math.pow(10, this.properties.decimals);
            
            // 根据鼠标位置计算新值
            let vX = (e.canvasX - this.pos[0] - shiftLeft) / (this.size[0] - shiftRight - shiftLeft);
            
            // 键盘修饰键：Ctrl = 解锁位置，Shift = 吸附到步进值
            if (e.ctrlKey) this.unlock = true;
            if (e.shiftKey !== this.properties.snap) {
                // 吸附到步进网格
                let step = this.properties.step / (this.properties.max - this.properties.min);
                vX = Math.round(vX / step) * step;
            }
            
            // 更新滑块位置(0-1)和值
            this.intpos.x = Math.max(0, Math.min(1, vX));
            
            // 计算实际值：min + 范围 * 位置
            this.properties.value = Math.round(rn * (this.properties.min +
                (this.properties.max - this.properties.min) * ((this.unlock) ? vX : this.intpos.x))) / rn;
                
            // 值变化时更新画布
            if (this.properties.value !== prevX) {
                this.setDirtyCanvas?.(true, true);
                this.graph?.setDirtyCanvas?.(true, true);
            }
        };
        
        // 选中节点时结束拖动
        nodeType.prototype.onSelected = function(e) { 
            this.onMouseUp(e);
        };
        
        // 尺寸计算
        nodeType.prototype.computeSize = function() {
            return [LiteGraph.NODE_WIDTH, Math.floor(LiteGraph.NODE_SLOT_HEIGHT * 1.5)];
        };
    }
});

