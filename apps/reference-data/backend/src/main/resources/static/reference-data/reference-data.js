/*
 * reference-data.js：引用数据类型管理应用装配层。
 * 只负责真实接口、业务实例、五区布局和标准 payload；不创建通用控件 DOM，不定义组件视觉。
 */
(function referenceDataInitializeApplication() {
    "use strict";

    // 应用只依赖 SEL 公开能力；缺失组件必须停止装配，禁止回退为应用层原生控件。
    const referenceDataRequiredComponents = Object.freeze([
        "selBaseRuntime", "selAjax", "selPanel", "selSearch", "selTree", "selDropdownMenu",
        "selGrid", "selWindow", "selPageBackground", "selPersonalization", "selThemeManager"
    ]);
    const referenceDataMissingComponents = referenceDataRequiredComponents.filter((referenceDataName) => !window[referenceDataName]);
    if (referenceDataMissingComponents.length > 0) {
        throw new Error(`引用数据管理缺少公共组件：${referenceDataMissingComponents.join("、")}。`);
    }

    const referenceDataBase = window.selBaseRuntime;
    const referenceDataAjax = window.selAjax;
    const referenceDataApplicationHost = referenceDataBase.query("[data-reference-data-app]");
    const referenceDataBackgroundHost = referenceDataBase.query("[data-sel-page-background-host]");
    const referenceDataPersonalizationHost = referenceDataBase.query("[data-sel-personalization-host]");
    const referenceDataTypeApi = "/api/reference-data/admin/types/";
    const referenceDataGridId = "ReferenceDataTypeGrid";
    const referenceDataState = {
        editingId: null,
        pendingDeleteId: null,
        gridController: null,
        editWindowController: null,
        deleteWindowController: null
    };

    // 五区布局只声明组件、数据片段和位置，真实结构全部由 selPanel 白名单创建。
    const referenceDataLayout = Object.freeze({
        top: Object.freeze([
            Object.freeze({ component: "title", payload: "title" }),
            Object.freeze({
                component: "toolbar",
                children: Object.freeze([
                    Object.freeze({ component: "selSearch", payload: "search" }),
                    Object.freeze({ component: "selDropdownMenu", slot: "status", payload: "select.status" }),
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

    /**
     * 分批读取全部类型，避免后端单页上限影响公共表格的真实分页和筛选。
     * 请求示例：GET /api/reference-data/admin/types?pageNo=1&pageSize=100
     * 返回示例：{records:[{id:1,resourceCode:"resource-kind"}],totalCount:1,pageNo:1,pageSize:100}
     * @returns {Promise<Array<object>>} 保持数据库排序的完整类型记录。
     */
    async function referenceDataLoadAllTypes() {
        const referenceDataPageSize = 100;
        const referenceDataFirstPage = await referenceDataAjax.json({
            url: `${referenceDataTypeApi}getStore.htm?pageNo=1&pageSize=${referenceDataPageSize}`
        });
        const referenceDataTotalPages = Math.max(1, Math.ceil(Number(referenceDataFirstPage.totalCount || 0) / referenceDataPageSize));
        if (referenceDataTotalPages === 1) return Array.isArray(referenceDataFirstPage.records) ? referenceDataFirstPage.records : [];
        const referenceDataOtherPages = await Promise.all(
            Array.from({ length: referenceDataTotalPages - 1 }, (_, referenceDataIndex) => referenceDataAjax.json({
                url: `${referenceDataTypeApi}getStore.htm?pageNo=${referenceDataIndex + 2}&pageSize=${referenceDataPageSize}`
            }))
        );
        return [referenceDataFirstPage, ...referenceDataOtherPages].flatMap((referenceDataPage) => referenceDataPage.records || []);
    }

    /**
     * 把管理接口记录适配成 SEL 聚合 payload。
     * 传参示例：[{id:1,status:1,resourceCode:"resource-kind"}]
     * 返回示例：{data:{items:[...]},column:{items:[...]},title:{...},select:{status:{...}}}
     * @param {Array<object>} referenceDataRecords - 管理接口返回的稳定业务记录。
     * @returns {object} selPanel、selSearch、selTree、selDropdownMenu 和 selGrid 共享的标准输入。
     */
    function referenceDataBuildPayload(referenceDataRecords) {
        const referenceDataEnabledCount = referenceDataRecords.filter((referenceDataRecord) => Number(referenceDataRecord.status) === 1).length;
        const referenceDataDisabledCount = referenceDataRecords.filter((referenceDataRecord) => Number(referenceDataRecord.status) === 2).length;
        return Object.freeze({
            grid: Object.freeze({
                mode: "records",
                idField: "id",
                statusField: "status",
                searchFields: Object.freeze(["projectCode", "resourceCode", "nameZh", "nameJa", "nameEn"])
            }),
            data: Object.freeze({ items: Object.freeze([...referenceDataRecords]), selectedIds: Object.freeze([]) }),
            column: Object.freeze({
                gridId: referenceDataGridId,
                ariaLabel: "引用数据类型表格",
                emptyText: "没有符合当前条件的引用数据类型",
                items: Object.freeze([
                    Object.freeze({ id: "coordinate", field: "resourceCode", secondaryField: "projectCode", label: "类型坐标", renderer: "stack", width: "22%" }),
                    Object.freeze({ id: "nameZh", field: "nameZh", label: "中文名称", renderer: "text", width: "17%" }),
                    Object.freeze({ id: "localized", field: "nameEn", secondaryField: "nameJa", label: "英文 / 日文", renderer: "stack", width: "21%" }),
                    Object.freeze({ id: "status", field: "status", label: "状态", renderer: "badge", labelSource: "status", toneMap: Object.freeze({ "1": "enabled", "2": "disabled" }), width: "10%" }),
                    Object.freeze({ id: "sortnum", field: "sortnum", label: "排序", renderer: "text", width: "8%" }),
                    Object.freeze({ id: "updatedAt", field: "updatedAt", label: "更新时间", renderer: "time", nowrap: true, width: "14%" }),
                    Object.freeze({
                        id: "actions", field: "id", label: "操作", renderer: "actions", width: "8%",
                        actions: Object.freeze([
                            Object.freeze({ id: "edit", label: "编辑类型", icon: "ri-edit-line" }),
                            Object.freeze({ id: "delete", label: "删除类型", icon: "ri-delete-bin-6-line", tone: "danger" })
                        ])
                    })
                ])
            }),
            title: Object.freeze({
                title: "引用数据类型管理",
                subtitle: "Reference Data Catalog",
                description: "维护跨项目稳定坐标、多语言名称和类型启停状态",
                ariaLabel: "引用数据类型管理面板",
                ariaLabels: Object.freeze({
                    statusTabs: "类型状态筛选", headerActions: "类型快捷操作", toolbar: "类型筛选工具栏",
                    sidebar: "类型状态导航", content: "类型列表内容区", board: "引用数据类型表格", pagination: "类型分页"
                }),
                statusTabs: Object.freeze([
                    Object.freeze({ value: "", label: "全部", count: referenceDataRecords.length }),
                    Object.freeze({ value: "1", label: "已启用", count: referenceDataEnabledCount }),
                    Object.freeze({ value: "2", label: "已停用", count: referenceDataDisabledCount })
                ]),
                actions: Object.freeze([Object.freeze({ id: "new", label: "新增类型", icon: "ri-add-line", primary: true })]),
                resetLabel: "重置",
                messages: Object.freeze({
                    selectProject: "选择类型", viewProject: "查看类型", editProject: "编辑类型", moreActions: "更多操作",
                    filtersReset: "筛选条件已重置", treePrefix: "类型导航", expandLeftRegion: "展开类型导航",
                    collapseLeftRegion: "收起类型导航", filterActivated: "筛选工具栏已激活",
                    newOpened: "已打开新增类型窗口", exportPreparing: "正在准备导出", dateRange: "日期范围：{start} 至 {end}", movePrefix: "移动到"
                })
            }),
            search: Object.freeze({
                gridId: referenceDataGridId,
                label: "类型搜索",
                placeholder: "搜索项目、资源编码或多语言名称…",
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
                gridId: referenceDataGridId,
                ariaLabel: "类型状态导航",
                heading: "类型导航",
                summary: `${referenceDataRecords.length} 个类型`,
                expandLabelTemplate: "展开{label}",
                collapseLabelTemplate: "收起{label}",
                selectedId: "all",
                items: Object.freeze([
                    Object.freeze({ id: "all", label: "全部类型", icon: "ri-database-2-line", count: referenceDataRecords.length, filter: Object.freeze({}) }),
                    Object.freeze({ id: "enabled", label: "已启用", icon: "ri-checkbox-circle-line", count: referenceDataEnabledCount, filter: Object.freeze({ status: "1" }) }),
                    Object.freeze({ id: "disabled", label: "已停用", icon: "ri-forbid-2-line", count: referenceDataDisabledCount, filter: Object.freeze({ status: "2" }) })
                ])
            }),
            menu: Object.freeze({ gridId: referenceDataGridId, ariaLabel: "类型行操作" }),
            pagination: Object.freeze({
                gridId: referenceDataGridId,
                currentPage: 1,
                pageSize: 20,
                totalCount: referenceDataRecords.length,
                summaryAll: "共 {total} 条",
                summaryFiltered: "当前 {visible} 条 · 共 {total} 条",
                previousLabel: "上一页",
                nextLabel: "下一页",
                pageChangedMessage: "已切换到第 {page} 页",
                pageSizeChangedMessage: "每页显示 {size} 条类型"
            }),
            select: Object.freeze({
                status: Object.freeze({
                    gridId: referenceDataGridId,
                    role: "status-filter",
                    label: "类型状态",
                    ariaLabel: "按类型状态筛选",
                    currentTemplate: "{label}，当前：{value}",
                    menuTitle: "选择类型状态",
                    prefix: "状态：",
                    scrollAfter: 6,
                    options: Object.freeze([
                        Object.freeze({ value: "", label: "全部状态", icon: "ri-apps-2-line", description: "显示全部引用数据类型" }),
                        Object.freeze({ value: "1", label: "已启用", icon: "ri-checkbox-circle-line", tone: "done", description: "可以被业务项目调用" }),
                        Object.freeze({ value: "2", label: "已停用", icon: "ri-forbid-2-line", tone: "muted", description: "暂时停止对外使用" })
                    ])
                }),
                pageSize: Object.freeze({
                    gridId: referenceDataGridId,
                    role: "page-size",
                    label: "每页显示条数",
                    ariaLabel: "每页显示条数",
                    currentTemplate: "{label}，当前：{value}",
                    menuTitle: "选择每页显示条数",
                    scrollAfter: 4,
                    options: Object.freeze([
                        Object.freeze({ value: "10", label: "10 条/页", icon: "ri-list-check-3" }),
                        Object.freeze({ value: "20", label: "20 条/页", icon: "ri-list-check-3", selected: true }),
                        Object.freeze({ value: "50", label: "50 条/页", icon: "ri-list-check-3" })
                    ])
                })
            })
        });
    }

    /**
     * 创建新增或编辑窗口的标准字段配置。
     * @param {boolean} referenceDataEditing - true 表示编辑窗口文案。
     * @returns {object} selWindow.mount 或 setLocale 可直接消费的窗口配置。
     */
    function referenceDataBuildEditWindow(referenceDataEditing) {
        return Object.freeze({
            title: referenceDataEditing ? "编辑类型" : "新增类型",
            subtitle: "类型坐标用于跨项目稳定调用，保存后请谨慎修改",
            closeLabel: `关闭${referenceDataEditing ? "编辑" : "新增"}类型窗口`,
            cancelLabel: "取消",
            submitLabel: referenceDataEditing ? "保存修改" : "保存类型",
            validationMessage: "请完成全部必填字段",
            autoSuccess: false,
            rows: Object.freeze([
                Object.freeze([
                    Object.freeze({ name: "projectCode", label: "项目编码", type: "text", icon: "ri-code-box-line", placeholder: "例如 cms", required: true, maxLength: 64 }),
                    Object.freeze({ name: "resourceCode", label: "资源编码", type: "text", icon: "ri-key-2-line", placeholder: "例如 article-category", required: true, maxLength: 64 })
                ]),
                Object.freeze([Object.freeze({ name: "nameZh", label: "中文名称", type: "text", icon: "ri-translate-2", placeholder: "例如 文章分类", required: true, maxLength: 120 })]),
                Object.freeze([
                    Object.freeze({ name: "nameJa", label: "日文名称", type: "text", icon: "ri-translate", placeholder: "例：記事カテゴリ", maxLength: 120 }),
                    Object.freeze({ name: "nameEn", label: "英文名称", type: "text", icon: "ri-english-input", placeholder: "e.g. Article categories", maxLength: 120 })
                ]),
                Object.freeze([
                    Object.freeze({ name: "status", label: "状态", type: "select", required: true, options: Object.freeze([
                        Object.freeze({ value: "1", label: "启用", icon: "ri-checkbox-circle-line", tone: "done", selected: true }),
                        Object.freeze({ value: "2", label: "停用", icon: "ri-forbid-2-line", tone: "muted" })
                    ]) })
                ]),
                Object.freeze([Object.freeze({ name: "sortnum", label: "排序值", type: "number", icon: "ri-sort-number-asc", value: "0" })]),
                Object.freeze([Object.freeze({ name: "descriptionZh", label: "中文说明", type: "textarea", icon: "ri-file-text-line", placeholder: "说明由哪个项目使用，以及数据用途", maxLength: 500 })])
            ])
        });
    }

    /**
     * 使用最新数据库记录更新已挂载公共面板与表格。
     * @returns {Promise<void>} 更新完成后保留当前组件实例。
     */
    async function referenceDataRefresh() {
        const referenceDataRecords = await referenceDataLoadAllTypes();
        const referenceDataPayload = referenceDataBuildPayload(referenceDataRecords);
        const referenceDataPanelRoot = window.selPanel.get(referenceDataGridId);
        if (referenceDataPanelRoot) window.selPanel.setLocale(referenceDataPanelRoot, { view: referenceDataPayload });
        if (referenceDataState.gridController) referenceDataState.gridController.setLocale(referenceDataPayload);
    }

    /**
     * 保存新增或编辑表单。
     * 传参示例：{projectCode:"cms",resourceCode:"article-category",status:"1"}
     * 返回示例：{success:true,data:{id:2},affectedRows:1,msg:"类型新增完成。"}
     * @param {object} referenceDataValues - selWindow 提交的标准表单值。
     * @returns {Promise<void>} 保存成功后关闭窗口并刷新当前表格。
     */
    async function referenceDataSave(referenceDataValues) {
        referenceDataState.editWindowController.setLoading(true);
        referenceDataState.editWindowController.setFeedback("正在保存类型…");
        try {
            const referenceDataResult = await referenceDataAjax.request({
                url: referenceDataState.editingId ? `${referenceDataTypeApi}update.htm` : `${referenceDataTypeApi}create.htm`,
                method: "POST",
                data: referenceDataState.editingId
                    ? { ...referenceDataValues, id: referenceDataState.editingId }
                    : referenceDataValues
            });
            referenceDataState.editWindowController.setFeedback(referenceDataResult.msg || "类型保存完成。");
            await referenceDataRefresh();
            referenceDataState.editWindowController.close();
        } catch (referenceDataError) {
            referenceDataState.editWindowController.setFeedback(referenceDataError.message || "类型保存失败。", true);
        } finally {
            referenceDataState.editWindowController.setLoading(false);
        }
    }

    /**
     * 删除当前确认窗口指向的类型。
     * @returns {Promise<void>} 删除成功后关闭确认窗口并刷新表格。
     */
    async function referenceDataDelete() {
        if (!referenceDataState.pendingDeleteId) return;
        referenceDataState.deleteWindowController.setLoading(true);
        referenceDataState.deleteWindowController.setFeedback("正在删除类型…");
        try {
            const referenceDataResult = await referenceDataAjax.request({
                url: `${referenceDataTypeApi}delete.htm`,
                method: "POST",
                data: { id: referenceDataState.pendingDeleteId }
            });
            referenceDataState.deleteWindowController.setFeedback(referenceDataResult.msg || "类型删除完成。");
            await referenceDataRefresh();
            referenceDataState.deleteWindowController.close();
            referenceDataState.pendingDeleteId = null;
        } catch (referenceDataError) {
            referenceDataState.deleteWindowController.setFeedback(referenceDataError.message || "类型删除失败。", true);
        } finally {
            referenceDataState.deleteWindowController.setLoading(false);
        }
    }

    /**
     * 装配唯一 Reference Data 业务实例。
     * @returns {Promise<void>} 全部公共组件挂载完成后返回。
     */
    async function referenceDataMountApplication() {
        const [referenceDataRecords, referenceDataWindowMessages] = await Promise.all([
            referenceDataLoadAllTypes(),
            referenceDataAjax.json({ url: "/sel/components/window/i18n/zh-CN.json?v=20260807-reference-1" })
        ]);
        const referenceDataPayload = referenceDataBuildPayload(referenceDataRecords);
        const referenceDataPanelRoot = window.selPanel.create(referenceDataApplicationHost, {
            gridId: referenceDataGridId,
            sourceId: referenceDataGridId,
            entity: "ReferenceDataType",
            view: "catalog",
            layout: "single",
            structure: referenceDataLayout,
            ariaLabel: referenceDataPayload.title.ariaLabel
        });
        if (!referenceDataPanelRoot) throw new Error("引用数据公共面板创建失败。");
        if (!window.selPanel.mount(referenceDataPanelRoot, {
            view: referenceDataPayload,
            expandLeftLabel: referenceDataPayload.title.messages.expandLeftRegion,
            collapseLeftLabel: referenceDataPayload.title.messages.collapseLeftRegion
        })) throw new Error("引用数据公共面板挂载失败。");
        if (!window.selSearch.mount(referenceDataPanelRoot, referenceDataPayload.search)) throw new Error("引用数据搜索控件挂载失败。");
        if (!window.selTree.mount(referenceDataPanelRoot, referenceDataPayload.tree)) throw new Error("引用数据导航树挂载失败。");
        window.selDropdownMenu.mountAll(referenceDataPanelRoot);
        referenceDataState.gridController = window.selGrid.mount(referenceDataPanelRoot, referenceDataPayload);
        if (!referenceDataState.gridController) throw new Error("引用数据表格挂载失败。");

        referenceDataState.editWindowController = window.selWindow.mount(referenceDataApplicationHost, {
            id: "ReferenceDataTypeEditWindow",
            messages: referenceDataWindowMessages,
            ...referenceDataBuildEditWindow(false)
        });
        referenceDataState.deleteWindowController = window.selWindow.mount(referenceDataApplicationHost, {
            id: "ReferenceDataTypeDeleteWindow",
            messages: referenceDataWindowMessages,
            title: "删除类型",
            subtitle: "删除采用逻辑删除；内置类型受后台保护，无法删除",
            closeLabel: "关闭删除确认窗口",
            cancelLabel: "取消",
            submitLabel: "确认删除",
            validationMessage: "请确认删除操作",
            autoSuccess: false,
            rows: Object.freeze([])
        });
        if (!referenceDataState.editWindowController || !referenceDataState.deleteWindowController) throw new Error("引用数据公共窗口挂载失败。");

        referenceDataPanelRoot.addEventListener("selGrid:new", () => {
            referenceDataState.editingId = null;
            referenceDataState.editWindowController.setLocale(referenceDataBuildEditWindow(false));
            referenceDataState.editWindowController.reset();
            referenceDataState.editWindowController.open();
        });
        referenceDataPanelRoot.addEventListener("selGrid:action", async (referenceDataEvent) => {
            const referenceDataDetail = referenceDataEvent.detail;
            if (!referenceDataDetail || referenceDataDetail.instanceKey !== referenceDataGridId) return;
            if (referenceDataDetail.action === "edit") {
                referenceDataState.editingId = Number(referenceDataDetail.record.id);
                referenceDataState.editWindowController.setLocale(referenceDataBuildEditWindow(true));
                referenceDataState.editWindowController.reset();
                referenceDataState.editWindowController.setValues(referenceDataDetail.record);
                referenceDataState.editWindowController.open();
            }
            if (referenceDataDetail.action === "delete") {
                referenceDataState.pendingDeleteId = Number(referenceDataDetail.record.id);
                referenceDataState.deleteWindowController.setFeedback(`即将删除：${referenceDataDetail.record.projectCode}/${referenceDataDetail.record.resourceCode}`);
                referenceDataState.deleteWindowController.open();
            }
        });
        referenceDataApplicationHost.addEventListener("selWindow:submit", (referenceDataEvent) => {
            if (referenceDataEvent.detail?.id === "ReferenceDataTypeEditWindow") referenceDataSave(referenceDataEvent.detail.values);
            if (referenceDataEvent.detail?.id === "ReferenceDataTypeDeleteWindow") referenceDataDelete();
        });
    }

    // 背景与个性化组件独立挂载；主题切换只更新令牌，不重建业务实例或重新请求数据。
    const referenceDataBackgroundController = window.selPageBackground.mount(referenceDataBackgroundHost, {
        defaults: Object.freeze({ theme: "solid-dark", overlay: 0, brightness: 100, blur: 0 })
    });
    if (!referenceDataBackgroundController) throw new Error("引用数据页面背景挂载失败。");
    if (!window.selPersonalization.mount(referenceDataPersonalizationHost, { backgroundController: referenceDataBackgroundController })) {
        throw new Error("引用数据个性化设置挂载失败。");
    }

    referenceDataMountApplication().catch((referenceDataError) => {
        console.error("引用数据管理初始化失败。", referenceDataError);
        throw referenceDataError;
    });
}());
