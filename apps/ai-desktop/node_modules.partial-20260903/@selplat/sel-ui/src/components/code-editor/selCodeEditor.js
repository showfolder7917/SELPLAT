/*
 * selCodeEditor.js：可复用轻量代码编辑器基础控件。
 * 负责工具栏、代码输入、行号、快捷执行、反馈、加载状态和销毁；语言只作为显示与事件元数据。
 */
(function selCodeEditorInitializeRegistry() {
    "use strict";

    const selFreeze = window.sel.core.freeze;

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
        // 未声明状态文字时保留通用默认值；应用明确传入空字符串时只显示右侧光标位置。
        selCodeEditorStatusText.textContent = String(selCodeEditorOptions.statusText ?? "就绪");
        const selCodeEditorPosition = document.createElement("span");
        selCodeEditorStatus.append(selCodeEditorStatusText, selCodeEditorPosition);
        selCodeEditorRoot.append(selCodeEditorToolbar, selCodeEditorBody, selCodeEditorStatus);
        selCodeEditorHost.appendChild(selCodeEditorRoot);

        let selCodeEditorLoading = false;
        let selCodeEditorDestroyed = false;
        let selCodeEditorSavedSelectionStart = 0;
        let selCodeEditorSavedSelectionEnd = 0;
        let selCodeEditorSavedSelectionValue = selCodeEditorInput.value;

        // 保存最后一个有效选区，让工具栏取得动作时仍能读取用户明确选中的代码。
        function selCodeEditorCaptureSelection() {
            if (selCodeEditorDestroyed) return false;
            const selCodeEditorSelectionStart = Number(selCodeEditorInput.selectionStart || 0);
            const selCodeEditorSelectionEnd = Number(selCodeEditorInput.selectionEnd || 0);
            if (selCodeEditorSelectionEnd > selCodeEditorSelectionStart) {
                selCodeEditorSavedSelectionStart = selCodeEditorSelectionStart;
                selCodeEditorSavedSelectionEnd = selCodeEditorSelectionEnd;
                selCodeEditorSavedSelectionValue = selCodeEditorInput.value;
                return true;
            }
            // 用户在编辑区主动折叠选区时立即清空快照，防止误执行历史选区。
            if (document.activeElement === selCodeEditorInput) {
                selCodeEditorSavedSelectionStart = selCodeEditorSelectionStart;
                selCodeEditorSavedSelectionEnd = selCodeEditorSelectionStart;
                selCodeEditorSavedSelectionValue = selCodeEditorInput.value;
            }
            return false;
        }

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

        // 所有业务动作都从当前编辑器根冒泡，并携带实例键、语言、实时内容和触发瞬间的选中内容。
        function selCodeEditorDispatchAction(selCodeEditorActionId) {
            if (selCodeEditorDestroyed || selCodeEditorLoading) return false;
            const selCodeEditorNormalizedAction = String(selCodeEditorActionId || "");
            if (!selCodeEditorNormalizedAction) return false;
            const selCodeEditorSelectedValue = selCodeEditorGetSelectedValue();
            if (selCodeEditorNormalizedAction === "clear") {
                selCodeEditorInput.value = "";
                selCodeEditorSavedSelectionStart = 0;
                selCodeEditorSavedSelectionEnd = 0;
                selCodeEditorSavedSelectionValue = "";
                selCodeEditorRefreshMetrics();
                selCodeEditorInput.focus();
            }
            selCodeEditorRoot.dispatchEvent(new CustomEvent("selCodeEditor:action", {
                bubbles: true,
                detail: selFreeze({
                    editorId: selCodeEditorId,
                    action: selCodeEditorNormalizedAction,
                    language: selCodeEditorLanguage,
                    value: selCodeEditorInput.value,
                    selectedValue: selCodeEditorSelectedValue
                })
            }));
            return true;
        }

        // 鼠标按下工具栏动作时阻止焦点离开 textarea，原生选中高亮不会在 click 前消失。
        selCodeEditorActions.addEventListener("mousedown", (selCodeEditorEvent) => {
            const selCodeEditorButton = selCodeEditorEvent.target.closest("[data-sel-code-action]");
            if (!selCodeEditorButton) return;
            selCodeEditorCaptureSelection();
            selCodeEditorEvent.preventDefault();
        });
        selCodeEditorActions.addEventListener("click", (selCodeEditorEvent) => {
            const selCodeEditorButton = selCodeEditorEvent.target.closest("[data-sel-code-action]");
            if (selCodeEditorButton) selCodeEditorDispatchAction(selCodeEditorButton.dataset.selCodeAction);
        });
        selCodeEditorInput.addEventListener("input", () => {
            selCodeEditorCaptureSelection();
            selCodeEditorRefreshMetrics();
            selCodeEditorRoot.dispatchEvent(new CustomEvent("selCodeEditor:change", {
                bubbles: true,
                detail: selFreeze({ editorId: selCodeEditorId, language: selCodeEditorLanguage, value: selCodeEditorInput.value })
            }));
        });
        selCodeEditorInput.addEventListener("scroll", selCodeEditorSyncScroll);
        selCodeEditorInput.addEventListener("select", selCodeEditorCaptureSelection);
        selCodeEditorInput.addEventListener("click", () => {
            selCodeEditorCaptureSelection();
            selCodeEditorRefreshMetrics();
        });
        selCodeEditorInput.addEventListener("keyup", () => {
            selCodeEditorCaptureSelection();
            selCodeEditorRefreshMetrics();
        });
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
            selCodeEditorSavedSelectionStart = 0;
            selCodeEditorSavedSelectionEnd = 0;
            selCodeEditorSavedSelectionValue = selCodeEditorInput.value;
            selCodeEditorRefreshMetrics();
            return true;
        }

        // 业务应用只通过公开 API 读取当前选区，避免依赖 textarea 的内部 DOM 结构。
        function selCodeEditorGetSelectedValue() {
            if (selCodeEditorDestroyed) return "";
            const selCodeEditorSelectionStart = Number(selCodeEditorInput.selectionStart || 0);
            const selCodeEditorSelectionEnd = Number(selCodeEditorInput.selectionEnd || 0);
            if (selCodeEditorSelectionEnd > selCodeEditorSelectionStart) {
                return selCodeEditorInput.value.slice(selCodeEditorSelectionStart, selCodeEditorSelectionEnd);
            }
            if (selCodeEditorSavedSelectionValue !== selCodeEditorInput.value
                || selCodeEditorSavedSelectionEnd <= selCodeEditorSavedSelectionStart) return "";
            return selCodeEditorInput.value.slice(selCodeEditorSavedSelectionStart, selCodeEditorSavedSelectionEnd);
        }

        // 业务动作完成后通过公开 API 恢复保存的选区和焦点，继续明确当前执行的是哪段代码。
        function selCodeEditorRestoreSelection() {
            if (selCodeEditorDestroyed
                || selCodeEditorSavedSelectionValue !== selCodeEditorInput.value
                || selCodeEditorSavedSelectionEnd <= selCodeEditorSavedSelectionStart) return false;
            selCodeEditorInput.focus({ preventScroll: true });
            selCodeEditorInput.setSelectionRange(selCodeEditorSavedSelectionStart, selCodeEditorSavedSelectionEnd);
            selCodeEditorRefreshMetrics();
            return true;
        }

        // 追加 API 统一更新内容、光标、行号和 change 事件，业务应用无需接触内部 textarea。
        function selCodeEditorAppendValue(selCodeEditorValue) {
            if (selCodeEditorDestroyed) return false;
            const selCodeEditorAppendText = String(selCodeEditorValue ?? "");
            if (!selCodeEditorAppendText) return false;
            selCodeEditorInput.value += selCodeEditorAppendText;
            selCodeEditorSavedSelectionStart = selCodeEditorInput.value.length;
            selCodeEditorSavedSelectionEnd = selCodeEditorInput.value.length;
            selCodeEditorSavedSelectionValue = selCodeEditorInput.value;
            selCodeEditorInput.setSelectionRange(selCodeEditorInput.value.length, selCodeEditorInput.value.length);
            selCodeEditorRefreshMetrics();
            selCodeEditorRoot.dispatchEvent(new CustomEvent("selCodeEditor:change", {
                bubbles: true,
                detail: selFreeze({ editorId: selCodeEditorId, language: selCodeEditorLanguage, value: selCodeEditorInput.value })
            }));
            selCodeEditorInput.focus();
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

        const selCodeEditorController = {
            id: selCodeEditorId,
            root: selCodeEditorRoot,
            input: selCodeEditorInput,
            focus: () => selCodeEditorInput.focus(),
            getValue: () => selCodeEditorInput.value,
            getSelectedValue: selCodeEditorGetSelectedValue,
            restoreSelection: selCodeEditorRestoreSelection,
            setValue: selCodeEditorSetValue,
            appendValue: selCodeEditorAppendValue,
            setLoading: selCodeEditorSetLoading,
            isLoading: () => selCodeEditorLoading,
            setFeedback: selCodeEditorSetFeedback,
            action: selCodeEditorDispatchAction,
            getState: () => selFreeze({ language: selCodeEditorLanguage, loading: selCodeEditorLoading, value: selCodeEditorInput.value }),
            destroy: selCodeEditorDestroy
        };
        selCodeEditorInstances.set(selCodeEditorId, selCodeEditorController);
        selCodeEditorRoot.dataset.selCodeEditorReady = "true";
        selCodeEditorRefreshMetrics();
        return selCodeEditorController;
    }

    window.sel.register("components.codeEditor", {
        mount: selCodeEditorMount,
        get: (selCodeEditorId) => selCodeEditorInstances.get(String(selCodeEditorId)) || null,
        has: (selCodeEditorId) => selCodeEditorInstances.has(String(selCodeEditorId)),
        list: () => selFreeze(Array.from(selCodeEditorInstances.keys()))
    });
})();
