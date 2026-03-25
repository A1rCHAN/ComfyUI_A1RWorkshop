import { app } from "/scripts/app.js";
import { initGlobalThemeCSSVar, injectCSS } from "../theme/themeWatcher.js";
import { createCollectorButton, stopCollectorForRemovedNode } from "../helper/collector.js";
import { BUTTON_TEXTS, collectNodes, getDefaultDisabledMode, getCollectedRecords, cleanupMirrorBindings, syncCollectedRecordsToProperties, normalizeDisabledMode, rebuildCollectedRecords, restoreCollectedNodes, COLLECTOR_SESSION_KEY, getCollectButtonFromNode, setCollectButtonInactive, deactivateCollect, restoreAllTargetNodeModes, } from "../helper/collectorNode.js";
function createActiveButton(node) {
    const binding = createCollectorButton(node, {
        text: BUTTON_TEXTS.inactive,
        ellipsis: true,
        serialize: true,
        widgetName: "mode_collect_button",
        widgetType: "MODE_COLLECT_BUTTON",
        buttonRefKey: "__a1rModeCollectButton",
        widgetRefKey: "__a1rModeCollectButtonWidget",
        onClick: (_event, button) => {
            collectNodes(node, button);
        },
    });
    return binding.widget;
}
app.registerExtension({
    name: "a1rworkshop.modecollector",
    async setup() {
        initGlobalThemeCSSVar();
        injectCSS("../../css/a1r-collector.css", import.meta.url);
    },
    async nodeCreated(node) {
        if (node.comfyClass !== "ModeCollector")
            return;
        node.properties = node.properties || {};
        node.properties._default_disabled_mode = getDefaultDisabledMode(node);
        getCollectedRecords(node);
        cleanupMirrorBindings(node);
        const originalOnSerialize = node.onSerialize;
        node.onSerialize = function (o) {
            if (typeof originalOnSerialize === "function") {
                originalOnSerialize.apply(this, arguments);
            }
            syncCollectedRecordsToProperties(this);
            if (o && typeof o === "object") {
                o.properties = o.properties || {};
                o.properties._collected_nodes = this.properties?._collected_nodes || [];
                o.properties._default_disabled_mode = this.properties?._default_disabled_mode || 4;
            }
        };
        const originalOnConfigure = node.onConfigure;
        node.onConfigure = function (info) {
            if (typeof originalOnConfigure === "function") {
                originalOnConfigure.apply(this, arguments);
            }
            const rawRecords = info?.properties?._collected_nodes ?? this.properties?._collected_nodes;
            this.properties = this.properties || {};
            this.properties._default_disabled_mode = normalizeDisabledMode(info?.properties?._default_disabled_mode ?? this.properties?._default_disabled_mode);
            rebuildCollectedRecords(this, rawRecords);
            restoreCollectedNodes(this);
        };
        const originalOnRemoved = node.onRemoved;
        node.onRemoved = function (...args) {
            stopCollectorForRemovedNode({
                sessionKey: COLLECTOR_SESSION_KEY,
                removedNode: this,
                getButtonFromNode: getCollectButtonFromNode,
                setButtonInactive: setCollectButtonInactive,
                onDeactivate: deactivateCollect,
            });
            restoreAllTargetNodeModes(this);
            cleanupMirrorBindings(this);
            if (typeof originalOnRemoved === "function") {
                originalOnRemoved.apply(this, args);
            }
        };
        createActiveButton(node);
        restoreCollectedNodes(node);
    },
});
