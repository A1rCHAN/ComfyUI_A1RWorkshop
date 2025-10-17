import { app } from "../../../scripts/app.js";

// Seed 控制（精简）：仅保留 "Manual Random" 按钮
// - 点击后：生成 64 位随机种子，写回 seed，强制将"生成后控制"切为 fixed，并可选触发一次运行
app.registerExtension({
    name: "A1rSpace.Seed_Control",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const names = ["Seed_Control", "A1r Seed Control", "Seed Control"]; // 映射兼容
        if (!names.includes(nodeData.name)) return;

        // 查找 widget by name
        const byName = (node, name) => node.widgets?.find(w => w?.name === name);

        // 生成 0..2^64-1 随机整数（优先加密）
        function randomU64() {
            try {
                if (globalThis.crypto?.getRandomValues) {
                    const buf = new Uint32Array(2);
                    globalThis.crypto.getRandomValues(buf);
                    const hi = BigInt(buf[0]);
                    const lo = BigInt(buf[1]);
                    return ((hi << 32n) | lo).toString();
                }
            } catch {}
            const hi = Math.floor(Math.random() * 0x100000000);
            const lo = Math.floor(Math.random() * 0x100000000);
            return (BigInt(hi) << 32n | BigInt(lo)).toString();
        }

        // 将 "生成后控制" 切为 fixed
        // control_after_generate 是前端自动添加到 seed widget 的控制选项
        // 需要通过 widgets_values 序列化机制来持久化
        function setControlAfterGenerateFixed(node) {
            try {
                const ws = Array.isArray(node.widgets) ? node.widgets : [];
                
                // 查找 control_after_generate widget
                const ctrlWidget = ws.find(w => {
                    const nm = (w?.name || '').toLowerCase();
                    return nm.includes('control') && nm.includes('generate');
                });
                
                if (ctrlWidget) {
                    // 设置值为 'fixed'
                    ctrlWidget.value = 'fixed';
                    
                    // 更新 widgets_values 以持久化（ComfyUI 的序列化机制）
                    if (!Array.isArray(node.widgets_values)) {
                        node.widgets_values = [];
                    }
                    
                    // 确保 widgets_values 长度足够
                    while (node.widgets_values.length < ws.length) {
                        node.widgets_values.push(null);
                    }
                    
                    // 写入 fixed 值到对应位置
                    const ctrlIdx = ws.indexOf(ctrlWidget);
                    if (ctrlIdx >= 0) {
                        node.widgets_values[ctrlIdx] = 'fixed';
                    }
                    
                    // 标记已设置，用于恢复时判断
                    node.properties = node.properties || {};
                    node.properties.__a1r_seed_control_fixed = true;
                    
                    // 触发回调
                    try { 
                        ctrlWidget.callback?.call(node, 'fixed', ctrlWidget, node); 
                    } catch {}
                    
                    return true;
                }
                
                return false;
            } catch (e) {
                console.warn('[Seed_Control] setControlAfterGenerateFixed error:', e);
                return false;
            }
        }

        // 生命周期：创建/载入/加入图时注入按钮
        const origOnCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function() {
            origOnCreated?.apply(this, arguments);
            const init = () => {
                if (!Array.isArray(this.widgets)) return void requestAnimationFrame(init);
                ensureManualRandom.call(this);
            };
            init();
        };

        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function(info) {
            const r = origOnConfigure?.apply(this, arguments);
            try { 
                this.onNodeCreated?.(); 
                
                // 关键修复：从序列化数据恢复 control_after_generate 状态
                if (this.properties?.__a1r_seed_control_fixed) {
                    // 延迟执行，确保所有 widgets 已初始化
                    setTimeout(() => {
                        try {
                            const ws = Array.isArray(this.widgets) ? this.widgets : [];
                            const ctrlWidget = ws.find(w => {
                                const nm = (w?.name || '').toLowerCase();
                                return nm.includes('control') && nm.includes('generate');
                            });
                            
                            if (ctrlWidget && Array.isArray(this.widgets_values)) {
                                const ctrlIdx = ws.indexOf(ctrlWidget);
                                if (ctrlIdx >= 0 && ctrlIdx < this.widgets_values.length) {
                                    const savedValue = this.widgets_values[ctrlIdx];
                                    if (savedValue === 'fixed') {
                                        ctrlWidget.value = 'fixed';
                                        try { ctrlWidget.callback?.call(this, 'fixed', ctrlWidget, this); } catch {}
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('[Seed_Control] onConfigure restore error:', e);
                        }
                    }, 50);
                }
            } catch {}
            return r;
        };

        const origOnAdded = nodeType.prototype.onAdded;
        nodeType.prototype.onAdded = function() {
            const r = origOnAdded?.apply(this, arguments);
            try { this.onNodeCreated?.(); } catch {}
            return r;
        };

        // 创建按钮（放在 seed 控件后）：Manual Random
        function ensureManualRandom() {
            const seedW = byName(this, 'seed');
            if (!seedW) return;
            if (this.__a1r_manualRandomBtn) return this.__a1r_manualRandomBtn;

            const manualBtn = this.addWidget?.('button', 'Manual Random', null, async () => {
                const n = Number(randomU64());
                if (!Number.isFinite(n)) return;
                seedW.value = n;
                try { seedW.callback?.call(this, n, seedW, this); } catch {}
                setControlAfterGenerateFixed(this);
                this.setDirtyCanvas?.(true, true);
                this.graph?.setDirtyCanvas?.(true, true);
                try {
                    // 给 UI 状态一点时间提交，避免 "execution_start before prompt"
                    await new Promise(r => setTimeout(r, 120));
                    await new Promise(r => requestAnimationFrame(() => r()));
                    if (typeof app?.queuePrompt === 'function') {
                        await app.queuePrompt();
                    } else if (typeof app?.runWorkflow === 'function') {
                        await app.runWorkflow();
                    } else if (typeof this?.graph?.queuePrompt === 'function') {
                        await this.graph.queuePrompt();
                    }
                } catch {}
            });

            const seedIndex = this.widgets.indexOf(seedW);
            if (seedIndex >= 0) {
                const curIndex = this.widgets.indexOf(manualBtn);
                if (curIndex > -1) this.widgets.splice(curIndex, 1);
                this.widgets.splice(seedIndex + 1, 0, manualBtn);
            }
            if (manualBtn) manualBtn.serialize = false;
            this.__a1r_manualRandomBtn = manualBtn;
            return manualBtn;
        }
    }
});
