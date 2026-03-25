import { app } from "/scripts/app.js";
import { initGlobalThemeCSSVar, injectCSS } from "../theme/themeWatcher.js";
import { createCollectorButton, ensureCollectButtonAtBottom, stopCollectorForRemovedNode } from "../helper/collector.js";
import { collectWidgets, getCollectedRecords, cleanupMirrorBindings, syncCollectedRecordsToProperties, rebuildCollectedRecords, restoreCollectedWidgets, COLLECTOR_SESSION_KEY, getCollectButtonFromNode, setCollectButtonInactive, deactivateCollect, } from "../helper/collectorWidget.js";
function createActiveButton(node) {
    const binding = createCollectorButton(node, {
        text: "collect widgets",
        ellipsis: true,
        serialize: false,
        widgetName: "seed_buttons",
        widgetType: "SEED_BUTTONS",
        buttonRefKey: "__a1rCollectButton",
        widgetRefKey: "__a1rCollectButtonWidget",
        onClick: (_event, button) => collectWidgets(node, button),
    });
    ensureCollectButtonAtBottom(node);
    return binding.widget;
}
app.registerExtension({
    name: "a1rworkshop.widgetcollector",
    async setup() {
        initGlobalThemeCSSVar();
        injectCSS("../../css/a1r-collector.css", import.meta.url);
    },
    async nodeCreated(node) {
        if (node.comfyClass !== "WidgetCollector")
            return;
        node.properties = node.properties || {};
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
                o.properties._collected_widgets = this.properties?._collected_widgets || [];
            }
        };
        const originalOnConfigure = node.onConfigure;
        node.onConfigure = function (info) {
            if (typeof originalOnConfigure === "function") {
                originalOnConfigure.apply(this, arguments);
            }
            const rawRecords = info?.properties?._collected_widgets ?? this.properties?._collected_widgets;
            rebuildCollectedRecords(this, rawRecords);
            restoreCollectedWidgets(this);
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
            cleanupMirrorBindings(this);
            if (typeof originalOnRemoved === "function") {
                originalOnRemoved.apply(this, args);
            }
        };
        createActiveButton(node);
        restoreCollectedWidgets(node);
    },
});
