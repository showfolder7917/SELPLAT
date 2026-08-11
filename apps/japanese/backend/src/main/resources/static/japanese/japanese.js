/* Japanese N2 蓝宝书题库：只装配 SEL 公共控件、真实接口和 AI/语音业务动作。 */
(function japaneseN2BlueBookInitializeApplication() {
    "use strict";

    const requiredComponents = Object.freeze([
        "selBaseRuntime", "selPanel", "selSearch", "selTooltip", "selTree", "selDropdownMenu", "selGrid",
        "selWindow", "selConfirmDialog", "selPageBackground", "selPersonalization", "selThemeManager"
    ]);
    const missingComponents = requiredComponents.filter((name) => !window[name]);
    if (missingComponents.length > 0) throw new Error(`日语题库缺少公共组件：${missingComponents.join("、")}。`);

    const applicationHost = window.selBaseRuntime.query("[data-japanese-app]");
    const backgroundHost = window.selBaseRuntime.query("[data-sel-page-background-host]");
    const personalizationHost = window.selBaseRuntime.query("[data-sel-personalization-host]");
    const questionApi = "/api/japanese/n2-blue-book-question/";
    const gridId = "JapaneseN2BlueBookQuestionGrid";
    const editorId = "JapaneseN2BlueBookQuestionEditor";
    const typeLabels = Object.freeze({
        PRONUNCIATION: "语音・读音题",
        KANJI: "汉字题",
        GRAMMAR: "语法题"
    });
    const state = {
        records: [],
        treeItems: [],
        editingRecord: null,
        gridController: null,
        editorController: null,
        deleteController: null,
        generationView: null
    };

    const layout = Object.freeze({
        top: Object.freeze([
            Object.freeze({ component: "title", payload: "title" }),
            Object.freeze({
                component: "toolbar",
                children: Object.freeze([
                    Object.freeze({ component: "selSearch", payload: "search" }),
                    Object.freeze({ component: "filterReset", payload: "title" })
                ])
            })
        ]),
        left: Object.freeze([Object.freeze({ component: "selTree", payload: "tree" })]),
        center: Object.freeze([Object.freeze({ component: "selGrid", payload: "$aggregate" })]),
        right: Object.freeze([]),
        bottom: Object.freeze([
            Object.freeze({
                component: "footer",
                children: Object.freeze([
                    Object.freeze({
                        component: "gridSummary",
                        payload: "pagination",
                        children: Object.freeze([
                            Object.freeze({ component: "selDropdownMenu", slot: "pageSize", payload: "select.pageSize" })
                        ])
                    }),
                    Object.freeze({ component: "pagination", payload: "pagination" }),
                    Object.freeze({ component: "feedback", payload: "title.messages" })
                ])
            })
        ])
    });

    async function request(url, options = {}) {
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok || data.success === false) throw new Error(data.msg || "请求失败。");
        return data;
    }

    async function loadRecords() {
        const data = await request(`${questionApi}getStore.htm?pageNo=1&pageSize=1000`);
        return Array.isArray(data.records) ? data.records : [];
    }

    function loadTreeItems() {
        return [{
            id: "n2-blue-book-question-root",
            label: "N2 蓝宝书1000题",
            value: "ALL",
            children: Object.entries(typeLabels).map(([value, label]) => ({
                id: `n2-${value.toLowerCase()}`,
                label,
                value
            }))
        }];
    }

    function countByType(type) {
        return state.records.filter((record) => record.questionType === type).length;
    }

    function normalizeTreeItems(items) {
        return items.map((item) => {
            const value = String(item.value || "ALL");
            const normalized = {
                id: String(item.id || value.toLowerCase()),
                label: String(item.label || typeLabels[value] || "全部题目"),
                icon: value === "ALL" ? "ri-book-open-line" : value === "PRONUNCIATION" ? "ri-volume-up-line" : value === "KANJI" ? "ri-font-size-2" : "ri-braces-line",
                count: value === "ALL" ? state.records.length : countByType(value),
                filter: value === "ALL" ? Object.freeze({}) : Object.freeze({ questionType: value })
            };
            if (Array.isArray(item.children) && item.children.length > 0) normalized.children = normalizeTreeItems(item.children);
            return Object.freeze(normalized);
        });
    }

    function buildPayload() {
        const displayRecords = state.records.map((record) => Object.freeze({
            ...record,
            questionTypeLabel: typeLabels[record.questionType] || record.questionType,
            imageState: record.imageUrl ? "已生成" : "—",
            audioState: record.audioUrl ? "已生成" : "—"
        }));
        const treeItems = normalizeTreeItems(state.treeItems);
        return Object.freeze({
            grid: Object.freeze({
                mode: "records",
                idField: "id",
                searchFields: Object.freeze(["sourceQuestionNo", "questionText", "correctOption", "optionA", "optionB", "optionC", "optionD"]),
                horizontalScroll: true
            }),
            data: Object.freeze({ items: Object.freeze(displayRecords), selectedIds: Object.freeze([]) }),
            column: Object.freeze({
                gridId,
                ariaLabel: "N2 蓝宝书题目表格",
                emptyText: "当前分类还没有题目",
                items: Object.freeze([
                    Object.freeze({ id: "sourceQuestionNo", field: "sourceQuestionNo", label: "题号", renderer: "text", nowrap: true, width: "7%" }),
                    Object.freeze({ id: "questionType", field: "questionTypeLabel", label: "题型", renderer: "text", nowrap: true, width: "13%" }),
                    Object.freeze({ id: "questionText", field: "questionText", label: "题干", renderer: "text", width: "31%" }),
                    Object.freeze({ id: "correctOption", field: "correctOption", label: "答案", renderer: "badge", width: "7%" }),
                    Object.freeze({ id: "imageState", field: "imageState", label: "图片", renderer: "text", nowrap: true, width: "8%" }),
                    Object.freeze({ id: "audioState", field: "audioState", label: "语音", renderer: "text", nowrap: true, width: "8%" }),
                    Object.freeze({ id: "updatedAt", field: "updatedAt", label: "更新时间", renderer: "time", nowrap: true, width: "16%" }),
                    Object.freeze({
                        id: "actions", field: "id", label: "操作", renderer: "actions", width: "10%",
                        actions: Object.freeze([
                            Object.freeze({ id: "edit", label: "编辑题目", icon: "ri-edit-line" }),
                            Object.freeze({ id: "delete", label: "删除题目", icon: "ri-delete-bin-6-line", tone: "danger" })
                        ])
                    })
                ])
            }),
            title: Object.freeze({
                title: "N2 蓝宝书1000题",
                subtitle: "JLPT N2 · BLUE BOOK",
                description: "语音・读音、汉字、语法题统一管理；双击题目进入练习内容编辑",
                ariaLabel: "N2 蓝宝书1000题管理面板",
                ariaLabels: Object.freeze({
                    statusTabs: "题型统计", headerActions: "题库快捷操作", toolbar: "题库筛选工具栏",
                    sidebar: "题型目录", content: "题目列表内容区", board: "N2 题目表格", pagination: "题目分页"
                }),
                statusTabs: Object.freeze([
                    Object.freeze({ value: "", label: "全部", count: state.records.length }),
                    Object.freeze({ value: "PRONUNCIATION", label: "读音", count: countByType("PRONUNCIATION") }),
                    Object.freeze({ value: "KANJI", label: "汉字", count: countByType("KANJI") }),
                    Object.freeze({ value: "GRAMMAR", label: "语法", count: countByType("GRAMMAR") })
                ]),
                actions: Object.freeze([
                    Object.freeze({ id: "filter", label: "搜索", icon: "ri-search-line" }),
                    Object.freeze({ id: "new", label: "新增题目", icon: "ri-add-line", primary: true })
                ]),
                resetLabel: "重置",
                messages: Object.freeze({
                    selectProject: "选择题目", viewProject: "查看题目", editProject: "编辑题目", moreActions: "更多操作",
                    filtersReset: "筛选条件已重置", treePrefix: "题型目录", expandLeftRegion: "展开题型目录",
                    collapseLeftRegion: "收起题型目录", filterActivated: "搜索框已激活", newOpened: "已打开新增题目窗口",
                    exportPreparing: "题库操作已触发", movePrefix: "移动到"
                })
            }),
            search: Object.freeze({
                gridId,
                label: "搜索题目",
                placeholder: "题号、题干或答案…",
                buttonLabel: "查询",
                clearLabel: "清空搜索条件",
                icon: "ri-search-line",
                buttonIcon: "ri-search-line",
                clearIcon: "ri-close-line",
                defaultValue: "",
                clearable: true,
                submitOnEnter: true,
                submitOnClear: true,
                allowEmpty: true,
                trim: true
            }),
            tree: Object.freeze({
                gridId,
                ariaLabel: "N2 题型目录",
                heading: "题库目录",
                summary: `${state.records.length} 道题`,
                expandLabelTemplate: "展开{label}",
                collapseLabelTemplate: "收起{label}",
                selectedId: treeItems[0]?.id || "all",
                items: Object.freeze(treeItems)
            }),
            menu: Object.freeze({ gridId, ariaLabel: "题目行操作" }),
            pagination: Object.freeze({
                gridId,
                currentPage: 1,
                pageSize: 20,
                totalCount: state.records.length,
                summaryAll: "共 {total} 题",
                summaryFiltered: "当前 {visible} 题 · 共 {total} 题",
                previousLabel: "上一页",
                nextLabel: "下一页",
                pageChangedMessage: "已切换到第 {page} 页",
                pageSizeChangedMessage: "每页显示 {size} 道题"
            }),
            select: Object.freeze({
                pageSize: Object.freeze({
                    gridId,
                    role: "page-size",
                    label: "每页显示题数",
                    ariaLabel: "每页显示题数",
                    currentTemplate: "{label}，当前：{value}",
                    menuTitle: "选择每页显示题数",
                    scrollAfter: 4,
                    options: Object.freeze([
                        Object.freeze({ value: "10", label: "10 题/页", icon: "ri-list-check-3" }),
                        Object.freeze({ value: "20", label: "20 题/页", icon: "ri-list-check-3", selected: true }),
                        Object.freeze({ value: "50", label: "50 题/页", icon: "ri-list-check-3" })
                    ])
                })
            })
        });
    }

    function editorOptions(editing) {
        const typeOptions = Object.entries(typeLabels).map(([value, label]) => Object.freeze({ value, label, icon: "ri-book-2-line" }));
        const answerOptions = ["A", "B", "C", "D"].map((value) => Object.freeze({ value, label: `选项 ${value}`, icon: "ri-checkbox-circle-line" }));
        return Object.freeze({
            id: editorId,
            title: editing ? "编辑 N2 题目" : "新增 N2 题目",
            subtitle: "题目、选项、解释与媒体资源在同一窗口维护",
            closeLabel: "关闭题目编辑窗口",
            cancelLabel: "取消",
            submitLabel: editing ? "保存修改" : "保存题目",
            validationMessage: "请完成全部必填字段",
            autoSuccess: false,
            rows: Object.freeze([
                Object.freeze([
                    Object.freeze({ name: "sourceQuestionNo", label: "来源题号", type: "number", icon: "ri-hashtag", placeholder: "例如 416", required: true }),
                    Object.freeze({ name: "questionType", label: "题型", type: "select", required: true, options: Object.freeze(typeOptions) })
                ]),
                Object.freeze([Object.freeze({ name: "name", label: "显示名称", type: "text", icon: "ri-text", placeholder: "留空时自动按题号生成", maxLength: 200 })]),
                Object.freeze([Object.freeze({ name: "questionText", label: "题干", type: "textarea", icon: "ri-question-line", placeholder: "今年の大学新卒者の平均給与は去年よりやや低い。", required: true, maxLength: 4000 })]),
                Object.freeze([
                    Object.freeze({ name: "optionA", label: "选项 A", type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 }),
                    Object.freeze({ name: "optionB", label: "选项 B", type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 })
                ]),
                Object.freeze([
                    Object.freeze({ name: "optionC", label: "选项 C", type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 }),
                    Object.freeze({ name: "optionD", label: "选项 D", type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 })
                ]),
                Object.freeze([Object.freeze({ name: "correctOption", label: "正确答案", type: "select", required: true, options: Object.freeze(answerOptions) })]),
                Object.freeze([Object.freeze({ name: "audioText", label: "朗读文本", type: "textarea", icon: "ri-volume-up-line", placeholder: "为空时朗读题干", maxLength: 4000 })]),
                Object.freeze([Object.freeze({ name: "explanation", label: "题目解释", type: "textarea", icon: "ri-lightbulb-line", placeholder: "可调用本机 Codex CLI 生成后再人工修订", maxLength: 8000 })])
            ])
        });
    }

    function installGenerationControls() {
        const shell = applicationHost.querySelector(`[data-sel-window-id="${editorId}"]`);
        const fields = shell?.querySelector(".selwindow-form-fields");
        const feedback = fields?.querySelector(".selwindow-feedback");
        if (!fields || !feedback) throw new Error("题目窗口未提供标准字段区。");

        const section = document.createElement("section");
        section.className = "japanese-generation-panel";
        section.setAttribute("aria-label", "AI 与语音生成");
        section.innerHTML = `
            <header><div><strong>Codex &amp; Voice</strong><span>点击后直接生成，不弹出二次确认</span></div><small>媒体路径已预留云存储切换</small></header>
            <div class="japanese-generation-actions">
                <button type="button" data-generate="explanation"><i class="ri-lightbulb-flash-line" aria-hidden="true"></i><span><strong>生成解释</strong><small>本机 Codex CLI</small></span></button>
                <button type="button" data-generate="image"><i class="ri-image-ai-line" aria-hidden="true"></i><span><strong>生成图片</strong><small>Codex → WebP</small></span></button>
                <button type="button" data-generate="audio"><i class="ri-volume-up-line" aria-hidden="true"></i><span><strong>生成语音</strong><small>NanamiNeural · MP3</small></span></button>
            </div>
            <div class="japanese-generation-previews">
                <figure data-image-preview><figcaption>图片预览 · static/pic</figcaption><img alt="当前题目 AI 插图" hidden><p>尚未生成图片</p></figure>
                <figure data-audio-preview><figcaption>语音预览 · static/audio</figcaption><audio controls hidden></audio><p>尚未生成语音</p></figure>
            </div>`;
        fields.insertBefore(section, feedback);
        section.querySelectorAll("[data-generate]").forEach((button) => {
            button.addEventListener("click", () => generate(button.dataset.generate, button));
        });
        state.generationView = section;
    }

    function editorDefaults() {
        return {
            questionType: "PRONUNCIATION",
            correctOption: "A",
            sourceQuestionNo: "",
            name: "",
            questionText: "",
            optionA: "",
            optionB: "",
            optionC: "",
            optionD: "",
            audioText: "",
            explanation: ""
        };
    }

    function openEditor(record = null) {
        state.editingRecord = record ? { ...record } : null;
        state.editorController.setLocale(editorOptions(Boolean(record)));
        state.editorController.reset();
        state.editorController.setValues({ ...editorDefaults(), ...(record || {}) });
        state.editorController.setFeedback("");
        refreshPreviews();
        state.editorController.open();
    }

    async function saveQuestion(values) {
        state.editorController.setLoading(true);
        state.editorController.setFeedback("正在保存题目…");
        try {
            const editing = Boolean(state.editingRecord?.id);
            const media = state.editingRecord || {};
            const payload = {
                ...values,
                ...(editing ? { id: state.editingRecord.id } : {}),
                name: String(values.name || "").trim() || `蓝宝书 N2 第${values.sourceQuestionNo}题`,
                tenantId: 1,
                lastOperateUserId: 1,
                sortnum: media.sortnum || 0,
                status: media.status || 1,
                jlptLevel: "N2",
                sourceBook: "蓝宝书1000题",
                imageStorageProvider: media.imageStorageProvider || "",
                imageStorageKey: media.imageStorageKey || "",
                imageUrl: media.imageUrl || "",
                audioStorageProvider: media.audioStorageProvider || "",
                audioStorageKey: media.audioStorageKey || "",
                audioUrl: media.audioUrl || ""
            };
            await request(questionApi + (editing ? "update.htm" : "create.htm"), {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                body: new URLSearchParams(payload)
            });
            state.editorController.close();
            await refreshApplication();
        } catch (error) {
            state.editorController.setFeedback(error.message || "题目保存失败。", true);
        } finally {
            state.editorController.setLoading(false);
        }
    }

    async function removeQuestion(record) {
        const confirmed = await state.deleteController.open({
            title: "删除题目",
            message: "删除后题目将不再出现在题库列表中。",
            target: `第 ${record.sourceQuestionNo} 题 · ${String(record.questionText || "").slice(0, 36)}`,
            tone: "danger",
            icon: "ri-delete-bin-6-line",
            cancelLabel: "保留题目",
            confirmLabel: "确认删除"
        });
        if (!confirmed) return;
        await request(`${questionApi}delete.htm`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: new URLSearchParams({ id: record.id, lastOperateUserId: 1 })
        });
        await refreshApplication();
    }

    function generationPayload() {
        const values = state.editorController.getValues();
        return {
            questionType: values.questionType,
            questionText: values.questionText,
            optionA: values.optionA,
            optionB: values.optionB,
            optionC: values.optionC,
            optionD: values.optionD,
            correctOption: values.correctOption,
            audioText: values.audioText
        };
    }

    async function generate(kind, activeButton) {
        const labels = { explanation: "解释", image: "图片", audio: "语音" };
        setGenerating(true, activeButton);
        state.editorController.setFeedback(`正在调用${kind === "audio" ? " NanamiNeural" : "本机 Codex CLI"}生成${labels[kind]}…`);
        try {
            const result = await request(`${questionApi}generate-${kind}.htm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(generationPayload())
            });
            if (kind === "explanation") {
                const nextValues = { ...state.editorController.getValues(), explanation: result.data.explanation };
                state.editorController.setValues(nextValues);
            } else {
                const prefix = kind === "image" ? "image" : "audio";
                state.editingRecord = {
                    ...(state.editingRecord || {}),
                    [`${prefix}StorageProvider`]: result.data.storageProvider,
                    [`${prefix}StorageKey`]: result.data.objectKey,
                    [`${prefix}Url`]: result.data.url
                };
                refreshPreviews();
            }
            state.editorController.setFeedback(result.msg || `${labels[kind]}生成完成。`);
        } catch (error) {
            state.editorController.setFeedback(error.message || `${labels[kind]}生成失败。`, true);
        } finally {
            setGenerating(false, activeButton);
        }
    }

    function setGenerating(busy, activeButton) {
        state.generationView?.querySelectorAll("[data-generate]").forEach((button) => {
            button.disabled = busy;
            button.classList.toggle("is-running", busy && button === activeButton);
        });
    }

    function refreshPreviews() {
        if (!state.generationView) return;
        const imageHost = state.generationView.querySelector("[data-image-preview]");
        const image = imageHost.querySelector("img");
        const imageUrl = state.editingRecord?.imageUrl || "";
        image.hidden = !imageUrl;
        imageHost.querySelector("p").hidden = Boolean(imageUrl);
        if (imageUrl) image.src = `${imageUrl}?v=${Date.now()}`;

        const audioHost = state.generationView.querySelector("[data-audio-preview]");
        const audio = audioHost.querySelector("audio");
        const audioUrl = state.editingRecord?.audioUrl || "";
        audio.hidden = !audioUrl;
        audioHost.querySelector("p").hidden = Boolean(audioUrl);
        if (audioUrl) audio.src = `${audioUrl}?v=${Date.now()}`;
    }

    async function refreshApplication() {
        state.records = await loadRecords();
        state.treeItems = loadTreeItems();
        const payload = buildPayload();
        const panelRoot = window.selPanel.get(gridId);
        window.selPanel.setLocale(panelRoot, { view: payload });
        state.gridController.setLocale(payload);
    }

    async function mountApplication() {
        state.records = await loadRecords();
        state.treeItems = loadTreeItems();
        const payload = buildPayload();
        const panelRoot = window.selPanel.create(applicationHost, {
            gridId,
            sourceId: gridId,
            entity: "JapaneseN2BlueBookQuestion",
            view: "question-bank",
            layout: "single",
            structure: layout,
            ariaLabel: payload.title.ariaLabel
        });
        if (!panelRoot) throw new Error("日语题库公共面板创建失败。");
        if (!window.selPanel.mount(panelRoot, {
            view: payload,
            expandLeftLabel: payload.title.messages.expandLeftRegion,
            collapseLeftLabel: payload.title.messages.collapseLeftRegion
        })) throw new Error("日语题库公共面板挂载失败。");
        if (!window.selSearch.mount(panelRoot, payload.search)) throw new Error("日语题库搜索控件挂载失败。");
        if (!window.selTree.mount(panelRoot, payload.tree)) throw new Error("日语题库导航树挂载失败。");
        window.selDropdownMenu.mountAll(panelRoot);
        state.gridController = window.selGrid.mount(panelRoot, payload);
        if (!state.gridController) throw new Error("日语题库表格挂载失败。");

        const windowMessages = await request("/sel/components/window/i18n/zh-CN.json?v=20260809-japanese-2");
        state.editorController = window.selWindow.mount(applicationHost, { messages: windowMessages, ...editorOptions(false) });
        state.deleteController = window.selConfirmDialog.mount(applicationHost, { id: "JapaneseN2QuestionDeleteConfirm" });
        if (!state.editorController || !state.deleteController) throw new Error("日语题库窗口控件挂载失败。");
        installGenerationControls();

        panelRoot.addEventListener("selGrid:new", () => openEditor());
        panelRoot.addEventListener("selGrid:action", (event) => {
            const detail = event.detail;
            if (!detail || detail.instanceKey !== gridId) return;
            if (detail.action === "edit") openEditor(detail.record);
            if (detail.action === "delete") removeQuestion(detail.record).catch(showApplicationError);
        });
        panelRoot.addEventListener("dblclick", (event) => {
            const row = event.target.closest("tr[data-sel-grid-record-id]");
            if (!row) return;
            const record = state.records.find((item) => String(item.id) === row.dataset.selGridRecordId);
            if (record) openEditor(record);
        });
        applicationHost.addEventListener("selWindow:submit", (event) => {
            if (event.detail?.id === editorId) saveQuestion(event.detail.values);
        });
    }

    function showApplicationError(error) {
        console.error("日语题库操作失败。", error);
        const panelRoot = window.selPanel.get(gridId);
        const feedback = panelRoot?.querySelector("[data-sel-grid-role='feedback']");
        if (feedback) feedback.textContent = error.message || "日语题库操作失败。";
    }

    const backgroundController = window.selPageBackground.mount(backgroundHost, {
        defaults: Object.freeze({ theme: "solid-dark", overlay: 0, brightness: 100, blur: 0 })
    });
    if (!backgroundController) throw new Error("日语题库页面背景挂载失败。");
    if (!window.selPersonalization.mount(personalizationHost, { backgroundController })) {
        throw new Error("日语题库个性化设置挂载失败。");
    }

    mountApplication().catch(showApplicationError);
}());
