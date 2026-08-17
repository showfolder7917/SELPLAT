/*
 * selTableEditor.js：公共表格列配置编辑器。
 * 组件只管理可见表头草稿与 Window 生命周期；数据库接口、权限和业务刷新由调用方回调负责。
 */
(function selTableEditorInitializeRegistry() {
    "use strict";

    window.sel.require(["core.element", "components.grid", "components.window"]);
    const { element } = window.sel.core;
    const selGrid = window.sel.components.grid;
    const selWindow = window.sel.components.window;
    const selTableEditorInstances = new Map();

    function selTableEditorText(messages, key, fallback) {
        return String(messages?.[key] || fallback);
    }

    function selTableEditorInput(name, label, value = "", type = "text") {
        const field = element("label", { className: "seltableeditor-field" });
        field.appendChild(element("span", { text: label }));
        const input = element("input", { className: "seltableeditor-input", attributes: { name, type } });
        input.value = String(value ?? "");
        field.appendChild(input);
        return field;
    }

    function selTableEditorCreateInstance(host, options = {}) {
        const id = String(options.id || "");
        if (!host || !id || typeof options.load !== "function") return null;
        if (selTableEditorInstances.has(id)) return selTableEditorInstances.get(id);

        let localeOptions = options;
        let messages = localeOptions.messages || {};
        let records = [];
        let editingRecord = null;
        let busy = false;
        let tableGridController = null;
        const tableGridId = id.replace(/Id$/, "GridId");

        const root = element("section", { className: "seltableeditor-root" });
        const toolbar = element("div", { className: "seltableeditor-toolbar" });
        const summary = element("span", { className: "seltableeditor-summary" });
        const addButton = element("button", { className: "seltableeditor-primary", attributes: { type: "button" } });
        addButton.append(element("i", { className: "ri-add-line", attributes: { "aria-hidden": "true" } }), element("span"));
        toolbar.append(summary, addButton);

        const tableShell = element("div", { className: "seltableeditor-grid-host" });
        const tableGridRoot = selGrid.create(tableShell, {
            gridId: tableGridId,
            entity: "tableElement",
            ariaLabel: options.ariaLabel || "表格列配置"
        });
        if (!tableGridRoot) return null;
        const feedback = element("div", { className: "seltableeditor-feedback", attributes: { role: "status", "aria-live": "polite" } });

        const editor = element("form", { className: "seltableeditor-editor" });
        editor.hidden = true;
        const editorTitle = element("strong", { className: "seltableeditor-editor-title" });
        const fields = element("div", { className: "seltableeditor-fields" });
        const fieldName = selTableEditorInput("fieldName", "字段 Code");
        const labelZh = selTableEditorInput("labelZh", "中文名称");
        const labelJa = selTableEditorInput("labelJa", "日文名称");
        const labelEn = selTableEditorInput("labelEn", "英文名称");
        const width = selTableEditorInput("width", "宽度", "auto");
        const sortnum = selTableEditorInput("sortnum", "排序", "0", "number");
        const rendererField = element("label", { className: "seltableeditor-field" });
        rendererField.appendChild(element("span", { text: "渲染方式" }));
        const renderer = element("select", { className: "seltableeditor-input", attributes: { name: "cellRenderer" } });
        ["text", "stack", "badge", "time", "boolean", "switch", "choice", "actions"].forEach((value) => {
            renderer.appendChild(element("option", { text: value, attributes: { value } }));
        });
        rendererField.appendChild(renderer);
        fields.append(fieldName, labelZh, labelJa, labelEn, width, sortnum, rendererField);
        const editorActions = element("div", { className: "seltableeditor-editor-actions" });
        const cancelButton = element("button", { text: "取消", className: "seltableeditor-secondary", attributes: { type: "button" } });
        const saveButton = element("button", { text: "保存表头", className: "seltableeditor-primary", attributes: { type: "submit" } });
        editorActions.append(cancelButton, saveButton);
        editor.append(editorTitle, fields, editorActions);
        root.append(toolbar, tableShell, editor, feedback);

        const windowController = selWindow.mount(host, {
            id,
            title: options.title || "编辑表格",
            subtitle: options.subtitle || "新增、修改、隐藏或删除当前表格头",
            closeLabel: options.closeLabel || "关闭表格编辑窗口",
            content: root,
            showActions: false,
            messages: options.windowMessages || {}
        });
        if (!windowController) return null;

        function setBusy(nextBusy) {
            busy = Boolean(nextBusy);
            root.querySelectorAll("button,input,select").forEach((control) => { control.disabled = busy; });
            root.classList.toggle("seltableeditor-busy", busy);
        }

        function applyMessages() {
            addButton.querySelector("span").textContent = selTableEditorText(messages, "add", "新增表头");
            addButton.setAttribute("aria-label", selTableEditorText(messages, "add", "新增表头"));
            summary.textContent = selTableEditorText(messages, "summary", "共 {count} 个表头").replace("{count}", String(records.length));
            editorTitle.textContent = editingRecord
                ? selTableEditorText(messages, "editTitle", "修改表头")
                : selTableEditorText(messages, "createTitle", "新增表头");
            saveButton.textContent = selTableEditorText(messages, "save", "保存表头");
            cancelButton.textContent = selTableEditorText(messages, "cancel", "取消");
            fieldName.querySelector("span").textContent = selTableEditorText(messages, "field", "字段 Code");
            labelZh.querySelector("span").textContent = selTableEditorText(messages, "labelZh", "中文名称");
            labelJa.querySelector("span").textContent = selTableEditorText(messages, "labelJa", "日文名称");
            labelEn.querySelector("span").textContent = selTableEditorText(messages, "labelEn", "英文名称");
            width.querySelector("span").textContent = selTableEditorText(messages, "width", "宽度");
            sortnum.querySelector("span").textContent = selTableEditorText(messages, "sort", "排序");
            rendererField.querySelector("span").textContent = selTableEditorText(messages, "renderer", "渲染方式");
        }

        /**
         * 判断一条表头配置是否处于显示状态。
         * 真实传参示例：visible 为 true、1 或字符串 true 的表头记录。
         * 真实返回示例：显示记录返回 true，隐藏记录返回 false。
         * 异常或副作用示例：空记录安全返回 false，不修改原始记录。
         */
        function isRecordVisible(record) {
            if (!record) return false;
            return record.visible !== false
                && record.visible !== 0
                && String(record.visible).toLocaleLowerCase() !== "false";
        }

        /**
         * 把当前表头记录转换为公共 selGrid 的 records 聚合数据。
         * 真实传参示例：records 包含 fieldName、labelZh、cellRenderer、width 和 visible。
         * 真实返回示例：返回六列、无选择模式、当前页展示全部表头的标准 Grid payload。
         * 异常或副作用示例：records 为空时返回空数据和安全分页，不请求接口。
         */
        function buildGridPayload() {
            const displayRecords = records.map((record) => ({
                ...record,
                tableEditorLabel: record.labelZh || record.labelJa || record.labelEn || "—",
                visible: isRecordVisible(record)
            }));
            const pageSize = Math.max(1, displayRecords.length);
            return {
                grid: {
                    mode: "records",
                    selectionMode: "NONE",
                    idField: "id",
                    searchFields: [],
                    rowReorder: typeof options.reorder === "function",
                    columnResize: false,
                    horizontalScroll: true,
                    tooltip: true
                },
                data: { items: displayRecords, selectedIds: [] },
                column: {
                    gridId: tableGridId,
                    tableTitle: "",
                    tableCode: "",
                    ariaLabel: options.ariaLabel || selTableEditorText(messages, "gridAria", "表格列配置"),
                    emptyText: selTableEditorText(messages, "empty", "当前表格尚未登记表头"),
                    items: [
                        ...(typeof options.reorder === "function" ? [{
                            id: "rowOrder",
                            field: "id",
                            label: selTableEditorText(messages, "order", "排序"),
                            renderer: "dragHandle",
                            icon: "ri-draggable",
                            width: "64px",
                            dragLabel: (record) => `${selTableEditorText(messages, "move", "拖拽调整顺序")}：${record.tableEditorLabel || record.fieldName}`
                        }] : []),
                        { id: "fieldName", field: "fieldName", label: selTableEditorText(messages, "field", "字段 Code"), renderer: "text", nowrap: true, width: "220px" },
                        { id: "tableEditorLabel", field: "tableEditorLabel", label: selTableEditorText(messages, "label", "表头名称"), renderer: "text", nowrap: true, width: "180px" },
                        { id: "cellRenderer", field: "cellRenderer", label: selTableEditorText(messages, "renderer", "渲染"), renderer: "text", nowrap: true, width: "120px" },
                        { id: "width", field: "width", label: selTableEditorText(messages, "width", "宽度"), renderer: "text", nowrap: true, width: "110px" },
                        {
                            id: "visible",
                            field: "visible",
                            label: selTableEditorText(messages, "visible", "显示"),
                            renderer: "switch",
                            action: "toggleVisible",
                            width: "92px",
                            switchLabel: (record) => `${record.tableEditorLabel || record.fieldName}${selTableEditorText(messages, "visibleSuffix", "是否显示")}`
                        },
                        {
                            id: "actions",
                            field: "id",
                            label: selTableEditorText(messages, "actions", "操作"),
                            renderer: "actions",
                            width: "110px",
                            actions: [
                                { id: "edit", label: selTableEditorText(messages, "edit", "修改表头"), icon: "ri-edit-line" },
                                { id: "delete", label: selTableEditorText(messages, "delete", "删除表头"), icon: "ri-delete-bin-6-line", tone: "danger" }
                            ]
                        }
                    ]
                },
                title: { messages: {} },
                select: { pageSize: { options: [{ value: String(pageSize), label: String(pageSize) }] } },
                pagination: {
                    currentPage: 1,
                    pageSize,
                    totalCount: displayRecords.length,
                    summaryAll: "共 {total} 条",
                    summaryFiltered: "当前 {visible} 条 · 共 {total} 条",
                    previousLabel: "上一页",
                    nextLabel: "下一页",
                    pageChangedMessage: "已切换到第 {page} 页",
                    pageSizeChangedMessage: "每页显示 {size} 条"
                }
            };
        }

        function openEditor(record = null) {
            editingRecord = record ? { ...record } : null;
            const values = editingRecord || { fieldName: "", labelZh: "", labelJa: "", labelEn: "", width: "auto", sortnum: records.length * 10 + 10, cellRenderer: "text" };
            ["fieldName", "labelZh", "labelJa", "labelEn", "width", "sortnum", "cellRenderer"].forEach((name) => {
                const input = editor.elements.namedItem(name);
                if (input) input.value = String(values[name] ?? "");
            });
            editor.elements.namedItem("fieldName").readOnly = Boolean(editingRecord?.id);
            editor.hidden = false;
            applyMessages();
            editor.elements.namedItem(editingRecord ? "labelZh" : "fieldName")?.focus();
        }

        function closeEditor() {
            editingRecord = null;
            editor.hidden = true;
        }

        async function reload() {
            setBusy(true);
            try {
                const loaded = await options.load();
                records = Array.isArray(loaded) ? loaded.slice() : [];
                records.sort((left, right) => Number(left.sortnum || 0) - Number(right.sortnum || 0));
                render();
                return records;
            } finally {
                setBusy(false);
            }
        }

        async function runMutation(callback) {
            if (typeof callback !== "function") return false;
            setBusy(true);
            feedback.textContent = "";
            feedback.classList.remove("seltableeditor-feedback-error");
            try {
                const changed = await callback();
                if (changed === false) return false;
                await reload();
                await options.onChange?.(records.slice());
                feedback.textContent = selTableEditorText(messages, "saved", "表头配置已保存。");
                return true;
            } catch (error) {
                feedback.textContent = error?.message || selTableEditorText(messages, "saveFailed", "表头配置保存失败。");
                feedback.classList.add("seltableeditor-feedback-error");
                return false;
            } finally {
                setBusy(false);
            }
        }

        /**
         * 乐观显示拖拽后的表头草稿，确认后才通过调用方一次保存全部 sortnum。
         * 真实传参示例：把 questionText 拖到 sourceQuestionNo 前得到对应记录顺序数组。
         * 真实返回示例：确认并保存成功后返回 true，再按 10、20、30 重新加载数据库顺序。
         * 异常或副作用示例：取消确认或保存失败时恢复拖拽前顺序，不保留半完成排序。
         */
        async function reorderRecords(nextRecords) {
            if (typeof options.reorder !== "function") return false;
            const previousRecords = records.slice();
            records = nextRecords.map((record, index) => ({ ...record, sortnum: (index + 1) * 10 }));
            render();
            setBusy(true);
            feedback.textContent = "";
            feedback.classList.remove("seltableeditor-feedback-error");
            try {
                if (typeof options.confirmReorder === "function"
                        && !(await options.confirmReorder(records.slice(), previousRecords.slice()))) {
                    records = previousRecords;
                    render();
                    feedback.textContent = selTableEditorText(messages, "reorderCancelled", "已取消表头排序。");
                    return false;
                }
                const saved = await options.reorder(records.map((record) => ({
                    id: record.id,
                    code: record.code,
                    sortnum: record.sortnum
                })));
                if (saved === false) throw new Error(selTableEditorText(messages, "reorderFailed", "表头顺序保存失败。"));
                await reload();
                await options.onChange?.(records.slice());
                feedback.textContent = selTableEditorText(messages, "reordered", "表头顺序已保存。"
                );
                return true;
            } catch (error) {
                records = previousRecords;
                render();
                feedback.textContent = error?.message || selTableEditorText(messages, "reorderFailed", "表头顺序保存失败。");
                feedback.classList.add("seltableeditor-feedback-error");
                return false;
            } finally {
                setBusy(false);
            }
        }

        function render() {
            applyMessages();
            const gridPayload = buildGridPayload();
            if (tableGridController) {
                tableGridController.setLocale(gridPayload);
            } else {
                tableGridController = selGrid.mount(tableGridRoot, gridPayload);
            }
            tableGridController?.pagination.setPageSize(gridPayload.pagination.pageSize);
        }

        tableGridRoot.addEventListener("selGrid:action", (event) => {
            if (event.detail?.instanceKey !== tableGridId) return;
            const record = event.detail.record;
            if (event.detail.action === "toggleVisible") {
                runMutation(() => options.update?.({ id: record.id, visible: !isRecordVisible(record) }));
                return;
            }
            if (event.detail.action === "edit") {
                openEditor(record);
                return;
            }
            if (event.detail.action === "delete") {
                runMutation(async () => {
                    if (typeof options.confirmRemove === "function" && !(await options.confirmRemove(record))) return false;
                    return options.remove?.(record);
                });
            }
        });

        tableGridRoot.addEventListener("selGrid:rowReorder", (event) => {
            if (event.detail?.instanceKey !== tableGridId || !Array.isArray(event.detail.records)) return;
            reorderRecords(event.detail.records);
        });

        addButton.addEventListener("click", () => openEditor());
        cancelButton.addEventListener("click", closeEditor);
        editor.addEventListener("submit", async (event) => {
            event.preventDefault();
            const values = Object.fromEntries(new FormData(editor).entries());
            values.sortnum = Number(values.sortnum || 0);
            const saved = await runMutation(() => editingRecord
                ? options.update?.({ ...values, id: editingRecord.id })
                : options.create?.(values));
            if (saved) closeEditor();
        });

        const controller = {
            async open() {
                windowController.open();
                feedback.textContent = "";
                try { await reload(); } catch (error) {
                    feedback.textContent = error?.message || selTableEditorText(messages, "loadFailed", "表头读取失败。");
                    feedback.classList.add("seltableeditor-feedback-error");
                }
            },
            close: () => windowController.close(),
            reload,
            setLocale(next = {}) { localeOptions = { ...localeOptions, ...next }; messages = localeOptions.messages || {}; render(); }
        };
        selTableEditorInstances.set(id, controller);
        render();
        return controller;
    }

    window.sel.register("components.tableEditor", {
        mount: selTableEditorCreateInstance,
        attachTrigger(host, controller, options = {}) {
            if (!host || !controller?.open) return null;
            const button = element("button", {
                className: "seltableeditor-open-button",
                attributes: { type: "button", "aria-label": options.label || "编辑表格" }
            });
            button.append(
                element("i", { className: options.icon || "ri-table-line", attributes: { "aria-hidden": "true" } }),
                element("span", { text: options.label || "编辑表格" })
            );
            button.addEventListener("click", () => controller.open());
            host.appendChild(button);
            return button;
        },
        get: (id) => selTableEditorInstances.get(String(id || "")) || null
    });
}());
