/*
 * selCodeEditor.js：可复用轻量代码编辑器基础控件。
 * 负责工具栏、代码输入、行号、快捷执行、反馈、加载状态和销毁；语言只作为显示与事件元数据。
 */
(function selCodeEditorInitializeRegistry() {
    "use strict";

    // 动态页签中的编辑器按完整实例键登记，关闭页签时可以从注册表彻底回收。
    const selCodeEditorInstances = new Map();

    /**
     * 挂载一个轻量代码编辑器。
     * @param {Element} selCodeEditorHost - 分隔面板提供的编辑区域宿主。
     * @param {object} selCodeEditorOptions - 包含 id、language、label、value、actions 和快捷键文案。
     * @returns {object|null} 成功返回编辑器控制器；宿主或实例键无效时返回 null。
     */
    function selCodeEditorMount(selCodeEditorHost, selCodeEditorOptions = {}) {
        if (!(selCodeEditorHost instanceof Element)) return null;
        const selCodeEditorId = String(selCodeEditorOptions.id || selCodeEditorHost.dataset.selCodeEditor || "").trim();
        if (!selCodeEditorId) return null;
        if (selCodeEditorInstances.has(selCodeEditorId)) return selCodeEditorInstances.get(selCodeEditorId);

        const selCodeEditorLanguage = String(selCodeEditorOptions.language || "text").toLowerCase();
        const selCodeEditorRoot = document.createElement("section");
        selCodeEditorRoot.className = "selcode-root";
        selCodeEditorRoot.dataset.selCodeEditor = selCodeEditorId;
        selCodeEditorRoot.dataset.selCodeLanguage = selCodeEditorLanguage;
        selCodeEditorRoot.setAttribute("aria-label", String(selCodeEditorOptions.ariaLabel || selCodeEditorOptions.label || "代码编辑器"));
        const selCodeEditorToolbar = document.createElement("header");
        selCodeEditorToolbar.className = "selcode-toolbar";
        const selCodeEditorIdentity = document.createElement("div");
        selCodeEditorIdentity.className = "selcode-identity";
        const selCodeEditorIdentityIcon = document.createElement("i");
        selCodeEditorIdentityIcon.className = String(selCodeEditorOptions.icon || "ri-code-s-slash-line");
        selCodeEditorIdentityIcon.setAttribute("aria-hidden", "true");
        const selCodeEditorIdentityLabel = document.createElement("strong");
        selCodeEditorIdentityLabel.textContent = String(selCodeEditorOptions.label || selCodeEditorLanguage.toUpperCase());
        const selCodeEditorShortcut = document.createElement("span");
        selCodeEditorShortcut.textContent = String(selCodeEditorOptions.shortcutLabel || "Ctrl/⌘ + Enter 执行");
        selCodeEditorIdentity.append(selCodeEditorIdentityIcon, selCodeEditorIdentityLabel, selCodeEditorShortcut);
        const selCodeEditorActions = document.createElement("div");
        selCodeEditorActions.className = "selcode-actions";
        selCodeEditorActions.setAttribute("aria-label", String(selCodeEditorOptions.actionsLabel || "编辑器操作"));
        const selCodeEditorActionDefinitions = Array.isArray(selCodeEditorOptions.actions) && selCodeEditorOptions.actions.length > 0
            ? selCodeEditorOptions.actions
            : [
                { id: "execute", label: "执行", icon: "ri-play-fill", primary: true },
                { id: "clear", label: "清空", icon: "ri-delete-bin-line" }
            ];
        selCodeEditorActionDefinitions.forEach((selCodeEditorAction) => {
            const selCodeEditorButton = document.createElement("button");
            selCodeEditorButton.className = `selcode-action${selCodeEditorAction.primary ? " selcode-action-primary" : ""}`;
            selCodeEditorButton.type = "button";
            selCodeEditorButton.dataset.selCodeAction = String(selCodeEditorAction.id || "");
            const selCodeEditorButtonIcon = document.createElement("i");
            selCodeEditorButtonIcon.className = String(selCodeEditorAction.icon || "ri-circle-line");
            selCodeEditorButtonIcon.setAttribute("aria-hidden", "true");
            const selCodeEditorButtonLabel = document.createElement("span");
            selCodeEditorButtonLabel.textContent = String(selCodeEditorAction.label || selCodeEditorAction.id || "操作");
            selCodeEditorButton.append(selCodeEditorButtonIcon, selCodeEditorButtonLabel);
            selCodeEditorActions.appendChild(selCodeEditorButton);
        });
        selCodeEditorToolbar.append(selCodeEditorIdentity, selCodeEditorActions);

        const selCodeEditorBody = document.createElement("div");
        selCodeEditorBody.className = "selcode-body";
        const selCodeEditorGutter = document.createElement("pre");
        selCodeEditorGutter.className = "selcode-gutter";
        selCodeEditorGutter.setAttribute("aria-hidden", "true");
        const selCodeEditorInput = document.createElement("textarea");
        selCodeEditorInput.className = "selcode-input";
        selCodeEditorInput.name = String(selCodeEditorOptions.name || "code");
        selCodeEditorInput.spellcheck = false;
        selCodeEditorInput.wrap = "off";
        selCodeEditorInput.placeholder = String(selCodeEditorOptions.placeholder || "");
        selCodeEditorInput.setAttribute("aria-label", String(selCodeEditorOptions.inputLabel || selCodeEditorOptions.label || "代码"));
        selCodeEditorInput.value = String(selCodeEditorOptions.value || "");
        selCodeEditorBody.append(selCodeEditorGutter, selCodeEditorInput);
        const selCodeEditorStatus = document.createElement("footer");
        selCodeEditorStatus.className = "selcode-status";
        selCodeEditorStatus.setAttribute("role", "status");
        selCodeEditorStatus.setAttribute("aria-live", "polite");
        const selCodeEditorStatusText = document.createElement("span");
        selCodeEditorStatusText.textContent = String(selCodeEditorOptions.statusText || "就绪");
        const selCodeEditorPosition = document.createElement("span");
        selCodeEditorStatus.append(selCodeEditorStatusText, selCodeEditorPosition);
        selCodeEditorRoot.append(selCodeEditorToolbar, selCodeEditorBody, selCodeEditorStatus);
        selCodeEditorHost.appendChild(selCodeEditorRoot);

        let selCodeEditorLoading = false;
        let selCodeEditorDestroyed = false;

        // 行号和光标位置由输入值实时推导，不复制一份业务 SQL 状态。
        function selCodeEditorRefreshMetrics() {
            const selCodeEditorLineCount = Math.max(1, selCodeEditorInput.value.split("\n").length);
            selCodeEditorGutter.textContent = Array.from({ length: selCodeEditorLineCount }, (_, selCodeEditorIndex) => String(selCodeEditorIndex + 1)).join("\n");
            const selCodeEditorBeforeCursor = selCodeEditorInput.value.slice(0, selCodeEditorInput.selectionStart);
            const selCodeEditorCursorLines = selCodeEditorBeforeCursor.split("\n");
            selCodeEditorPosition.textContent = `Ln ${selCodeEditorCursorLines.length}, Col ${selCodeEditorCursorLines.at(-1).length + 1}`;
        }

        // 编辑区和行号使用相同滚动位置，长 SQL 不会出现行号错位。
        function selCodeEditorSyncScroll() {
            selCodeEditorGutter.scrollTop = selCodeEditorInput.scrollTop;
        }

        // 所有业务动作都从当前编辑器根冒泡，并携带实例键、语言和实时内容。
        function selCodeEditorDispatchAction(selCodeEditorActionId) {
            if (selCodeEditorDestroyed || selCodeEditorLoading) return false;
            const selCodeEditorNormalizedAction = String(selCodeEditorActionId || "");
            if (!selCodeEditorNormalizedAction) return false;
            if (selCodeEditorNormalizedAction === "clear") {
                selCodeEditorInput.value = "";
                selCodeEditorRefreshMetrics();
                selCodeEditorInput.focus();
            }
            selCodeEditorRoot.dispatchEvent(new CustomEvent("selCodeEditor:action", {
                bubbles: true,
                detail: Object.freeze({ editorId: selCodeEditorId, action: selCodeEditorNormalizedAction, language: selCodeEditorLanguage, value: selCodeEditorInput.value })
            }));
            return true;
        }

        selCodeEditorActions.addEventListener("click", (selCodeEditorEvent) => {
            const selCodeEditorButton = selCodeEditorEvent.target.closest("[data-sel-code-action]");
            if (selCodeEditorButton) selCodeEditorDispatchAction(selCodeEditorButton.dataset.selCodeAction);
        });
        selCodeEditorInput.addEventListener("input", () => {
            selCodeEditorRefreshMetrics();
            selCodeEditorRoot.dispatchEvent(new CustomEvent("selCodeEditor:change", {
                bubbles: true,
                detail: Object.freeze({ editorId: selCodeEditorId, language: selCodeEditorLanguage, value: selCodeEditorInput.value })
            }));
        });
        selCodeEditorInput.addEventListener("scroll", selCodeEditorSyncScroll);
        selCodeEditorInput.addEventListener("click", selCodeEditorRefreshMetrics);
        selCodeEditorInput.addEventListener("keyup", selCodeEditorRefreshMetrics);
        // Ctrl/Command + Enter 始终触发第一项主操作；默认配置即执行代码。
        selCodeEditorInput.addEventListener("keydown", (selCodeEditorEvent) => {
            if (selCodeEditorEvent.key !== "Enter" || (!selCodeEditorEvent.ctrlKey && !selCodeEditorEvent.metaKey)) return;
            selCodeEditorEvent.preventDefault();
            const selCodeEditorPrimaryAction = selCodeEditorActions.querySelector(".selcode-action-primary")?.dataset.selCodeAction
                || selCodeEditorActionDefinitions[0]?.id;
            selCodeEditorDispatchAction(selCodeEditorPrimaryAction);
        });

        function selCodeEditorSetValue(selCodeEditorValue) {
            if (selCodeEditorDestroyed) return false;
            selCodeEditorInput.value = String(selCodeEditorValue ?? "");
            selCodeEditorRefreshMetrics();
            return true;
        }

        function selCodeEditorSetLoading(selCodeEditorNextLoading) {
            if (selCodeEditorDestroyed) return false;
            selCodeEditorLoading = Boolean(selCodeEditorNextLoading);
            selCodeEditorRoot.classList.toggle("selcode-root-loading", selCodeEditorLoading);
            selCodeEditorRoot.setAttribute("aria-busy", String(selCodeEditorLoading));
            selCodeEditorActions.querySelectorAll("button").forEach((selCodeEditorButton) => { selCodeEditorButton.disabled = selCodeEditorLoading; });
            return true;
        }

        function selCodeEditorSetFeedback(selCodeEditorMessage, selCodeEditorTone = "neutral") {
            if (selCodeEditorDestroyed) return false;
            selCodeEditorStatusText.textContent = String(selCodeEditorMessage || "");
            selCodeEditorStatus.dataset.selCodeTone = ["success", "error", "warning"].includes(selCodeEditorTone) ? selCodeEditorTone : "neutral";
            return true;
        }

        function selCodeEditorDestroy() {
            if (selCodeEditorDestroyed) return false;
            selCodeEditorDestroyed = true;
            selCodeEditorInstances.delete(selCodeEditorId);
            selCodeEditorRoot.remove();
            return true;
        }

        const selCodeEditorController = Object.freeze({
            id: selCodeEditorId,
            root: selCodeEditorRoot,
            input: selCodeEditorInput,
            focus: () => selCodeEditorInput.focus(),
            getValue: () => selCodeEditorInput.value,
            setValue: selCodeEditorSetValue,
            setLoading: selCodeEditorSetLoading,
            isLoading: () => selCodeEditorLoading,
            setFeedback: selCodeEditorSetFeedback,
            action: selCodeEditorDispatchAction,
            getState: () => Object.freeze({ language: selCodeEditorLanguage, loading: selCodeEditorLoading, value: selCodeEditorInput.value }),
            destroy: selCodeEditorDestroy
        });
        selCodeEditorInstances.set(selCodeEditorId, selCodeEditorController);
        selCodeEditorRoot.dataset.selCodeEditorReady = "true";
        selCodeEditorRefreshMetrics();
        return selCodeEditorController;
    }

    window.selCodeEditor = Object.freeze({
        mount: selCodeEditorMount,
        get: (selCodeEditorId) => selCodeEditorInstances.get(String(selCodeEditorId)) || null,
        has: (selCodeEditorId) => selCodeEditorInstances.has(String(selCodeEditorId)),
        list: () => Object.freeze(Array.from(selCodeEditorInstances.keys()))
    });
})();
