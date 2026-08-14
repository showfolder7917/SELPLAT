/*
 * Japanese N2 蓝宝书题库：只装配 SEL UI 公共控件、真实接口和 AI/语音业务动作。
 * panel/search/tree/grid 组成题库工作台，windowComponent 编辑题目，confirmDialog 确认删除，
 * pageBackground 与 personalization 管理页面外观；组件只在文件顶部解构一次。
 *
 * 阅读顺序：japaneseState 保存运行状态，japaneseBuildPayload() 组装公共视图，
 * japaneseBuildEditorOptions() 定义表单，mountApp() 只负责编排挂载和事件。
 * 注释约定与 Reference Data 一致：关键语句组解释业务目的，续行括号和标点不堆积机械注释。
 */
(function app() {
    "use strict";

    window.sel.require([
        "core.element", "core.query", "components.panel", "components.search",
        "components.tree", "components.dropdownMenu", "components.grid", "components.window",
        "components.confirmDialog", "components.pageBackground", "components.personalization"
    ]);
    // core 能力先通过 selBase 统一取得，应用后续不再直接访问 window.sel.core。
    const selBase = window.sel.core;
    // element 创建安全节点，query 查找宿主，selFreeze 只冻结完整配置边界。
    const { element, freeze: selFreeze, query } = selBase;
    const {
        panel, search, tree, dropdownMenu: dropdown, grid, window: windowComponent,
        confirmDialog, pageBackground, personalization
    } = window.sel.components;
    // 三个宿主分别承载业务工作区、背景和个性化设置。
    const japaneseAppHost = query("[data-japanese-app]");
    const japaneseBackgroundHost = query("[data-sel-page-background-host]");
    const japanesePersonalizationHost = query("[data-sel-personalization-host]");
    // CRUD 和生成动作都从统一题库接口根地址派生。
    const japaneseQuestionApi = "/api/japanese/n2-blue-book-question/";
    const japaneseGridId = "JapaneseN2BlueBookQuestionGrid";
    const japaneseEditorId = "JapaneseN2BlueBookQuestionEditor";
    // 数据库题型枚举在应用边界映射为用户可读名称。
    const japaneseTypeLabels = selFreeze({
        PRONUNCIATION: "语音・读音题",
        KANJI: "汉字题",
        GRAMMAR: "语法题"
    });
    // 页面运行状态保持可变，控制器由 mountApp() 写入。
    const japaneseState = {
        records: [],
        treeItems: [],
        editingRecord: null,
        gridController: null,
        editorController: null,
        deleteController: null,
        generationView: null
    };

    // Panel 五区布局只描述组件位置，DOM 生命周期属于公共组件。
    const japaneseLayout = selFreeze({
        top: [
            { component: "title", payload: "title" },
            {
                component: "toolbar",
                children: [
                    { component: "selSearch", payload: "search" },
                    { component: "filterReset", payload: "title" }
                ]
            }
        ],
        left: [{ component: "selTree", payload: "tree" }],
        center: [{ component: "selGrid", payload: "$aggregate" }],
        right: [],
        bottom: [
            {
                component: "footer",
                children: [
                    {
                        component: "gridSummary",
                        payload: "pagination",
                        children: [
                            { component: "selDropdownMenu", slot: "pageSize", payload: "select.pageSize" }
                        ]
                    },
                    { component: "pagination", payload: "pagination" },
                    { component: "feedback", payload: "title.messages" }
                ]
            }
        ]
    });

    /** 读取 JSON 接口并统一处理 HTTP 与业务失败。 */
    async function japaneseRequest(url, options = {}) {
        // fetch 保留端点原始结构，业务 success 与 HTTP 状态必须同时成功。
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok || data.success === false) throw new Error(data.msg || "请求失败。");
        return data;
    }

    /** 读取 N2 题库全部记录。 */
    async function japaneseLoadRecords() {
        const data = await japaneseRequest(`${japaneseQuestionApi}getStore.htm?pageNo=1&pageSize=1000`);
        return Array.isArray(data.records) ? data.records : [];
    }

    /** 生成题库根节点和三类题型树定义。 */
    function japaneseBuildTreeItems() {
        return [{
            id: "n2-blue-book-question-root",
            label: "N2 蓝宝书1000题",
            value: "ALL",
            children: Object.entries(japaneseTypeLabels).map(([value, label]) => ({
                id: `n2-${value.toLowerCase()}`,
                label,
                value
            }))
        }];
    }

    /** 统计某一题型的记录数量。 */
    function japaneseCountByType(type) {
        return japaneseState.records.filter((record) => record.questionType === type).length;
    }

    /** 递归转换公共 Tree 标准节点。 */
    function japaneseNormalizeTreeItems(items) {
        return items.map((item) => {
            const value = String(item.value || "ALL");
            const normalized = {
                id: String(item.id || value.toLowerCase()),
                label: String(item.label || japaneseTypeLabels[value] || "全部题目"),
                icon: value === "ALL" ? "ri-book-open-line" : value === "PRONUNCIATION" ? "ri-volume-up-line" : value === "KANJI" ? "ri-font-size-2" : "ri-braces-line",
                count: value === "ALL" ? japaneseState.records.length : japaneseCountByType(value),
                filter: value === "ALL" ? {} : { questionType: value }
            };
            if (Array.isArray(item.children) && item.children.length > 0) normalized.children = japaneseNormalizeTreeItems(item.children);
            return normalized;
        });
    }

    /** 组装 Panel、Grid、Tree、Search 与分页共用视图。 */
    function japaneseBuildPayload() {
        // 复制后台记录并补充题型、图片和语音展示字段。
        const displayRecords = japaneseState.records.map((record) => ({
            ...record,
            questionTypeLabel: japaneseTypeLabels[record.questionType] || record.questionType,
            imageState: record.imageUrl ? "已生成" : "—",
            audioState: record.audioUrl ? "已生成" : "—"
        }));
        // Tree 数量依赖最新 records，所以每次组装视图都重新规范化。
        const treeItems = japaneseNormalizeTreeItems(japaneseState.treeItems);
        return selFreeze({
            grid: {
                mode: "records",
                idField: "id",
                searchFields: ["sourceQuestionNo", "questionText", "correctOption", "optionA", "optionB", "optionC", "optionD"],
                horizontalScroll: true
            },
            data: { items: displayRecords, selectedIds: [] },
            column: {
                gridId: japaneseGridId,
                ariaLabel: "N2 蓝宝书题目表格",
                emptyText: "当前分类还没有题目",
                items: [
                    { id: "sourceQuestionNo", field: "sourceQuestionNo", label: "题号", renderer: "text", nowrap: true, width: "7%" },
                    { id: "questionType", field: "questionTypeLabel", label: "题型", renderer: "text", nowrap: true, width: "13%" },
                    { id: "questionText", field: "questionText", label: "题干", renderer: "text", width: "31%" },
                    { id: "correctOption", field: "correctOption", label: "答案", renderer: "badge", width: "7%" },
                    { id: "imageState", field: "imageState", label: "图片", renderer: "text", nowrap: true, width: "8%" },
                    { id: "audioState", field: "audioState", label: "语音", renderer: "text", nowrap: true, width: "8%" },
                    { id: "updatedAt", field: "updatedAt", label: "更新时间", renderer: "time", nowrap: true, width: "16%" },
                    {
                        id: "actions", field: "id", label: "操作", renderer: "actions", width: "10%",
                        actions: [
                            { id: "edit", label: "编辑题目", icon: "ri-edit-line" },
                            { id: "delete", label: "删除题目", icon: "ri-delete-bin-6-line", tone: "danger" }
                        ]
                    }
                ]
            },
            title: {
                title: "N2 蓝宝书1000题",
                subtitle: "JLPT N2 · BLUE BOOK",
                description: "语音・读音、汉字、语法题统一管理；双击题目进入练习内容编辑",
                ariaLabel: "N2 蓝宝书1000题管理面板",
                ariaLabels: {
                    statusTabs: "题型统计", headerActions: "题库快捷操作", toolbar: "题库筛选工具栏",
                    sidebar: "题型目录", content: "题目列表内容区", board: "N2 题目表格", pagination: "题目分页"
                },
                statusTabs: [
                    { value: "", label: "全部", count: japaneseState.records.length },
                    { value: "PRONUNCIATION", label: "读音", count: japaneseCountByType("PRONUNCIATION") },
                    { value: "KANJI", label: "汉字", count: japaneseCountByType("KANJI") },
                    { value: "GRAMMAR", label: "语法", count: japaneseCountByType("GRAMMAR") }
                ],
                actions: [
                    { id: "filter", label: "搜索", icon: "ri-search-line" },
                    { id: "new", label: "新增题目", icon: "ri-add-line", primary: true }
                ],
                resetLabel: "重置",
                messages: {
                    selectProject: "选择题目", viewProject: "查看题目", editProject: "编辑题目", moreActions: "更多操作",
                    filtersReset: "筛选条件已重置", treePrefix: "题型目录", expandLeftRegion: "展开题型目录",
                    collapseLeftRegion: "收起题型目录", filterActivated: "搜索框已激活", newOpened: "已打开新增题目窗口",
                    exportPreparing: "题库操作已触发", movePrefix: "移动到"
                }
            },
            search: {
                gridId: japaneseGridId,
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
            },
            tree: {
                gridId: japaneseGridId,
                ariaLabel: "N2 题型目录",
                heading: "题库目录",
                summary: `${japaneseState.records.length} 道题`,
                expandLabelTemplate: "展开{label}",
                collapseLabelTemplate: "收起{label}",
                selectedId: treeItems[0]?.id || "all",
                items: treeItems
            },
            menu: { gridId: japaneseGridId, ariaLabel: "题目行操作" },
            pagination: {
                gridId: japaneseGridId,
                currentPage: 1,
                pageSize: 20,
                totalCount: japaneseState.records.length,
                summaryAll: "共 {total} 题",
                summaryFiltered: "当前 {visible} 题 · 共 {total} 题",
                previousLabel: "上一页",
                nextLabel: "下一页",
                pageChangedMessage: "已切换到第 {page} 页",
                pageSizeChangedMessage: "每页显示 {size} 道题"
            },
            select: {
                pageSize: {
                    gridId: japaneseGridId,
                    role: "page-size",
                    label: "每页显示题数",
                    ariaLabel: "每页显示题数",
                    currentTemplate: "{label}，当前：{value}",
                    menuTitle: "选择每页显示题数",
                    scrollAfter: 4,
                    options: [
                        { value: "10", label: "10 题/页", icon: "ri-list-check-3" },
                        { value: "20", label: "20 题/页", icon: "ri-list-check-3", selected: true },
                        { value: "50", label: "50 题/页", icon: "ri-list-check-3" }
                    ]
                }
            }
        });
    }

    /** 生成新增或编辑题目的 Window 配置。 */
    function japaneseBuildEditorOptions(editing) {
        const typeOptions = Object.entries(japaneseTypeLabels).map(([value, label]) => ({ value, label, icon: "ri-book-2-line" }));
        const answerOptions = ["A", "B", "C", "D"].map((value) => ({ value, label: `选项 ${value}`, icon: "ri-checkbox-circle-line" }));
        return selFreeze({
            id: japaneseEditorId,
            title: editing ? "编辑 N2 题目" : "新增 N2 题目",
            subtitle: "题目、选项、解释与媒体资源在同一窗口维护",
            closeLabel: "关闭题目编辑窗口",
            cancelLabel: "取消",
            submitLabel: editing ? "保存修改" : "保存题目",
            validationMessage: "请完成全部必填字段",
            autoSuccess: false,
            rows: [
                [
                    { name: "sourceQuestionNo", label: "来源题号", type: "number", icon: "ri-hashtag", placeholder: "例如 416", required: true },
                    { name: "questionType", label: "题型", type: "select", required: true, options: typeOptions }
                ],
                [{ name: "name", label: "显示名称", type: "text", icon: "ri-text", placeholder: "留空时自动按题号生成", maxLength: 200 }],
                [{ name: "questionText", label: "题干", type: "textarea", icon: "ri-question-line", placeholder: "今年の大学新卒者の平均給与は去年よりやや低い。", required: true, maxLength: 4000 }],
                [
                    { name: "optionA", label: "选项 A", type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 },
                    { name: "optionB", label: "选项 B", type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 }
                ],
                [
                    { name: "optionC", label: "选项 C", type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 },
                    { name: "optionD", label: "选项 D", type: "text", icon: "ri-checkbox-blank-circle-line", required: true, maxLength: 1000 }
                ],
                [{ name: "correctOption", label: "正确答案", type: "select", required: true, options: answerOptions }],
                [{ name: "audioText", label: "朗读文本", type: "textarea", icon: "ri-volume-up-line", placeholder: "为空时朗读题干", maxLength: 4000 }],
                [{ name: "explanation", label: "题目解释", type: "textarea", icon: "ri-lightbulb-line", placeholder: "可调用本机 Codex CLI 生成后再人工修订", maxLength: 8000 }]
            ]
        });
    }

    /** 向标准题目 Window 追加 AI 与语音生成面板。 */
    function japaneseInstallGenerationControls() {
        const shell = japaneseAppHost.querySelector(`[data-sel-window-id="${japaneseEditorId}"]`);
        const fields = shell?.querySelector(".selwindow-form-fields");
        const feedback = fields?.querySelector(".selwindow-feedback");
        if (!fields || !feedback) throw new Error("题目窗口未提供标准字段区。");

        // 生成面板复用公共节点入口，类名和可访问属性由同一安全边界一次写入。
        const section = element("section", {
            className: "japanese-generation-panel",
            attributes: { "aria-label": "AI 与语音生成" }
        });
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
            button.addEventListener("click", () => japaneseGenerate(button.dataset.generate, button));
        });
        japaneseState.generationView = section;
    }

    /** 返回新增题目的稳定表单默认值。 */
    function japaneseEditorDefaults() {
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

    /** 打开新增或编辑题目窗口。 */
    function japaneseOpenEditor(record = null) {
        // 复制记录，让媒体生成在正式保存前只修改临时编辑上下文。
        japaneseState.editingRecord = record ? { ...record } : null;
        japaneseState.editorController.setLocale(japaneseBuildEditorOptions(Boolean(record)));
        japaneseState.editorController.reset();
        japaneseState.editorController.setValues({ ...japaneseEditorDefaults(), ...(record || {}) });
        japaneseState.editorController.setFeedback("");
        japaneseRefreshPreviews();
        japaneseState.editorController.open();
    }

    /** 提交新增或编辑题目并刷新页面。 */
    async function japaneseSaveQuestion(values) {
        // 保存期间锁定窗口并立即反馈，防止重复提交。
        japaneseState.editorController.setLoading(true);
        japaneseState.editorController.setFeedback("正在保存题目…");
        try {
            const editing = Boolean(japaneseState.editingRecord?.id);
            const media = japaneseState.editingRecord || {};
            // 前端只提交题目和媒体业务字段，身份审计由 BaseService 维护。
            const payload = {
                ...values,
                ...(editing ? { id: japaneseState.editingRecord.id } : {}),
                name: String(values.name || "").trim() || `蓝宝书 N2 第${values.sourceQuestionNo}题`,
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
            await japaneseRequest(japaneseQuestionApi + (editing ? "update.htm" : "create.htm"), {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                body: new URLSearchParams(payload)
            });
            japaneseState.editorController.close();
            await japaneseRefresh();
        } catch (error) {
            japaneseState.editorController.setFeedback(error.message || "题目保存失败。", true);
        } finally {
            japaneseState.editorController.setLoading(false);
        }
    }

    /** 经公共确认框确认后删除题目。 */
    async function japaneseRemoveQuestion(record) {
        const confirmed = await japaneseState.deleteController.open({
            title: "删除题目",
            message: "删除后题目将不再出现在题库列表中。",
            target: `第 ${record.sourceQuestionNo} 题 · ${String(record.questionText || "").slice(0, 36)}`,
            tone: "danger",
            icon: "ri-delete-bin-6-line",
            cancelLabel: "保留题目",
            confirmLabel: "确认删除"
        });
        if (!confirmed) return;
        await japaneseRequest(`${japaneseQuestionApi}delete.htm`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: new URLSearchParams({ id: record.id })
        });
        await japaneseRefresh();
    }

    /** 提取生成接口需要的题目业务字段。 */
    function japaneseBuildGenerationPayload() {
        const values = japaneseState.editorController.getValues();
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

    /** 执行解释、图片或语音生成并写回结果。 */
    async function japaneseGenerate(kind, activeButton) {
        // 英文 kind 用于接口路径，中文 labels 只用于用户反馈。
        const labels = { explanation: "解释", image: "图片", audio: "语音" };
        japaneseSetGenerating(true, activeButton);
        japaneseState.editorController.setFeedback(`正在调用${kind === "audio" ? " NanamiNeural" : "本机 Codex CLI"}生成${labels[kind]}…`);
        try {
            const result = await japaneseRequest(`${japaneseQuestionApi}generate-${kind}.htm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(japaneseBuildGenerationPayload())
            });
            if (kind === "explanation") {
                const nextValues = { ...japaneseState.editorController.getValues(), explanation: result.data.explanation };
                japaneseState.editorController.setValues(nextValues);
            } else {
                const prefix = kind === "image" ? "image" : "audio";
                japaneseState.editingRecord = {
                    ...(japaneseState.editingRecord || {}),
                    [`${prefix}StorageProvider`]: result.data.storageProvider,
                    [`${prefix}StorageKey`]: result.data.objectKey,
                    [`${prefix}Url`]: result.data.url
                };
                japaneseRefreshPreviews();
            }
            japaneseState.editorController.setFeedback(result.msg || `${labels[kind]}生成完成。`);
        } catch (error) {
            japaneseState.editorController.setFeedback(error.message || `${labels[kind]}生成失败。`, true);
        } finally {
            japaneseSetGenerating(false, activeButton);
        }
    }

    /** 统一切换生成按钮的忙碌状态。 */
    function japaneseSetGenerating(busy, activeButton) {
        japaneseState.generationView?.querySelectorAll("[data-generate]").forEach((button) => {
            button.disabled = busy;
            button.classList.toggle("is-running", busy && button === activeButton);
        });
    }

    /** 同步图片和音频预览。 */
    function japaneseRefreshPreviews() {
        if (!japaneseState.generationView) return;
        const imageHost = japaneseState.generationView.querySelector("[data-image-preview]");
        const image = imageHost.querySelector("img");
        const imageUrl = japaneseState.editingRecord?.imageUrl || "";
        image.hidden = !imageUrl;
        imageHost.querySelector("p").hidden = Boolean(imageUrl);
        if (imageUrl) image.src = `${imageUrl}?v=${Date.now()}`;

        const audioHost = japaneseState.generationView.querySelector("[data-audio-preview]");
        const audio = audioHost.querySelector("audio");
        const audioUrl = japaneseState.editingRecord?.audioUrl || "";
        audio.hidden = !audioUrl;
        audioHost.querySelector("p").hidden = Boolean(audioUrl);
        if (audioUrl) audio.src = `${audioUrl}?v=${Date.now()}`;
    }

    /** 重新读取题目并原位刷新公共组件。 */
    async function japaneseRefresh() {
        japaneseState.records = await japaneseLoadRecords();
        japaneseState.treeItems = japaneseBuildTreeItems();
        const payload = japaneseBuildPayload();
        const panelRoot = panel.get(japaneseGridId);
        panel.setLocale(panelRoot, { view: payload });
        japaneseState.gridController.setLocale(payload);
    }

    /** 完成日语题库的一次性启动装配。 */
    async function mountApp() {
        // 先准备题目、树和聚合 Payload，再按依赖顺序挂载公共组件。
        japaneseState.records = await japaneseLoadRecords();
        japaneseState.treeItems = japaneseBuildTreeItems();
        const payload = japaneseBuildPayload();
        const panelRoot = panel.create(japaneseAppHost, {
            gridId: japaneseGridId,
            sourceId: japaneseGridId,
            entity: "JapaneseN2BlueBookQuestion",
            view: "question-bank",
            layout: "single",
            structure: japaneseLayout,
            ariaLabel: payload.title.ariaLabel
        });
        if (!panelRoot) throw new Error("日语题库公共面板创建失败。");
        if (!panel.mount(panelRoot, {
            view: payload,
            expandLeftLabel: payload.title.messages.expandLeftRegion,
            collapseLeftLabel: payload.title.messages.collapseLeftRegion
        })) throw new Error("日语题库公共面板挂载失败。");
        if (!search.mount(panelRoot, payload.search)) throw new Error("日语题库搜索控件挂载失败。");
        if (!tree.mount(panelRoot, payload.tree)) throw new Error("日语题库导航树挂载失败。");
        dropdown.mountAll(panelRoot);
        japaneseState.gridController = grid.mount(panelRoot, payload);
        if (!japaneseState.gridController) throw new Error("日语题库表格挂载失败。");

        // 主工作区完成后再挂载编辑、确认和生成控件。
        const windowMessages = await japaneseRequest("/sel/components/window/i18n/zh-CN.json?v=20260809-japanese-2");
        japaneseState.editorController = windowComponent.mount(japaneseAppHost, { messages: windowMessages, ...japaneseBuildEditorOptions(false) });
        japaneseState.deleteController = confirmDialog.mount(japaneseAppHost, { id: "JapaneseN2QuestionDeleteConfirm" });
        if (!japaneseState.editorController || !japaneseState.deleteController) throw new Error("日语题库窗口控件挂载失败。");
        japaneseInstallGenerationControls();

        // 新增、行操作、双击和 Window 提交都在稳定宿主集中绑定一次。
        panelRoot.addEventListener("selGrid:new", () => japaneseOpenEditor());
        panelRoot.addEventListener("selGrid:action", (event) => {
            const detail = event.detail;
            if (!detail || detail.instanceKey !== japaneseGridId) return;
            if (detail.action === "edit") japaneseOpenEditor(detail.record);
            if (detail.action === "delete") japaneseRemoveQuestion(detail.record).catch(japaneseShowError);
        });
        panelRoot.addEventListener("dblclick", (event) => {
            const row = event.target.closest("tr[data-sel-grid-record-id]");
            if (!row) return;
            const record = japaneseState.records.find((item) => String(item.id) === row.dataset.selGridRecordId);
            if (record) japaneseOpenEditor(record);
        });
        japaneseAppHost.addEventListener("selWindow:submit", (event) => {
            if (event.detail?.id === japaneseEditorId) japaneseSaveQuestion(event.detail.values);
        });
    }

    /** 把操作错误写入控制台和页面反馈区。 */
    function japaneseShowError(error) {
        console.error("日语题库操作失败。", error);
        const panelRoot = panel.get(japaneseGridId);
        const feedback = panelRoot?.querySelector("[data-sel-grid-role='feedback']");
        if (feedback) feedback.textContent = error.message || "日语题库操作失败。";
    }

    const backgroundController = pageBackground.mount(japaneseBackgroundHost, {
        defaults: { theme: "solid-dark", overlay: 0, brightness: 100, blur: 0 }
    });
    if (!backgroundController) throw new Error("日语题库页面背景挂载失败。");
    if (!personalization.mount(japanesePersonalizationHost, { backgroundController })) {
        throw new Error("日语题库个性化设置挂载失败。");
    }

    mountApp().catch(japaneseShowError);
}());
