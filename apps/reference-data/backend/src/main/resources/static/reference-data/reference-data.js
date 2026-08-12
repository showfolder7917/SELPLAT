/*
 * reference-data.js：引用数据六表管理工作台装配层。
 * 真实数据来自六张业务表，ReferenceDataTable 登记表格，表格列来自 ReferenceDataTableColumn。
 */
(function referenceDataInitializeApplication() {
    "use strict";

    const referenceDataRequiredComponents = Object.freeze([
        "selBaseRuntime", "selAjax", "selPanel", "selSearch", "selTooltip", "selTree", "selDropdownMenu",
        "selGrid", "selWindow", "selConfirmDialog", "selContextMenu", "selPageBackground", "selPersonalization", "selThemeManager"
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
    const referenceDataGridId = "selGridReferenceDataManagementId";
    const referenceDataLocale = "zh-CN";
    const referenceDataNavigationUrl = "/api/reference-data/workbench/navigation.htm";
    const referenceDataWindowMessagesUrl = "/sel/components/window/i18n/zh-CN.json?v=20260811-reference-workbench-1";

    const referenceDataModules = Object.freeze({
        types: Object.freeze({
            key: "types", tableName: "ReferenceDataType", gridId: "selGridTypeManagementId",
            entity: "ReferenceDataType", api: "/api/reference-data/admin/types/", icon: "ri-database-2-line", windowId: "selWindowTypeManagementId",
            name: "数据类型", itemName: "类型", description: "定义跨项目稳定坐标和多语言名称",
            searchFields: Object.freeze(["projectCode", "resourceCode", "nameZh", "nameJa", "nameEn"]),
            previewField: "resourceCode"
        }),
        tree: Object.freeze({
            key: "tree", tableName: "ReferenceDataTreeNode", gridId: "selGridTreeNodeManagementId",
            entity: "ReferenceDataTreeNode", api: "/api/reference-data/admin/tree-nodes/", icon: "ri-node-tree", windowId: "selWindowTreeNodeManagementId",
            name: "树节点", itemName: "节点", description: "维护带父子关系的树形展示数据",
            searchFields: Object.freeze(["nodeCode", "nodeValue", "labelZh", "labelJa", "labelEn"]),
            previewField: "nodeCode", relation: true
        }),
        options: Object.freeze({
            key: "options", tableName: "ReferenceDataOption", gridId: "selGridOptionManagementId",
            entity: "ReferenceDataOption", api: "/api/reference-data/admin/options/", icon: "ri-list-check-3", windowId: "selWindowOptionManagementId",
            name: "下拉选项", itemName: "选项", description: "维护下拉列表的值、分组和禁用状态",
            searchFields: Object.freeze(["optionValue", "groupCode", "labelZh", "labelJa", "labelEn"]),
            previewField: "optionValue", hasBoolean: true
        }),
        menus: Object.freeze({
            key: "menus", tableName: "ReferenceDataContextMenuItem", gridId: "selGridContextMenuManagementId",
            entity: "ReferenceDataContextMenuItem", api: "/api/reference-data/admin/context-menu-items/", icon: "ri-menu-2-line", windowId: "selWindowContextMenuManagementId",
            name: "菜单项目", itemName: "菜单", description: "维护分层菜单、命令、图标和禁用状态",
            searchFields: Object.freeze(["itemCode", "command", "labelZh", "labelJa", "labelEn"]),
            previewField: "itemCode", relation: true, hasBoolean: true
        }),
        tables: Object.freeze({
            key: "tables", tableName: "ReferenceDataTable", gridId: "selGridTableManagementId",
            entity: "ReferenceDataTable", api: "/api/reference-data/admin/tables/", icon: "ri-table-line", windowId: "selWindowTableManagementId",
            name: "表格定义", itemName: "表格", description: "登记项目页面表格并进入对应表格头明细",
            searchFields: Object.freeze(["projectName", "tableName", "gridColumnId", "description", "pagePath"]),
            previewField: "gridColumnId"
        }),
        columns: Object.freeze({
            key: "columns", tableName: "ReferenceDataTableColumn", gridId: "selGridTableColumnManagementId",
            entity: "ReferenceDataTableColumn", api: "/api/reference-data/admin/table-columns/", icon: "ri-layout-column-line", windowId: "selWindowTableColumnManagementId",
            name: "表格头", itemName: "表格列", description: "配置每个页面表格的名称、宽度、多语言和显示状态",
            searchFields: Object.freeze(["tableName", "gridId", "gridColumnId", "tableFieldName", "labelZh", "labelJa", "labelEn"]),
            previewField: "gridColumnId", hasBoolean: true
        })
    });
    const referenceDataModuleList = Object.freeze(Object.values(referenceDataModules));
    const referenceDataState = {
        activeKey: "types",
        navigationKeys: [],
        loadedKeys: new Set(),
        records: new Map(),
        columns: new Map(),
        editingId: null,
        panelRoot: null,
        searchController: null,
        gridController: null,
        treeController: null,
        editWindowControllers: new Map(),
        deleteConfirmController: null,
        pageEditConfirmController: null,
        personalizationController: null,
        previewMenuController: null,
        selectedTable: null,
        tableDetailTab: null
    };

    const referenceDataLayout = Object.freeze({
        top: Object.freeze([
            Object.freeze({ component: "title", payload: "title" }),
            Object.freeze({
                component: "toolbar",
                children: Object.freeze([
                    Object.freeze({ component: "selSearch", payload: "search" }),
                    Object.freeze({ component: "selDropdownMenu", slot: "projectType", payload: "select.projectType" }),
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
                        component: "gridSummary", payload: "pagination",
                        children: Object.freeze([Object.freeze({ component: "selDropdownMenu", slot: "pageSize", payload: "select.pageSize" })])
                    }),
                    Object.freeze({ component: "pagination", payload: "pagination" }),
                    Object.freeze({ component: "feedback", payload: "title.messages" })
                ])
            })
        ])
    });
    // 参考图中的筛选栏只占左侧工作区：搜索、范围、状态和重置使用稳定起始宽度，面板剩余空间留白。
    const referenceDataToolbar = Object.freeze({
        columnResize: true,
        columns: Object.freeze({
            "selSearch-1": Object.freeze({ width: 408, minWidth: 320, maxWidth: 560, label: "调整搜索栏目宽度" }),
            projectType: Object.freeze({ width: 320, minWidth: 220, maxWidth: 420, label: "调整数据范围栏目宽度" }),
            status: Object.freeze({ width: 272, minWidth: 200, maxWidth: 360, label: "调整状态栏目宽度" }),
            "filterReset-4": Object.freeze({ width: 104, minWidth: 88, maxWidth: 136, label: "调整重置栏目宽度" })
        })
    });

    function referenceDataActiveModule() {
        return referenceDataModules[referenceDataState.activeKey];
    }

    /** 返回页面编辑器展示的当前表格两段数据库定位坐标。 */
    function referenceDataPageEditorCoordinates(referenceDataModule = referenceDataActiveModule()) {
        return Object.freeze([
            Object.freeze({ label: "业务数据表", value: referenceDataModule.tableName }),
            Object.freeze({ label: "表格控件 ID", value: referenceDataModule.gridId })
        ]);
    }

    /** 捕获公共 Grid 当前列宽，页面编辑会话据此判断拖拽前后是否真正变化。 */
    function referenceDataCapturePageGridState() {
        return Object.freeze({
            columnWidths: referenceDataState.gridController?.captureColumnWidths?.() || Object.freeze({})
        });
    }

    /** 使用页面编辑会话基线恢复列宽，不发送任何后台写请求。 */
    function referenceDataRestorePageGridState(referenceDataPageGridState = {}) {
        return referenceDataState.gridController?.setColumnWidths?.(referenceDataPageGridState.columnWidths || {}) || false;
    }

    /** 把当前表格草稿批量写入 ReferenceDataTableColumn，并重新读取后台确认后的真实宽度。 */
    async function referenceDataSavePageGridState(referenceDataPageGridState = {}) {
        const referenceDataModule = referenceDataActiveModule();
        const referenceDataConfiguredColumnIds = new Set((referenceDataState.columns.get(referenceDataModule.key) || [])
            .map((referenceDataColumn) => String(referenceDataColumn.id || referenceDataColumn.field || ""))
            .filter(Boolean));
        const referenceDataWidths = Object.entries(referenceDataPageGridState.columnWidths || {})
            .filter(([referenceDataColumnId]) => referenceDataConfiguredColumnIds.has(referenceDataColumnId))
            .map(([referenceDataColumnId, referenceDataWidth]) => Object.freeze({
                gridColumnId: referenceDataColumnId,
                width: `${Math.round(Number(referenceDataWidth))}px`
            }));
        if (referenceDataWidths.length === 0) throw new Error("当前表格没有可保存的数据库列配置。");
        await referenceDataAjax.request({
            url: "/api/reference-data/admin/table-columns/save-widths.htm",
            method: "POST",
            data: {
                tableName: referenceDataModule.tableName,
                gridId: referenceDataModule.gridId,
                widths: JSON.stringify(referenceDataWidths)
            }
        });
        // 保存后重新调用当前业务 getGridColumn，页面和下次重开都使用同一个数据库宽度来源。
        await referenceDataLoadResolvedColumns(referenceDataModule, true);
        referenceDataState.gridController.setLocale(referenceDataBuildPayload());
        referenceDataState.gridController.resetColumnWidths();
        return true;
    }

    /** 把同一物理 Grid 当前切换到的业务模块坐标同步给公共页面编辑器。 */
    function referenceDataSyncPageEditorControl() {
        const referenceDataModule = referenceDataActiveModule();
        referenceDataState.personalizationController?.updatePageControl("selGridReferenceDataPageEditorId", {
            title: `${referenceDataModule.name}表格`,
            typeLabel: "表格控件",
            icon: "ri-table-line",
            coordinates: referenceDataPageEditorCoordinates(referenceDataModule),
            captureState: referenceDataCapturePageGridState,
            restoreState: referenceDataRestorePageGridState,
            saveState: referenceDataSavePageGridState
        });
    }

    function referenceDataNavigationModules() {
        return referenceDataState.navigationKeys
            .map((referenceDataKey) => referenceDataModules[referenceDataKey])
            .filter(Boolean);
    }

    async function referenceDataLoadNavigation() {
        const referenceDataResult = await referenceDataAjax.request({ url: referenceDataNavigationUrl });
        const referenceDataItems = Array.isArray(referenceDataResult.data?.modules) ? referenceDataResult.data.modules : [];
        referenceDataState.navigationKeys = referenceDataItems
            .map((referenceDataItem) => String(referenceDataItem.key || ""))
            .filter((referenceDataKey) => referenceDataKey !== "columns" && Boolean(referenceDataModules[referenceDataKey]));
        if (referenceDataState.navigationKeys.length === 0) throw new Error("引用数据工作台导航为空。");
        const referenceDataInitialKey = String(referenceDataResult.data?.initialKey || referenceDataState.navigationKeys[0]);
        referenceDataState.activeKey = referenceDataState.navigationKeys.includes(referenceDataInitialKey)
            ? referenceDataInitialKey : referenceDataState.navigationKeys[0];
    }

    async function referenceDataLoadAllRecords(referenceDataModule) {
        const referenceDataPageSize = 100;
        const referenceDataFirstPage = await referenceDataAjax.json({
            url: `${referenceDataModule.api}getStore.htm?pageNo=1&pageSize=${referenceDataPageSize}`
        });
        const referenceDataTotalPages = Math.max(1, Math.ceil(Number(referenceDataFirstPage.totalCount || 0) / referenceDataPageSize));
        if (referenceDataTotalPages === 1) {
            return (Array.isArray(referenceDataFirstPage.records) ? referenceDataFirstPage.records : [])
                .filter((referenceDataRecord) => Number(referenceDataRecord.status) !== 0);
        }
        const referenceDataOtherPages = await Promise.all(
            Array.from({ length: referenceDataTotalPages - 1 }, (_, referenceDataIndex) => referenceDataAjax.json({
                url: `${referenceDataModule.api}getStore.htm?pageNo=${referenceDataIndex + 2}&pageSize=${referenceDataPageSize}`
            }))
        );
        return [referenceDataFirstPage, ...referenceDataOtherPages]
            .flatMap((referenceDataPage) => referenceDataPage.records || [])
            .filter((referenceDataRecord) => Number(referenceDataRecord.status) !== 0);
    }

    async function referenceDataResolveColumns(referenceDataModule) {
        const referenceDataQuery = new URLSearchParams({
            viewCode: referenceDataModule.gridId,
            locale: referenceDataLocale
        });
        // 所有业务表格统一调用继承自 BaseController 的 getGridColumn；后台负责配置优先和字段名静默降级。
        const referenceDataResult = await referenceDataAjax.request({
            url: `${referenceDataModule.api}getGridColumn.htm?${referenceDataQuery}`
        });
        return Array.isArray(referenceDataResult.data?.columns) ? referenceDataResult.data.columns : [];
    }

    function referenceDataEnrichColumns(referenceDataModule, referenceDataColumns) {
        // 后台始终返回统一列数组；配置缺失时 label 已经是字段名，页面不再保存第二套中文表头。
        const referenceDataSource = [...referenceDataColumns];
        // 操作列属于管理工作台能力；配置未声明时补一列，确保字段名降级状态下仍可完成 CRUD。
        if (!referenceDataSource.some((referenceDataColumn) => referenceDataColumn.renderer === "actions")) {
            referenceDataSource.push(Object.freeze({ id: "__actions", field: "id", label: "操作", renderer: "actions", width: "132px" }));
        }
        return Object.freeze(referenceDataSource.map((referenceDataColumn) => {
            const referenceDataBaseColumn = {
                ...referenceDataColumn,
                nowrap: referenceDataColumn.renderer === "time"
            };
            if (referenceDataColumn.renderer === "badge") {
                return Object.freeze({
                    ...referenceDataBaseColumn,
                    labelSource: "status",
                    toneMap: Object.freeze({ "1": "enabled", "2": "disabled", "0": "disabled" })
                });
            }
            if (referenceDataColumn.renderer === "boolean") {
                return Object.freeze({ ...referenceDataBaseColumn, trueLabel: "是", falseLabel: "否" });
            }
            if (referenceDataColumn.renderer === "actions") {
                const referenceDataActions = [
                    Object.freeze({ id: "edit", label: `编辑${referenceDataModule.itemName}`, icon: "ri-edit-line" })
                ];
                if (["tables", "tree", "options", "menus"].includes(referenceDataModule.key)) {
                    referenceDataActions.push(Object.freeze({
                        id: "preview",
                        label: referenceDataModule.key === "tables" ? "打开表格配置" : `预览${referenceDataModule.itemName}`,
                        icon: "ri-eye-line"
                    }));
                }
                referenceDataActions.push(
                    Object.freeze({
                        id: "toggle",
                        // 已启用记录提供停用动作，已停用记录提供启用动作，图标和 Tip 都描述点击后的结果。
                        label: (referenceDataRecord) => Number(referenceDataRecord.status) === 1 ? "停用" : "启用",
                        icon: (referenceDataRecord) => Number(referenceDataRecord.status) === 1
                            ? "ri-forbid-2-line" : "ri-checkbox-circle-line"
                    }),
                    Object.freeze({ id: "delete", label: `删除${referenceDataModule.itemName}`, icon: "ri-delete-bin-6-line", tone: "danger" })
                );
                return Object.freeze({ ...referenceDataBaseColumn, actions: Object.freeze(referenceDataActions) });
            }
            return Object.freeze(referenceDataBaseColumn);
        }));
    }

    function referenceDataRecordLabel(referenceDataModule, referenceDataRecord) {
        if (referenceDataModule.key === "types") return `${referenceDataRecord.projectCode}/${referenceDataRecord.resourceCode}`;
        if (referenceDataModule.key === "tables") return `${referenceDataRecord.projectName} · ${referenceDataRecord.tableName}`;
        if (referenceDataModule.key === "columns") return `${referenceDataRecord.tableName} · ${referenceDataRecord.labelZh || referenceDataRecord.gridColumnId}`;
        return String(referenceDataRecord.labelZh || referenceDataRecord[referenceDataModule.previewField] || referenceDataRecord.id);
    }

    function referenceDataSetFeedback(referenceDataMessage) {
        const referenceDataFeedback = referenceDataState.panelRoot?.querySelector('[data-sel-grid-role="feedback"]');
        if (referenceDataFeedback) referenceDataFeedback.textContent = String(referenceDataMessage || "");
    }

    function referenceDataBuildHierarchy(referenceDataModule, referenceDataRecords, referenceDataParentId = null) {
        return referenceDataRecords
            .filter((referenceDataRecord) => String(referenceDataRecord.parentId || "") === String(referenceDataParentId || ""))
            .map((referenceDataRecord) => Object.freeze({
                id: `record-${referenceDataModule.key}-${referenceDataRecord.id}`,
                label: referenceDataRecordLabel(referenceDataModule, referenceDataRecord),
                icon: referenceDataModule.icon,
                count: referenceDataRecords.filter((referenceDataChild) => String(referenceDataChild.parentId || "") === String(referenceDataRecord.id)).length,
                filter: Object.freeze({}),
                contextActions: Object.freeze([
                    Object.freeze({ id: "edit", label: "编辑", icon: "ri-edit-line" }),
                    Object.freeze({ id: "delete", label: "删除", icon: "ri-delete-bin-6-line", danger: true })
                ]),
                children: Object.freeze(referenceDataBuildHierarchy(referenceDataModule, referenceDataRecords, referenceDataRecord.id))
            }));
    }

    function referenceDataBuildTreeChildren(referenceDataModule) {
        const referenceDataRecords = referenceDataState.records.get(referenceDataModule.key) || [];
        // 表格定义只作为一级业务入口；具体表格统一在右侧列表查看，避免左树重复形成下拉明细。
        if (referenceDataModule.key === "tables") return Object.freeze([]);
        if (referenceDataModule.relation) return referenceDataBuildHierarchy(referenceDataModule, referenceDataRecords);
        return Object.freeze(referenceDataRecords.map((referenceDataRecord) => Object.freeze({
            id: `record-${referenceDataModule.key}-${referenceDataRecord.id}`,
            label: referenceDataRecordLabel(referenceDataModule, referenceDataRecord),
            icon: referenceDataModule.icon,
            count: 0,
            filter: Object.freeze({}),
            contextActions: Object.freeze([
                Object.freeze({ id: "edit", label: "编辑", icon: "ri-edit-line" }),
                Object.freeze({ id: "delete", label: "删除", icon: "ri-delete-bin-6-line", danger: true })
            ])
        })));
    }

    function referenceDataBuildTypeOptions(referenceDataModule, referenceDataRecords) {
        if (referenceDataModule.key === "options") {
            return referenceDataRecords.map((referenceDataRecord) => Object.freeze({
                value: String(referenceDataRecord.optionValue),
                label: String(referenceDataRecord.labelZh || referenceDataRecord.optionValue),
                icon: "ri-list-check-3",
                disabled: Boolean(referenceDataRecord.disabled),
                description: referenceDataRecord.groupCode ? `分组：${referenceDataRecord.groupCode}` : "未分组"
            }));
        }
        if (referenceDataModule.key === "columns") {
            return referenceDataModuleList.map((referenceDataTargetModule) => Object.freeze({
                value: referenceDataTargetModule.tableName,
                label: referenceDataTargetModule.name,
                icon: referenceDataTargetModule.icon,
                description: referenceDataTargetModule.tableName
            }));
        }
        if (referenceDataModule.key === "tables") {
            return referenceDataRecords.map((referenceDataRecord) => Object.freeze({
                value: String(referenceDataRecord.gridColumnId),
                label: String(referenceDataRecord.tableName),
                icon: referenceDataModule.icon,
                description: String(referenceDataRecord.projectName || "")
            }));
        }
        if (referenceDataModule.key === "types") {
            return referenceDataRecords.map((referenceDataRecord) => Object.freeze({
                value: String(referenceDataRecord.resourceCode),
                label: String(referenceDataRecord.nameZh || referenceDataRecord.resourceCode),
                icon: "ri-database-2-line",
                description: String(referenceDataRecord.projectCode || "")
            }));
        }
        const referenceDataTypes = referenceDataState.records.get("types") || [];
        return referenceDataTypes.map((referenceDataType) => Object.freeze({
            value: String(referenceDataType.id),
            label: String(referenceDataType.nameZh || referenceDataType.resourceCode),
            icon: "ri-database-2-line",
            description: `${referenceDataType.projectCode}/${referenceDataType.resourceCode}`
        }));
    }

    function referenceDataTypeField(referenceDataModule) {
        if (referenceDataModule.key === "types") return "resourceCode";
        if (referenceDataModule.key === "options") return "optionValue";
        if (referenceDataModule.key === "tables") return "gridColumnId";
        if (referenceDataModule.key === "columns") return "tableName";
        return "typeId";
    }

    function referenceDataBuildPayload() {
        const referenceDataModule = referenceDataActiveModule();
        const referenceDataAllRecords = referenceDataState.records.get(referenceDataModule.key) || [];
        // 表格列只显示当前选中表格的配置；其他模块继续展示自己的完整业务记录。
        const referenceDataRecords = referenceDataModule.key === "columns" && referenceDataState.selectedTable
            ? referenceDataAllRecords.filter((referenceDataRecord) =>
                String(referenceDataRecord.tableName) === String(referenceDataState.selectedTable.tableName)
                && String(referenceDataRecord.gridId) === String(referenceDataState.selectedTable.gridColumnId))
            : referenceDataAllRecords;
        const referenceDataEnabledCount = referenceDataRecords.filter((referenceDataRecord) => Number(referenceDataRecord.status) === 1).length;
        const referenceDataDisabledCount = referenceDataRecords.filter((referenceDataRecord) => Number(referenceDataRecord.status) === 2).length;
        const referenceDataColumns = referenceDataEnrichColumns(
            referenceDataModule,
            referenceDataState.columns.get(referenceDataModule.key) || []
        );
        const referenceDataNavigationModuleList = referenceDataNavigationModules();
        const referenceDataTreeItems = referenceDataNavigationModuleList.map((referenceDataNavigationModule) => {
            const referenceDataNavigationRecords = referenceDataState.records.get(referenceDataNavigationModule.key) || [];
            return Object.freeze({
                id: `module-${referenceDataNavigationModule.key}`,
                label: referenceDataNavigationModule.name,
                icon: referenceDataNavigationModule.icon,
                count: referenceDataNavigationRecords.length,
                filter: Object.freeze({}),
                children: referenceDataBuildTreeChildren(referenceDataNavigationModule)
            });
        });
        const referenceDataTypeOptions = referenceDataBuildTypeOptions(referenceDataModule, referenceDataRecords);
        return Object.freeze({
            grid: Object.freeze({
                mode: "records", idField: "id", typeField: referenceDataTypeField(referenceDataModule), statusField: "status",
                searchFields: referenceDataModule.searchFields, wide: true, defaultColumnWidth: 150, columnResize: true
            }),
            data: Object.freeze({ items: Object.freeze([...referenceDataRecords]), selectedIds: Object.freeze([]) }),
            column: Object.freeze({
                gridId: referenceDataGridId,
                ariaLabel: `${referenceDataModule.name}数据表格`,
                emptyText: referenceDataState.loadedKeys.has(referenceDataModule.key)
                    ? `没有符合当前条件的${referenceDataModule.name}记录`
                    : `正在加载${referenceDataModule.name}…`,
                items: referenceDataColumns
            }),
            title: Object.freeze({
                title: "引用数据管理工作台",
                subtitle: referenceDataState.selectedTable
                    ? `表格定义 · ${referenceDataState.selectedTable.description || referenceDataState.selectedTable.tableName}`
                    : `${referenceDataModule.name} · ${referenceDataModule.tableName}`,
                description: referenceDataState.selectedTable
                    ? `${referenceDataState.selectedTable.projectName} / ${referenceDataState.selectedTable.gridColumnId}`
                    : referenceDataModule.description,
                ariaLabel: "引用数据五模块按需加载管理面板",
                ariaLabels: Object.freeze({
                    statusTabs: `${referenceDataModule.name}状态筛选`, headerActions: `${referenceDataModule.name}快捷操作`,
                    toolbar: `${referenceDataModule.name}筛选工具栏`, sidebar: "业务模块导航",
                    content: `${referenceDataModule.name}内容区`, board: `${referenceDataModule.name}表格`, pagination: `${referenceDataModule.name}分页`
                }),
                statusTabs: Object.freeze([
                    Object.freeze({ value: "", label: "全部", count: referenceDataRecords.length }),
                    Object.freeze({ value: "1", label: "已启用", count: referenceDataEnabledCount }),
                    Object.freeze({ value: "2", label: "已停用", count: referenceDataDisabledCount })
                ]),
                actions: Object.freeze([Object.freeze({ id: "new", label: `新增${referenceDataModule.itemName}`, icon: "ri-add-line", primary: true })]),
                resetLabel: "重置",
                messages: Object.freeze({
                    selectProject: "选择数据", viewProject: "查看数据", editProject: "编辑数据", moreActions: "更多操作",
                    filtersReset: "筛选条件已重置", treePrefix: "业务模块", expandLeftRegion: "展开业务模块",
                    collapseLeftRegion: "收起业务模块", filterActivated: "筛选工具栏已激活",
                    newOpened: `已打开新增${referenceDataModule.itemName}窗口`, exportPreparing: "正在准备导出",
                    dateRange: "日期范围：{start} 至 {end}", movePrefix: "移动到"
                })
            }),
            search: Object.freeze({
                gridId: referenceDataGridId, label: `${referenceDataModule.name}搜索`,
                placeholder: `搜索${referenceDataModule.name}编码或多语言名称…`, buttonLabel: "查询", clearLabel: "清空搜索条件",
                icon: "ri-search-line", buttonIcon: "ri-search-line", clearIcon: "ri-close-line",
                defaultValue: "", clearable: true, submitOnEnter: true, submitOnClear: true, allowEmpty: true, trim: true
            }),
            tree: Object.freeze({
                gridId: referenceDataGridId, ariaLabel: "业务模块导航", heading: "业务模块",
                summary: `${referenceDataNavigationModuleList.length} 个一级模块`, expandLabelTemplate: "展开{label}", collapseLabelTemplate: "收起{label}",
                contextMenuLabelTemplate: "{label}操作",
                selectedId: `module-${referenceDataModule.key === "columns" ? "tables" : referenceDataModule.key}`,
                items: Object.freeze(referenceDataTreeItems)
            }),
            menu: Object.freeze({ gridId: referenceDataGridId, ariaLabel: `${referenceDataModule.name}行操作` }),
            pagination: Object.freeze({
                gridId: referenceDataGridId, currentPage: 1, pageSize: 20, totalCount: referenceDataRecords.length,
                summaryAll: "共 {total} 条", summaryFiltered: "当前 {visible} 条 · 共 {total} 条",
                previousLabel: "上一页", nextLabel: "下一页", pageChangedMessage: "已切换到第 {page} 页",
                pageSizeChangedMessage: `每页显示 {size} 条${referenceDataModule.itemName}`
            }),
            select: Object.freeze({
                projectType: Object.freeze({
                    gridId: referenceDataGridId, role: "type-filter", label: referenceDataModule.key === "options" ? "选项预览" : "数据范围",
                    ariaLabel: referenceDataModule.key === "options" ? "预览并筛选下拉选项" : "按数据范围筛选",
                    currentTemplate: "{label}，当前：{value}", menuTitle: referenceDataModule.key === "options" ? "下拉选项预览" : "选择数据范围",
                    prefix: referenceDataModule.key === "options" ? "选项：" : "范围：", scrollAfter: 8,
                    options: Object.freeze([
                        Object.freeze({ value: "", label: "全部数据", icon: "ri-apps-2-line", description: "显示当前模块全部记录" }),
                        ...referenceDataTypeOptions
                    ])
                }),
                status: Object.freeze({
                    gridId: referenceDataGridId, role: "status-filter", label: "数据状态", ariaLabel: "按状态筛选",
                    currentTemplate: "{label}，当前：{value}", menuTitle: "选择数据状态", prefix: "状态：", scrollAfter: 6,
                    options: Object.freeze([
                        Object.freeze({ value: "", label: "全部状态", icon: "ri-apps-2-line", description: "显示全部记录" }),
                        Object.freeze({ value: "1", label: "已启用", icon: "ri-checkbox-circle-line", tone: "done", description: "当前可以使用" }),
                        Object.freeze({ value: "2", label: "已停用", icon: "ri-forbid-2-line", tone: "muted", description: "当前暂停使用" })
                    ])
                }),
                pageSize: Object.freeze({
                    gridId: referenceDataGridId, role: "page-size", label: "每页显示条数", ariaLabel: "每页显示条数",
                    currentTemplate: "{label}，当前：{value}", menuTitle: "选择每页显示条数", scrollAfter: 4,
                    options: Object.freeze([
                        Object.freeze({ value: "10", label: "10 条/页", icon: "ri-list-check-3" }),
                        Object.freeze({ value: "20", label: "20 条/页", icon: "ri-list-check-3", selected: true }),
                        Object.freeze({ value: "50", label: "50 条/页", icon: "ri-list-check-3" })
                    ])
                })
            })
        });
    }

    function referenceDataStatusField() {
        return Object.freeze({ name: "status", label: "状态", type: "select", required: true, options: Object.freeze([
            Object.freeze({ value: "1", label: "启用", icon: "ri-checkbox-circle-line", tone: "done", selected: true }),
            Object.freeze({ value: "2", label: "停用", icon: "ri-forbid-2-line", tone: "muted" })
        ]) });
    }

    function referenceDataBooleanField(referenceDataName, referenceDataLabel, referenceDataDefaultTrue = false) {
        return Object.freeze({ name: referenceDataName, label: referenceDataLabel, type: "select", required: true, options: Object.freeze([
            Object.freeze({ value: "false", label: "否", icon: "ri-checkbox-blank-circle-line", selected: !referenceDataDefaultTrue }),
            Object.freeze({ value: "true", label: "是", icon: "ri-checkbox-circle-line", tone: "done", selected: referenceDataDefaultTrue })
        ]) });
    }

    function referenceDataTypeSelectField() {
        const referenceDataTypes = referenceDataState.records.get("types") || [];
        const referenceDataTypeOptions = referenceDataTypes.length > 0
            ? referenceDataTypes.map((referenceDataType) => Object.freeze({
                value: String(referenceDataType.id), label: String(referenceDataType.nameZh || referenceDataType.resourceCode),
                icon: "ri-database-2-line", description: `${referenceDataType.projectCode}/${referenceDataType.resourceCode}`
            }))
            : [Object.freeze({
                value: "", label: "暂无数据类型", icon: "ri-information-line",
                description: "请先新增并启用数据类型", disabled: true, selected: true
            })];
        return Object.freeze({
            name: "typeId", label: "所属数据类型", type: "select", required: true,
            options: Object.freeze(referenceDataTypeOptions)
        });
    }

    function referenceDataParentSelectField(referenceDataModule, referenceDataRecord) {
        const referenceDataRecords = (referenceDataState.records.get(referenceDataModule.key) || [])
            .filter((referenceDataCandidate) => Number(referenceDataCandidate.id) !== Number(referenceDataRecord?.id));
        return Object.freeze({
            name: "parentId", label: referenceDataModule.key === "tree" ? "父节点" : "父菜单", type: "select",
            options: Object.freeze([
                Object.freeze({ value: "", label: "无（顶级）", icon: "ri-subtract-line", selected: true }),
                ...referenceDataRecords.map((referenceDataCandidate) => Object.freeze({
                    value: String(referenceDataCandidate.id),
                    label: referenceDataRecordLabel(referenceDataModule, referenceDataCandidate),
                    icon: referenceDataModule.icon
                }))
            ])
        });
    }

    function referenceDataBuildWindowRows(referenceDataModule, referenceDataRecord = null) {
        const referenceDataText = (name, label, required = false, placeholder = "", maxLength = 200) => Object.freeze({
            name, label, type: "text", required, placeholder, maxLength, icon: "ri-edit-box-line"
        });
        const referenceDataTextarea = (name, label, placeholder = "") => Object.freeze({
            name, label, type: "textarea", placeholder, maxLength: 1000, icon: "ri-file-text-line"
        });
        const referenceDataSort = Object.freeze({ name: "sortnum", label: "排序值", type: "number", value: "0", icon: "ri-sort-number-asc" });
        if (referenceDataModule.key === "types") return Object.freeze([
            Object.freeze([referenceDataText("projectCode", "项目编码", true, "例如 reference-data", 64), referenceDataText("resourceCode", "资源编码", true, "例如 resource-kind", 64)]),
            Object.freeze([referenceDataText("nameZh", "中文名称", true), referenceDataText("nameJa", "日文名称")]),
            Object.freeze([referenceDataText("nameEn", "英文名称"), referenceDataStatusField()]),
            Object.freeze([referenceDataTextarea("descriptionZh", "中文说明"), referenceDataTextarea("descriptionJa", "日文说明")]),
            Object.freeze([referenceDataTextarea("descriptionEn", "英文说明"), referenceDataSort])
        ]);
        if (referenceDataModule.key === "tree") return Object.freeze([
            Object.freeze([referenceDataTypeSelectField(), referenceDataParentSelectField(referenceDataModule, referenceDataRecord)]),
            Object.freeze([referenceDataText("nodeCode", "节点编码", true, "例如 root"), referenceDataText("nodeValue", "节点值", true, "例如 ROOT")]),
            Object.freeze([referenceDataText("labelZh", "中文名称", true), referenceDataText("labelJa", "日文名称")]),
            Object.freeze([referenceDataText("labelEn", "英文名称"), referenceDataStatusField()]),
            Object.freeze([referenceDataTextarea("attributesJson", "扩展属性 JSON", "例如 {\"level\":1}"), referenceDataSort])
        ]);
        if (referenceDataModule.key === "options") return Object.freeze([
            Object.freeze([referenceDataTypeSelectField(), referenceDataText("optionValue", "选项值", true, "例如 TREE")]),
            Object.freeze([referenceDataText("groupCode", "分组编码"), referenceDataBooleanField("disabled", "禁止选择")]),
            Object.freeze([referenceDataText("labelZh", "中文名称", true), referenceDataText("labelJa", "日文名称")]),
            Object.freeze([referenceDataText("labelEn", "英文名称"), referenceDataStatusField()]),
            Object.freeze([referenceDataTextarea("attributesJson", "扩展属性 JSON"), referenceDataSort])
        ]);
        if (referenceDataModule.key === "menus") return Object.freeze([
            Object.freeze([referenceDataTypeSelectField(), referenceDataParentSelectField(referenceDataModule, referenceDataRecord)]),
            Object.freeze([referenceDataText("itemCode", "菜单编码", true, "例如 create"), referenceDataText("command", "业务命令", false, "例如 CREATE")]),
            Object.freeze([referenceDataText("icon", "图标类名", false, "例如 ri-add-line", 100), referenceDataBooleanField("disabled", "禁止执行")]),
            Object.freeze([referenceDataText("labelZh", "中文名称", true), referenceDataText("labelJa", "日文名称")]),
            Object.freeze([referenceDataText("labelEn", "英文名称"), referenceDataStatusField()]),
            Object.freeze([referenceDataTextarea("attributesJson", "扩展属性 JSON"), referenceDataSort])
        ]);
        if (referenceDataModule.key === "tables") return Object.freeze([
            Object.freeze([
                referenceDataText("projectName", "所属项目", true, "例如 reference-data", 100),
                referenceDataText("tableName", "对应业务数据表", true, "例如 ReferenceDataType", 100)
            ]),
            Object.freeze([
                referenceDataText("gridColumnId", "表格配置 ID", true, "例如 selGridTypeManagementId", 100),
                referenceDataText("pagePath", "所在页面", false, "例如 /reference-data/reference-data.html", 500)
            ]),
            Object.freeze([referenceDataTextarea("description", "表格描述"), referenceDataStatusField()]),
            Object.freeze([referenceDataSort])
        ]);
        return Object.freeze([
            Object.freeze([Object.freeze({
                name: "tableName", label: "对应业务数据表", type: "select", required: true,
                options: Object.freeze(referenceDataModuleList.map((referenceDataTargetModule) => Object.freeze({
                    value: referenceDataTargetModule.tableName, label: referenceDataTargetModule.name,
                    icon: referenceDataTargetModule.icon, description: referenceDataTargetModule.tableName
                })))
            }), referenceDataText("gridId", "SEL 表格实例 ID", true, "例如 selGridOptionManagementId", 100)]),
            Object.freeze([referenceDataText("gridColumnId", "表格列 ID", true, "例如 labelZh", 100), referenceDataText("tableFieldName", "绑定字段", true, "例如 labelZh", 100)]),
            Object.freeze([referenceDataText("tableSecondaryFieldName", "第二绑定字段", false, "仅 stack 渲染使用", 100), Object.freeze({
                name: "cellRenderer", label: "单元格渲染方式", type: "select", required: true, options: Object.freeze([
                    "text", "stack", "badge", "time", "boolean", "actions"
                ].map((referenceDataRenderer) => Object.freeze({ value: referenceDataRenderer, label: referenceDataRenderer, icon: "ri-layout-column-line" })))
            })]),
            Object.freeze([referenceDataText("cellIcon", "单元格图标", false, "例如 ri-database-line", 100), referenceDataBooleanField("cellIconVisible", "显示单元格图标")]),
            Object.freeze([referenceDataText("labelZh", "中文表头", true), referenceDataText("labelJa", "日文表头")]),
            Object.freeze([referenceDataText("labelEn", "英文表头"), referenceDataText("width", "列宽", true, "例如 160px 或 18%", 32)]),
            Object.freeze([referenceDataBooleanField("visible", "页面显示", true), referenceDataStatusField()]),
            Object.freeze([referenceDataSort])
        ]);
    }

    function referenceDataBuildEditWindow(referenceDataModule, referenceDataEditing, referenceDataRecord = null) {
        return Object.freeze({
            title: `${referenceDataEditing ? "编辑" : "新增"}${referenceDataModule.itemName}`,
            subtitle: referenceDataModule.description,
            closeLabel: `关闭${referenceDataEditing ? "编辑" : "新增"}${referenceDataModule.itemName}窗口`,
            cancelLabel: "取消", submitLabel: referenceDataEditing ? "保存修改" : `保存${referenceDataModule.itemName}`,
            validationMessage: "请完成全部必填字段", autoSuccess: false,
            rows: referenceDataBuildWindowRows(referenceDataModule, referenceDataRecord)
        });
    }

    async function referenceDataEnsureModuleLoaded(referenceDataModule, referenceDataForce = false) {
        if (!referenceDataForce && referenceDataState.loadedKeys.has(referenceDataModule.key)) return;
        referenceDataState.records.set(referenceDataModule.key, await referenceDataLoadAllRecords(referenceDataModule));
        referenceDataState.loadedKeys.add(referenceDataModule.key);
    }

    async function referenceDataLoadResolvedColumns(referenceDataModule, referenceDataForce = false) {
        if (!referenceDataForce && referenceDataState.columns.has(referenceDataModule.key)) return;
        referenceDataState.columns.set(referenceDataModule.key, await referenceDataResolveColumns(referenceDataModule));
    }

    async function referenceDataLoadModuleView(referenceDataModule, referenceDataReloadRecords = false, referenceDataReloadColumns = false) {
        // 数据记录与表头配置彼此独立，必须并行请求，避免每次切换模块串行等待两次接口。
        await Promise.all([
            referenceDataEnsureModuleLoaded(referenceDataModule, referenceDataReloadRecords),
            referenceDataLoadResolvedColumns(referenceDataModule, referenceDataReloadColumns)
        ]);
    }

    function referenceDataEnsureTableDetailShell() {
        const referenceDataCenter = referenceDataState.panelRoot?.querySelector('[data-sel-panel-region="center"]');
        if (!referenceDataCenter) return null;
        const referenceDataExisting = referenceDataCenter.querySelector("[data-reference-data-table-detail]");
        if (referenceDataExisting) return referenceDataExisting;
        // 详情外壳只声明当前业务页面的固定结构；所有数据库数据使用 textContent 写入，避免解释为 HTML。
        const referenceDataDetail = document.createElement("section");
        referenceDataDetail.className = "reference-data-table-detail";
        referenceDataDetail.dataset.referenceDataTableDetail = "";
        referenceDataDetail.innerHTML = `
            <header class="reference-data-table-detail-header">
                <button type="button" class="reference-data-detail-back" data-reference-data-detail-action="back">
                    <i class="ri-arrow-left-line" aria-hidden="true"></i><span>返回表格定义</span>
                </button>
                <div class="reference-data-table-detail-copy">
                    <strong data-reference-data-detail-title></strong>
                    <span data-reference-data-detail-coordinate></span>
                </div>
                <button type="button" class="reference-data-detail-edit" data-reference-data-detail-action="edit-table">
                    <i class="ri-edit-line" aria-hidden="true"></i><span>编辑基本信息</span>
                </button>
            </header>
            <nav class="reference-data-detail-tabs" role="tablist" aria-label="表格配置详情">
                <button type="button" role="tab" data-reference-data-detail-tab="info">基本信息</button>
                <button type="button" role="tab" data-reference-data-detail-tab="columns">表格列配置</button>
                <button type="button" role="tab" data-reference-data-detail-tab="preview">效果预览</button>
            </nav>
            <section class="reference-data-detail-content" data-reference-data-detail-content="info"></section>
            <section class="reference-data-detail-content" data-reference-data-detail-content="preview"></section>`;
        // 固定按钮直接绑定，不依赖事件冒泡和点击目标转换，保证公共控件嵌套时仍能可靠响应。
        referenceDataDetail.querySelector('[data-reference-data-detail-action="back"]')
            .addEventListener("click", () => referenceDataReturnToTableList());
        referenceDataDetail.querySelector('[data-reference-data-detail-action="edit-table"]')
            .addEventListener("click", () => {
                if (!referenceDataState.selectedTable) return;
                referenceDataOpenEditor(referenceDataModules.tables, referenceDataState.selectedTable);
            });
        referenceDataDetail.querySelectorAll("[data-reference-data-detail-tab]").forEach((referenceDataTabButton) => {
            referenceDataTabButton.addEventListener("click", () => {
                referenceDataSetTableDetailTab(referenceDataTabButton.dataset.referenceDataDetailTab);
            });
        });
        const referenceDataGridBoard = referenceDataCenter.querySelector(".selgrid-board-shell");
        referenceDataCenter.insertBefore(referenceDataDetail, referenceDataGridBoard || null);
        return referenceDataDetail;
    }

    function referenceDataRenderTableInfo(referenceDataHost, referenceDataTable) {
        referenceDataHost.replaceChildren();
        const referenceDataFields = Object.freeze([
            Object.freeze(["所属项目", referenceDataTable.projectName]),
            Object.freeze(["业务数据表", referenceDataTable.tableName]),
            Object.freeze(["表格控件 ID", referenceDataTable.gridColumnId]),
            Object.freeze(["所在页面", referenceDataTable.pagePath || "未填写"]),
            Object.freeze(["启停状态", Number(referenceDataTable.status) === 1 ? "已启用" : "已停用"]),
            Object.freeze(["排序值", referenceDataTable.sortnum ?? 0]),
            Object.freeze(["租户 ID", referenceDataTable.tenantId ?? 1]),
            Object.freeze(["操作员 ID", referenceDataTable.lastOperateUserId ?? 1])
        ]);
        const referenceDataDescription = document.createElement("p");
        referenceDataDescription.className = "reference-data-detail-description";
        referenceDataDescription.textContent = String(referenceDataTable.description || "暂无表格描述");
        const referenceDataGrid = document.createElement("dl");
        referenceDataGrid.className = "reference-data-detail-info-grid";
        referenceDataFields.forEach(([referenceDataLabel, referenceDataValue]) => {
            const referenceDataItem = document.createElement("div");
            const referenceDataTerm = document.createElement("dt");
            const referenceDataDefinition = document.createElement("dd");
            referenceDataTerm.textContent = referenceDataLabel;
            referenceDataDefinition.textContent = String(referenceDataValue ?? "—");
            referenceDataItem.append(referenceDataTerm, referenceDataDefinition);
            referenceDataGrid.appendChild(referenceDataItem);
        });
        referenceDataHost.append(referenceDataDescription, referenceDataGrid);
    }

    function referenceDataRenderTablePreview(referenceDataHost, referenceDataTable) {
        referenceDataHost.replaceChildren();
        const referenceDataColumns = (referenceDataState.records.get("columns") || [])
            .filter((referenceDataColumn) =>
                String(referenceDataColumn.tableName) === String(referenceDataTable.tableName)
                && String(referenceDataColumn.gridId) === String(referenceDataTable.gridColumnId)
                && Number(referenceDataColumn.status) === 1
                && Boolean(referenceDataColumn.visible))
            .sort((referenceDataLeft, referenceDataRight) => Number(referenceDataLeft.sortnum) - Number(referenceDataRight.sortnum));
        if (referenceDataColumns.length === 0) {
            const referenceDataEmpty = document.createElement("div");
            referenceDataEmpty.className = "reference-data-detail-empty";
            referenceDataEmpty.innerHTML = '<i class="ri-layout-column-line" aria-hidden="true"></i><strong>该表格尚未配置显示列</strong>';
            const referenceDataAdd = document.createElement("button");
            referenceDataAdd.type = "button";
            referenceDataAdd.dataset.referenceDataDetailAction = "add-column";
            referenceDataAdd.textContent = "新增第一列";
            referenceDataAdd.addEventListener("click", () => {
                referenceDataSetTableDetailTab("columns");
                referenceDataOpenEditor(referenceDataModules.columns);
            });
            referenceDataEmpty.appendChild(referenceDataAdd);
            referenceDataHost.appendChild(referenceDataEmpty);
            return;
        }
        const referenceDataTableElement = document.createElement("table");
        referenceDataTableElement.className = "reference-data-detail-preview-table";
        const referenceDataHead = document.createElement("thead");
        const referenceDataHeadRow = document.createElement("tr");
        const referenceDataBody = document.createElement("tbody");
        const referenceDataFieldRow = document.createElement("tr");
        referenceDataColumns.forEach((referenceDataColumn) => {
            const referenceDataHeading = document.createElement("th");
            referenceDataHeading.textContent = String(referenceDataColumn.labelZh || referenceDataColumn.gridColumnId);
            referenceDataHeading.style.width = String(referenceDataColumn.width || "auto");
            const referenceDataField = document.createElement("td");
            referenceDataField.textContent = String(referenceDataColumn.tableFieldName || referenceDataColumn.gridColumnId);
            referenceDataHeadRow.appendChild(referenceDataHeading);
            referenceDataFieldRow.appendChild(referenceDataField);
        });
        referenceDataHead.appendChild(referenceDataHeadRow);
        referenceDataBody.appendChild(referenceDataFieldRow);
        referenceDataTableElement.append(referenceDataHead, referenceDataBody);
        referenceDataHost.appendChild(referenceDataTableElement);
    }

    function referenceDataRenderTableDetail() {
        const referenceDataGridBoard = referenceDataState.panelRoot?.querySelector(".selgrid-board-shell");
        if (!referenceDataState.selectedTable) {
            referenceDataState.panelRoot?.removeAttribute("data-reference-data-detail-tab");
            referenceDataState.panelRoot?.querySelector("[data-reference-data-table-detail]")?.remove();
            if (referenceDataGridBoard) referenceDataGridBoard.hidden = false;
            return;
        }
        const referenceDataDetail = referenceDataEnsureTableDetailShell();
        if (!referenceDataDetail) return;
        const referenceDataTab = referenceDataState.tableDetailTab || "columns";
        referenceDataState.panelRoot.dataset.referenceDataDetailTab = referenceDataTab;
        referenceDataDetail.querySelector("[data-reference-data-detail-title]").textContent =
            String(referenceDataState.selectedTable.description || referenceDataState.selectedTable.tableName);
        referenceDataDetail.querySelector("[data-reference-data-detail-coordinate]").textContent =
            `${referenceDataState.selectedTable.projectName} · ${referenceDataState.selectedTable.gridColumnId}`;
        referenceDataDetail.querySelectorAll("[data-reference-data-detail-tab]").forEach((referenceDataButton) => {
            const referenceDataSelected = referenceDataButton.dataset.referenceDataDetailTab === referenceDataTab;
            referenceDataButton.setAttribute("aria-selected", String(referenceDataSelected));
            referenceDataButton.tabIndex = referenceDataSelected ? 0 : -1;
        });
        const referenceDataInfo = referenceDataDetail.querySelector('[data-reference-data-detail-content="info"]');
        const referenceDataPreview = referenceDataDetail.querySelector('[data-reference-data-detail-content="preview"]');
        referenceDataInfo.hidden = referenceDataTab !== "info";
        referenceDataPreview.hidden = referenceDataTab !== "preview";
        if (referenceDataGridBoard) referenceDataGridBoard.hidden = referenceDataTab !== "columns";
        if (referenceDataTab === "info") referenceDataRenderTableInfo(referenceDataInfo, referenceDataState.selectedTable);
        if (referenceDataTab === "preview") referenceDataRenderTablePreview(referenceDataPreview, referenceDataState.selectedTable);
    }

    function referenceDataSetTableDetailTab(referenceDataTab) {
        if (!referenceDataState.selectedTable || !["info", "columns", "preview"].includes(referenceDataTab)) return;
        referenceDataState.tableDetailTab = referenceDataTab;
        referenceDataRenderTableDetail();
    }

    function referenceDataApplyPayload(referenceDataPayload) {
        if (referenceDataState.panelRoot) window.selPanel.setLocale(referenceDataState.panelRoot, { view: referenceDataPayload });
        referenceDataState.searchController?.setLocale(referenceDataPayload.search);
        referenceDataState.treeController?.setLocale(referenceDataPayload.tree);
        referenceDataState.gridController?.setLocale(referenceDataPayload);
        referenceDataState.gridController?.reset();
        window.selDropdownMenu.mountAll(referenceDataState.panelRoot);
        referenceDataRenderTableDetail();
        referenceDataSyncPageEditorControl();
    }

    async function referenceDataRefresh(referenceDataReloadActive = true, referenceDataReloadColumns = false) {
        await referenceDataLoadModuleView(referenceDataActiveModule(), referenceDataReloadActive, referenceDataReloadColumns);
        referenceDataApplyPayload(referenceDataBuildPayload());
    }

    async function referenceDataSwitchModule(referenceDataKey) {
        if (!referenceDataModules[referenceDataKey]) return;
        // 编辑会话中禁止业务模块悄悄切换，管理员先保存或取消后再改变数据库坐标。
        if (referenceDataState.personalizationController?.getState().pageEditor?.mode === "edit") {
            referenceDataBase.toast("请先保存或取消当前页面更改。", "warning");
            return;
        }
        if (referenceDataState.activeKey === referenceDataKey && referenceDataState.loadedKeys.has(referenceDataKey)) return;
        // 离开表格列详情时释放当前表格上下文，返回表格定义列表或其他业务模块。
        if (referenceDataKey !== "columns") {
            referenceDataState.selectedTable = null;
            referenceDataState.tableDetailTab = null;
        }
        referenceDataState.activeKey = referenceDataKey;
        referenceDataState.editingId = null;
        // 已加载模块立即显示；首次进入时记录和表头并行加载，减少一半串行等待。
        if (referenceDataState.loadedKeys.has(referenceDataKey) && referenceDataState.columns.has(referenceDataKey)) {
            referenceDataApplyPayload(referenceDataBuildPayload());
            return;
        }
        // 首次进入也先切换页面并展示加载态，避免后端响应期间按钮看起来没有生效。
        const referenceDataTargetModule = referenceDataActiveModule();
        referenceDataApplyPayload(referenceDataBuildPayload());
        await referenceDataLoadModuleView(referenceDataTargetModule);
        // 用户在请求期间可能继续切换模块；旧请求完成后不得覆盖新的页面状态。
        if (referenceDataState.activeKey === referenceDataKey) {
            referenceDataApplyPayload(referenceDataBuildPayload());
        }
    }

    function referenceDataReturnToTableList() {
        // 返回动作先使用已加载的表格定义和表头立即重绘，避免等待接口时表现为按钮失效。
        referenceDataState.selectedTable = null;
        referenceDataState.tableDetailTab = null;
        referenceDataState.activeKey = "tables";
        referenceDataState.editingId = null;
        referenceDataApplyPayload(referenceDataBuildPayload());
    }

    function referenceDataFindRecord(referenceDataModule, referenceDataId) {
        return (referenceDataState.records.get(referenceDataModule.key) || [])
            .find((referenceDataRecord) => Number(referenceDataRecord.id) === Number(referenceDataId)) || null;
    }

    function referenceDataOpenEditor(referenceDataModule, referenceDataRecord = null) {
        referenceDataState.editingId = referenceDataRecord ? Number(referenceDataRecord.id) : null;
        const referenceDataController = referenceDataState.editWindowControllers.get(referenceDataModule.key);
        referenceDataController.setLocale(referenceDataBuildEditWindow(referenceDataModule, Boolean(referenceDataRecord), referenceDataRecord));
        referenceDataController.reset();
        if (referenceDataRecord) {
            referenceDataController.setValues(referenceDataRecord);
        } else if (referenceDataModule.key === "columns" && referenceDataState.selectedTable) {
            // 从表格详情新增列时自动绑定主表坐标，用户只需维护列本身。
            referenceDataController.setValues({
                tableName: referenceDataState.selectedTable.tableName,
                gridId: referenceDataState.selectedTable.gridColumnId
            });
        }
        referenceDataController.open();
    }

    async function referenceDataBuildDeleteMessage(referenceDataModule, referenceDataRecord) {
        if (referenceDataModule.key !== "tables") {
            return `删除仅将此${referenceDataModule.itemName}标记为已删除，不会物理移除数据库记录。`;
        }
        // 表格定义与列配置通过 tableName + gridId 形成逻辑关联；确认文案必须展示当前真实数量。
        await referenceDataEnsureModuleLoaded(referenceDataModules.columns);
        const referenceDataAssociatedColumnCount = (referenceDataState.records.get("columns") || [])
            .filter((referenceDataColumn) => Number(referenceDataColumn.status) !== 0
                && String(referenceDataColumn.tableName) === String(referenceDataRecord.tableName)
                && String(referenceDataColumn.gridId) === String(referenceDataRecord.gridColumnId))
            .length;
        return `当前关联 ${referenceDataAssociatedColumnCount} 个表格列配置。删除仅停用表格定义，不会删除列配置。`;
    }

    async function referenceDataConfirmAndDelete(referenceDataModule, referenceDataRecord) {
        const referenceDataDeleteMessage = await referenceDataBuildDeleteMessage(referenceDataModule, referenceDataRecord);
        const referenceDataConfirmed = await referenceDataState.deleteConfirmController.open({
            title: `删除${referenceDataModule.itemName}`,
            message: referenceDataDeleteMessage,
            target: referenceDataRecordLabel(referenceDataModule, referenceDataRecord),
            icon: "ri-delete-bin-6-line",
            tone: "danger",
            closeLabel: `关闭删除${referenceDataModule.itemName}确认框`,
            cancelLabel: "取消",
            confirmLabel: "确认删除"
        });
        if (!referenceDataConfirmed) return false;
        return referenceDataDelete(referenceDataModule, Number(referenceDataRecord.id));
    }

    async function referenceDataSave(referenceDataModule, referenceDataValues) {
        const referenceDataController = referenceDataState.editWindowControllers.get(referenceDataModule.key);
        referenceDataController.setLoading(true);
        referenceDataController.setFeedback(`正在保存${referenceDataModule.itemName}…`);
        try {
            const referenceDataResult = await referenceDataAjax.request({
                url: `${referenceDataModule.api}${referenceDataState.editingId ? "update.htm" : "create.htm"}`,
                method: "POST",
                data: referenceDataState.editingId ? { ...referenceDataValues, id: referenceDataState.editingId } : referenceDataValues
            });
            referenceDataController.setFeedback(referenceDataResult.msg || `${referenceDataModule.itemName}保存完成。`);
            // 从详情页编辑主表时先刷新主表缓存，再恢复当前选中记录；列写入只刷新列模块。
            await Promise.all([
                referenceDataEnsureModuleLoaded(referenceDataModule, true),
                referenceDataModule.key === "columns"
                    ? referenceDataLoadResolvedColumns(referenceDataModules.columns, true)
                    : Promise.resolve()
            ]);
            if (referenceDataModule.key === "tables" && referenceDataState.selectedTable) {
                referenceDataState.selectedTable = referenceDataFindRecord(
                    referenceDataModules.tables, referenceDataState.selectedTable.id
                ) || referenceDataState.selectedTable;
            }
            referenceDataApplyPayload(referenceDataBuildPayload());
            referenceDataController.close();
            referenceDataState.editingId = null;
        } catch (referenceDataError) {
            referenceDataController.setFeedback(referenceDataError.message || `${referenceDataModule.itemName}保存失败。`, true);
        } finally {
            referenceDataController.setLoading(false);
        }
    }

    async function referenceDataDelete(referenceDataModule, referenceDataId) {
        referenceDataSetFeedback(`正在删除${referenceDataModule.itemName}…`);
        try {
            const referenceDataResult = await referenceDataAjax.request({
                url: `${referenceDataModule.api}delete.htm`, method: "POST", data: { id: referenceDataId }
            });
            await referenceDataRefresh(true, referenceDataModule.key === "columns");
            referenceDataSetFeedback(referenceDataResult.msg || `${referenceDataModule.itemName}删除完成。`);
            return true;
        } catch (referenceDataError) {
            referenceDataSetFeedback(referenceDataError.message || `${referenceDataModule.itemName}删除失败。`);
            console.error("引用数据删除失败。", referenceDataError);
            return false;
        }
    }

    async function referenceDataToggle(referenceDataModule, referenceDataRecord) {
        const referenceDataNextStatus = Number(referenceDataRecord.status) === 1 ? 2 : 1;
        referenceDataSetFeedback(`正在切换${referenceDataModule.itemName}状态…`);
        await referenceDataAjax.request({
            url: `${referenceDataModule.api}update.htm`, method: "POST",
            // 状态操作只提交主键和目标状态，禁止把时间、审计等只读字段重新写回更新接口。
            data: { id: referenceDataRecord.id, status: referenceDataNextStatus }
        });
        await referenceDataRefresh(true, referenceDataModule.key === "columns");
        referenceDataSetFeedback(`${referenceDataModule.itemName}状态已更新。`);
    }

    async function referenceDataOpenTableColumns(referenceDataRecord) {
        // 主表记录成为详情上下文；列模块仍按需加载且只展示 tableName + gridId 对应记录。
        referenceDataState.selectedTable = Object.freeze({ ...referenceDataRecord });
        referenceDataState.tableDetailTab = "columns";
        await referenceDataSwitchModule("columns");
        // 已经位于列模块时 switch 会复用缓存，因此仍需按新主表上下文重建当前表格数据。
        referenceDataApplyPayload(referenceDataBuildPayload());
    }

    async function referenceDataPreview(referenceDataModule, referenceDataRecord) {
        if (referenceDataModule.key === "tables") {
            await referenceDataOpenTableColumns(referenceDataRecord);
            return;
        }
        if (referenceDataModule.key === "tree") {
            referenceDataState.treeController?.select(`record-tree-${referenceDataRecord.id}`);
            return;
        }
        if (referenceDataModule.key === "options") {
            const referenceDataDropdown = referenceDataState.panelRoot?.querySelector('[data-sel-panel-slot="projectType"]');
            if (referenceDataDropdown) window.selDropdownMenu.setValue(referenceDataDropdown, String(referenceDataRecord.optionValue), true);
            return;
        }
        if (referenceDataModule.key === "menus") {
            const referenceDataMenuItems = (referenceDataState.records.get("menus") || [])
                .filter((referenceDataMenuRecord) => Number(referenceDataMenuRecord.typeId) === Number(referenceDataRecord.typeId) && Number(referenceDataMenuRecord.status) === 1)
                .map((referenceDataMenuRecord) => Object.freeze({
                    id: String(referenceDataMenuRecord.command || referenceDataMenuRecord.itemCode),
                    label: String(referenceDataMenuRecord.labelZh || referenceDataMenuRecord.itemCode),
                    icon: String(referenceDataMenuRecord.icon || "ri-menu-line"),
                    disabled: Boolean(referenceDataMenuRecord.disabled)
                }));
            referenceDataState.previewMenuController.open({
                clientX: Math.max(24, document.documentElement.clientWidth - 320),
                clientY: 220,
                focusFirst: true,
                ariaLabel: "数据库菜单预览",
                context: Object.freeze({ typeId: referenceDataRecord.typeId }),
                items: referenceDataMenuItems
            });
        }
    }

    async function referenceDataHandleAction(referenceDataModule, referenceDataAction, referenceDataRecord) {
        if (!referenceDataRecord) return;
        if (referenceDataAction === "edit") referenceDataOpenEditor(referenceDataModule, referenceDataRecord);
        if (referenceDataAction === "delete") await referenceDataConfirmAndDelete(referenceDataModule, referenceDataRecord);
        if (referenceDataAction === "preview") await referenceDataPreview(referenceDataModule, referenceDataRecord);
        if (referenceDataAction === "toggle") {
            try {
                await referenceDataToggle(referenceDataModule, referenceDataRecord);
            } catch (referenceDataError) {
                referenceDataSetFeedback(referenceDataError.message || `${referenceDataModule.itemName}状态切换失败。`);
                console.error("引用数据状态切换失败。", referenceDataError);
            }
        }
    }

    function referenceDataParseTreeRecordId(referenceDataTreeId) {
        const referenceDataMatch = String(referenceDataTreeId || "").match(/^record-(types|tree|options|menus|tables|columns)-([0-9]+)$/);
        return referenceDataMatch ? Object.freeze({ moduleKey: referenceDataMatch[1], id: Number(referenceDataMatch[2]) }) : null;
    }

    async function referenceDataMountApplication() {
        const referenceDataWindowMessagesPromise = referenceDataAjax.json({ url: referenceDataWindowMessagesUrl });
        const referenceDataPageEditorCapabilityPromise = referenceDataAjax.request({
            url: "/api/reference-data/admin/table-columns/page-editor-capability.htm"
        }).catch((referenceDataCapabilityError) => {
            console.warn("页面编辑权限读取失败，本次按无权限处理。", referenceDataCapabilityError);
            return Object.freeze({ data: Object.freeze({ canEditPage: false }) });
        });
        await referenceDataLoadNavigation();
        await referenceDataLoadModuleView(referenceDataActiveModule());
        const referenceDataWindowMessages = await referenceDataWindowMessagesPromise;
        const referenceDataPayload = referenceDataBuildPayload();
        referenceDataState.panelRoot = window.selPanel.create(referenceDataApplicationHost, {
            gridId: referenceDataGridId, sourceId: referenceDataGridId, entity: "ReferenceDataWorkbench",
            view: "five-module-lazy-management", layout: "single", structure: referenceDataLayout, ariaLabel: referenceDataPayload.title.ariaLabel
        });
        if (!referenceDataState.panelRoot) throw new Error("引用数据公共面板创建失败。");
        if (!window.selPanel.mount(referenceDataState.panelRoot, {
            view: referenceDataPayload,
            expandLeftLabel: referenceDataPayload.title.messages.expandLeftRegion,
            collapseLeftLabel: referenceDataPayload.title.messages.collapseLeftRegion,
            toolbar: referenceDataToolbar
        })) throw new Error("引用数据公共面板挂载失败。");
        referenceDataState.searchController = window.selSearch.mount(referenceDataState.panelRoot, referenceDataPayload.search);
        if (!referenceDataState.searchController) throw new Error("引用数据搜索控件挂载失败。");
        referenceDataState.treeController = window.selTree.mount(referenceDataState.panelRoot, referenceDataPayload.tree);
        if (!referenceDataState.treeController) throw new Error("引用数据导航树挂载失败。");
        window.selDropdownMenu.mountAll(referenceDataState.panelRoot);
        referenceDataState.gridController = window.selGrid.mount(referenceDataState.panelRoot, referenceDataPayload);
        if (!referenceDataState.gridController) throw new Error("引用数据表格挂载失败。");

        referenceDataModuleList.forEach((referenceDataModule) => {
            const referenceDataController = window.selWindow.mount(referenceDataApplicationHost, {
                id: referenceDataModule.windowId, messages: referenceDataWindowMessages,
                ...referenceDataBuildEditWindow(referenceDataModule, false)
            });
            if (!referenceDataController) throw new Error(`${referenceDataModule.name}编辑窗口挂载失败。`);
            referenceDataState.editWindowControllers.set(referenceDataModule.key, referenceDataController);
        });
        referenceDataState.deleteConfirmController = window.selConfirmDialog.mount(referenceDataApplicationHost, {
            id: "selConfirmDialogReferenceDataDeleteId", title: "删除引用数据", tone: "danger"
        });
        referenceDataState.pageEditConfirmController = window.selConfirmDialog.mount(referenceDataApplicationHost, {
            id: "selConfirmDialogReferenceDataPageEditId", title: "取消页面更改", tone: "danger"
        });
        referenceDataState.previewMenuController = window.selContextMenu.mount(referenceDataState.panelRoot, {
            id: "selContextMenuReferenceDataPreviewId", ariaLabel: "数据库菜单预览"
        });
        if (!referenceDataState.deleteConfirmController || !referenceDataState.pageEditConfirmController || !referenceDataState.previewMenuController) {
            throw new Error("引用数据确认或预览组件挂载失败。");
        }

        const referenceDataPageEditorCapability = await referenceDataPageEditorCapabilityPromise;
        referenceDataState.personalizationController = window.selPersonalization.mount(referenceDataPersonalizationHost, {
            backgroundController: referenceDataBackgroundController,
            pageEditor: Object.freeze({
                canEdit: referenceDataPageEditorCapability.data?.canEditPage === true,
                confirmDiscard: () => referenceDataState.pageEditConfirmController.open({
                    title: "取消页面更改",
                    message: "当前表格宽度尚未保存，取消后会恢复进入编辑模式前的宽度。",
                    target: `${referenceDataActiveModule().tableName} · ${referenceDataActiveModule().gridId}`,
                    confirmLabel: "取消更改",
                    cancelLabel: "继续编辑",
                    icon: "ri-arrow-go-back-line"
                })
            })
        });
        if (!referenceDataState.personalizationController) throw new Error("引用数据个性化设置挂载失败。");
        const referenceDataGridEditHost = referenceDataState.panelRoot.querySelector(".selgrid-board-shell");
        if (!referenceDataState.personalizationController.registerPageControl({
            id: "selGridReferenceDataPageEditorId",
            type: "grid",
            typeLabel: "表格控件",
            title: `${referenceDataActiveModule().name}表格`,
            icon: "ri-table-line",
            root: referenceDataState.panelRoot,
            editHost: referenceDataGridEditHost,
            coordinates: referenceDataPageEditorCoordinates(),
            changeEvent: "selGrid:columnResizeChange",
            captureState: referenceDataCapturePageGridState,
            restoreState: referenceDataRestorePageGridState,
            saveState: referenceDataSavePageGridState
        })) throw new Error("引用数据表格页面编辑登记失败。");

        referenceDataState.panelRoot.addEventListener("selGrid:new", () => referenceDataOpenEditor(referenceDataActiveModule()));
        referenceDataState.panelRoot.addEventListener("selGrid:action", async (referenceDataEvent) => {
            const referenceDataDetail = referenceDataEvent.detail;
            if (!referenceDataDetail || referenceDataDetail.instanceKey !== referenceDataGridId) return;
            await referenceDataHandleAction(referenceDataActiveModule(), referenceDataDetail.action, referenceDataDetail.record);
        });
        referenceDataState.panelRoot.addEventListener("selTree:select", async (referenceDataEvent) => {
            const referenceDataTreeId = String(referenceDataEvent.detail?.id || "");
            if (referenceDataTreeId.startsWith("module-")) {
                await referenceDataSwitchModule(referenceDataTreeId.slice(7));
                return;
            }
            const referenceDataTarget = referenceDataParseTreeRecordId(referenceDataTreeId);
            if (!referenceDataTarget) return;
            if (referenceDataTarget.moduleKey === "tables") {
                const referenceDataTableRecord = referenceDataFindRecord(referenceDataModules.tables, referenceDataTarget.id);
                if (referenceDataTableRecord) await referenceDataOpenTableColumns(referenceDataTableRecord);
                return;
            }
            if (referenceDataState.activeKey !== referenceDataTarget.moduleKey) await referenceDataSwitchModule(referenceDataTarget.moduleKey);
            const referenceDataRecord = referenceDataFindRecord(referenceDataModules[referenceDataTarget.moduleKey], referenceDataTarget.id);
            if (referenceDataRecord) referenceDataState.gridController.filters.setSearch(referenceDataRecord[referenceDataModules[referenceDataTarget.moduleKey].previewField] || "");
        });
        referenceDataState.panelRoot.addEventListener("selTree:contextAction", async (referenceDataEvent) => {
            const referenceDataTarget = referenceDataParseTreeRecordId(referenceDataEvent.detail?.id);
            if (!referenceDataTarget) return;
            if (referenceDataState.activeKey !== referenceDataTarget.moduleKey) await referenceDataSwitchModule(referenceDataTarget.moduleKey);
            const referenceDataModule = referenceDataModules[referenceDataTarget.moduleKey];
            await referenceDataHandleAction(referenceDataModule, referenceDataEvent.detail.action, referenceDataFindRecord(referenceDataModule, referenceDataTarget.id));
        });
        referenceDataApplicationHost.addEventListener("selWindow:submit", (referenceDataEvent) => {
            const referenceDataModule = referenceDataModuleList.find(
                (referenceDataCandidate) => referenceDataEvent.detail?.id === referenceDataCandidate.windowId
            );
            if (referenceDataModule) referenceDataSave(referenceDataModule, referenceDataEvent.detail.values);
        });
        referenceDataState.panelRoot.addEventListener("selContextMenu:action", (referenceDataEvent) => {
            if (referenceDataEvent.detail?.menuId !== "selContextMenuReferenceDataPreviewId") return;
            const referenceDataFeedback = referenceDataState.panelRoot.querySelector('[data-sel-grid-role="feedback"]');
            if (referenceDataFeedback) referenceDataFeedback.textContent = `已选择菜单命令：${referenceDataEvent.detail.actionId}`;
        });
    }

    const referenceDataBackgroundController = window.selPageBackground.mount(referenceDataBackgroundHost, {
        defaults: Object.freeze({ theme: "solid-dark", overlay: 0, brightness: 100, blur: 0 })
    });
    if (!referenceDataBackgroundController) throw new Error("引用数据页面背景挂载失败。");

    referenceDataMountApplication().catch((referenceDataError) => {
        console.error("引用数据管理初始化失败。", referenceDataError);
        throw referenceDataError;
    });
}());
