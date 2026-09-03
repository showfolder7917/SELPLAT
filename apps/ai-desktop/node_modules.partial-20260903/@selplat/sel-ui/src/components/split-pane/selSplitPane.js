/*
 * selSplitPane.js：可复用双区可调分隔面板基础控件。
 * 负责水平或垂直分区、指针拖动、键盘调整、比例约束和销毁，不识别分区内业务内容。
 */
(function selSplitPaneInitializeRegistry() {
    "use strict";

    const selFreeze = window.sel.core.freeze;

    // 每个分隔面板按完整业务实例键独立保存，页签关闭时可以精确销毁。
    const selSplitPaneInstances = new Map();

    /**
     * 挂载一套双区分隔面板。
     * @param {Element} selSplitPaneHost - 页签或面板提供的空宿主。
     * @param {object} selSplitPaneOptions - 包含 id、direction、ratio、minRatio、maxRatio 和可访问名称。
     * @returns {object|null} 成功返回分隔面板控制器；参数无效时返回 null。
     */
    function selSplitPaneMount(selSplitPaneHost, selSplitPaneOptions = {}) {
        if (!(selSplitPaneHost instanceof Element)) return null;
        const selSplitPaneId = String(selSplitPaneOptions.id || selSplitPaneHost.dataset.selSplitPane || "").trim();
        if (!selSplitPaneId) return null;
        if (selSplitPaneInstances.has(selSplitPaneId)) return selSplitPaneInstances.get(selSplitPaneId);

        const selSplitPaneDirection = selSplitPaneOptions.direction === "horizontal" ? "horizontal" : "vertical";
        const selSplitPaneRoot = document.createElement("section");
        selSplitPaneRoot.className = `selsplit-root selsplit-root-${selSplitPaneDirection}`;
        selSplitPaneRoot.dataset.selSplitPane = selSplitPaneId;
        const selSplitPaneStart = document.createElement("section");
        selSplitPaneStart.className = "selsplit-pane selsplit-pane-start";
        selSplitPaneStart.dataset.selSplitPaneRegion = "start";
        selSplitPaneStart.setAttribute("aria-label", String(selSplitPaneOptions.startLabel || "上方区域"));
        const selSplitPaneSeparator = document.createElement("button");
        selSplitPaneSeparator.className = "selsplit-separator";
        selSplitPaneSeparator.type = "button";
        selSplitPaneSeparator.setAttribute("role", "separator");
        selSplitPaneSeparator.setAttribute("aria-label", String(selSplitPaneOptions.separatorLabel || "调整区域大小"));
        selSplitPaneSeparator.setAttribute("aria-orientation", selSplitPaneDirection === "vertical" ? "horizontal" : "vertical");
        selSplitPaneSeparator.innerHTML = '<span aria-hidden="true"></span>';
        const selSplitPaneEnd = document.createElement("section");
        selSplitPaneEnd.className = "selsplit-pane selsplit-pane-end";
        selSplitPaneEnd.dataset.selSplitPaneRegion = "end";
        selSplitPaneEnd.setAttribute("aria-label", String(selSplitPaneOptions.endLabel || "下方区域"));
        selSplitPaneRoot.append(selSplitPaneStart, selSplitPaneSeparator, selSplitPaneEnd);
        selSplitPaneHost.appendChild(selSplitPaneRoot);

        const selSplitPaneMinimumRatio = Math.max(5, Math.min(90, Number(selSplitPaneOptions.minRatio) || 20));
        const selSplitPaneMaximumRatio = Math.max(selSplitPaneMinimumRatio, Math.min(95, Number(selSplitPaneOptions.maxRatio) || 75));
        const selSplitPaneDefaultRatio = Math.min(selSplitPaneMaximumRatio, Math.max(selSplitPaneMinimumRatio, Number(selSplitPaneOptions.ratio) || 38));
        let selSplitPaneRatio = selSplitPaneDefaultRatio;
        let selSplitPaneDragging = false;
        let selSplitPaneDestroyed = false;

        // 比例写入组件公开变量，布局始终由基础 CSS 控制，应用不访问内部类。
        function selSplitPaneSetRatio(selSplitPaneNextRatio, selSplitPaneEmit = true) {
            if (selSplitPaneDestroyed) return false;
            selSplitPaneRatio = Math.min(selSplitPaneMaximumRatio, Math.max(selSplitPaneMinimumRatio, Number(selSplitPaneNextRatio) || selSplitPaneDefaultRatio));
            selSplitPaneRoot.style.setProperty("--selsplit-start-ratio", `${selSplitPaneRatio}%`);
            selSplitPaneSeparator.setAttribute("aria-valuemin", String(selSplitPaneMinimumRatio));
            selSplitPaneSeparator.setAttribute("aria-valuemax", String(selSplitPaneMaximumRatio));
            selSplitPaneSeparator.setAttribute("aria-valuenow", String(Math.round(selSplitPaneRatio)));
            if (selSplitPaneEmit) {
                selSplitPaneRoot.dispatchEvent(new CustomEvent("selSplitPane:resize", {
                    bubbles: true,
                    detail: selFreeze({ splitPaneId: selSplitPaneId, ratio: selSplitPaneRatio, direction: selSplitPaneDirection })
                }));
            }
            return true;
        }

        // 指针位置相对于当前面板实测矩形换算，不依赖窗口大小或应用坐标。
        function selSplitPaneRatioFromPointer(selSplitPaneEvent) {
            const selSplitPaneBounds = selSplitPaneRoot.getBoundingClientRect();
            if (selSplitPaneDirection === "vertical") {
                return ((selSplitPaneEvent.clientY - selSplitPaneBounds.top) / Math.max(1, selSplitPaneBounds.height)) * 100;
            }
            return ((selSplitPaneEvent.clientX - selSplitPaneBounds.left) / Math.max(1, selSplitPaneBounds.width)) * 100;
        }

        selSplitPaneSeparator.addEventListener("pointerdown", (selSplitPaneEvent) => {
            if (selSplitPaneEvent.button !== 0) return;
            selSplitPaneEvent.preventDefault();
            selSplitPaneDragging = true;
            selSplitPaneSeparator.setPointerCapture(selSplitPaneEvent.pointerId);
            selSplitPaneSeparator.setAttribute("aria-pressed", "true");
            selSplitPaneRoot.classList.add("selsplit-root-resizing");
        });
        selSplitPaneSeparator.addEventListener("pointermove", (selSplitPaneEvent) => {
            if (!selSplitPaneDragging) return;
            selSplitPaneSetRatio(selSplitPaneRatioFromPointer(selSplitPaneEvent));
        });
        const selSplitPaneEndPointer = (selSplitPaneEvent) => {
            if (!selSplitPaneDragging) return;
            selSplitPaneDragging = false;
            if (selSplitPaneSeparator.hasPointerCapture(selSplitPaneEvent.pointerId)) selSplitPaneSeparator.releasePointerCapture(selSplitPaneEvent.pointerId);
            selSplitPaneSeparator.setAttribute("aria-pressed", "false");
            selSplitPaneRoot.classList.remove("selsplit-root-resizing");
        };
        selSplitPaneSeparator.addEventListener("pointerup", selSplitPaneEndPointer);
        selSplitPaneSeparator.addEventListener("pointercancel", selSplitPaneEndPointer);
        // 键盘每次调整两个百分点，Shift 提供更快的大步进路径。
        selSplitPaneSeparator.addEventListener("keydown", (selSplitPaneEvent) => {
            const selSplitPaneStep = selSplitPaneEvent.shiftKey ? 10 : 2;
            const selSplitPaneDecreaseKey = selSplitPaneDirection === "vertical" ? "ArrowUp" : "ArrowLeft";
            const selSplitPaneIncreaseKey = selSplitPaneDirection === "vertical" ? "ArrowDown" : "ArrowRight";
            if (selSplitPaneEvent.key === selSplitPaneDecreaseKey) {
                selSplitPaneEvent.preventDefault();
                selSplitPaneSetRatio(selSplitPaneRatio - selSplitPaneStep);
            }
            if (selSplitPaneEvent.key === selSplitPaneIncreaseKey) {
                selSplitPaneEvent.preventDefault();
                selSplitPaneSetRatio(selSplitPaneRatio + selSplitPaneStep);
            }
            if (selSplitPaneEvent.key === "Home") {
                selSplitPaneEvent.preventDefault();
                selSplitPaneSetRatio(selSplitPaneMinimumRatio);
            }
            if (selSplitPaneEvent.key === "End") {
                selSplitPaneEvent.preventDefault();
                selSplitPaneSetRatio(selSplitPaneMaximumRatio);
            }
        });
        // 双击恢复调用方声明的默认比例，便于快速回到标准工作区布局。
        selSplitPaneSeparator.addEventListener("dblclick", () => selSplitPaneSetRatio(selSplitPaneDefaultRatio));

        function selSplitPaneDestroy() {
            if (selSplitPaneDestroyed) return false;
            selSplitPaneDestroyed = true;
            selSplitPaneInstances.delete(selSplitPaneId);
            selSplitPaneRoot.remove();
            return true;
        }

        const selSplitPaneController = {
            id: selSplitPaneId,
            root: selSplitPaneRoot,
            start: selSplitPaneStart,
            end: selSplitPaneEnd,
            setRatio: selSplitPaneSetRatio,
            reset: () => selSplitPaneSetRatio(selSplitPaneDefaultRatio),
            getState: () => selFreeze({ direction: selSplitPaneDirection, ratio: selSplitPaneRatio, dragging: selSplitPaneDragging }),
            destroy: selSplitPaneDestroy
        };
        selSplitPaneInstances.set(selSplitPaneId, selSplitPaneController);
        selSplitPaneRoot.dataset.selSplitPaneReady = "true";
        selSplitPaneSetRatio(selSplitPaneDefaultRatio, false);
        return selSplitPaneController;
    }

    window.sel.register("components.splitPane", {
        mount: selSplitPaneMount,
        get: (selSplitPaneId) => selSplitPaneInstances.get(String(selSplitPaneId)) || null,
        has: (selSplitPaneId) => selSplitPaneInstances.has(String(selSplitPaneId)),
        list: () => selFreeze(Array.from(selSplitPaneInstances.keys()))
    });
})();
