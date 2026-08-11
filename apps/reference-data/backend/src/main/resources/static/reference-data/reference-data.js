/*
 * reference-data.js：引用数据六表管理工作台装配层。
 * 真实数据来自六张业务表，ReferenceDataTable 登记表格，表格列来自 ReferenceDataTableColumn。
 */
(function referenceDataInitializeApplication() {
    "use strict";

    const referenceDataRequiredComponents = Object.freeze([
        "selBaseRuntime", "selAjax", "selPanel", "selSearch", "selTooltip", "selTree", "selDropdownMenu",
        "selGrid", "selWindow", "selContextMenu", "selPageBackground", "selPersonalization", "selThemeManager"
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
        pendingDelete: null,
        panelRoot: null,
        searchController: null,
        gridController: null,
        treeController: null,
        editWindowControllers: new Map(),
        deleteWindowController: null,
        previewMenuController: null
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
        if (referenceDataTotalPages === 1) return Array.isArray(referenceDataFirstPage.records) ? referenceDataFirstPage.records : [];
        const referenceDataOtherPages = await Promise.all(
            Array.from({ length: referenceDataTotalPages - 1 }, (_, referenceDataIndex) => referenceDataAjax.json({
                url: `${referenceDataModule.api}getStore.htm?pageNo=${referenceDataIndex + 2}&pageSize=${referenceDataPageSize}`
            }))
        );
        return [referenceDataFirstPage, ...referenceDataOtherPages].flatMap((referenceDataPage) => referenceDataPage.records || []);
    }

    async function referenceDataResolveColumns(referenceDataModule) {
        const referenceDataQuery = new URLSearchParams({
            tableName: referenceDataModule.tableName,
            gridId: referenceDataModule.gridId,
            locale: referenceDataLocale
        });
        const referenceDataResult = await referenceDataAjax.request({
            url: `/api/reference-data/admin/table-columns/resolve.htm?${referenceDataQuery}`
        });
        return Array.isArray(referenceDataResult.data?.columns) ? referenceDataResult.data.columns : [];
    }

    function referenceDataSafeColumns(referenceDataModule) {
        if (referenceDataModule.key === "tables") return Object.freeze([
            Object.freeze({ id: "tableName", field: "tableName", label: "数据库表", renderer: "text", width: "22%" }),
            Object.freeze({ id: "gridColumnId", field: "gridColumnId", label: "表格配置 ID", renderer: "text", width: "24%" }),
            Object.freeze({ id: "projectName", field: "projectName", label: "所属项目", renderer: "text", width: "16%" }),
            Object.freeze({ id: "description", field: "description", label: "表格描述", renderer: "text", width: "22%" }),
            Object.freeze({ id: "actions", field: "id", label: "操作", renderer: "actions", width: "16%" })
        ]);
        const referenceDataPrimary = referenceDataModule.previewField;
        return Object.freeze([
            Object.freeze({ id: "primary", field: referenceDataPrimary, label: "数据编码", renderer: "text", width: "34%" }),
            Object.freeze({ id: "labelZh", field: "labelZh", label: "中文名称", renderer: "text", width: "28%" }),
            Object.freeze({ id: "status", field: "status", label: "状态", renderer: "badge", width: "14%" }),
            Object.freeze({ id: "actions", field: "id", label: "操作", renderer: "actions", width: "24%" })
        ]);
    }

    function referenceDataEnrichColumns(referenceDataModule, referenceDataColumns) {
        const referenceDataSource = referenceDataColumns.length > 0 ? referenceDataColumns : referenceDataSafeColumns(referenceDataModule);
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
                        label: referenceDataModule.key === "tables" ? "查看表格头" : `预览${referenceDataModule.itemName}`,
                        icon: "ri-eye-line"
                    }));
                }
                referenceDataActions.push(
                    Object.freeze({ id: "toggle", label: "切换启停状态", icon: "ri-checkbox-circle-line" }),
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
        const referenceDataRecords = referenceDataState.records.get(referenceDataModule.key) || [];
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
                emptyText: `没有符合当前条件的${referenceDataModule.name}记录`,
                items: referenceDataColumns
            }),
            title: Object.freeze({
                title: "引用数据管理工作台",
                subtitle: `${referenceDataModule.name} · ${referenceDataModule.tableName}`,
                description: referenceDataModule.description,
                ariaLabel: "引用数据五模块按需加载管理面板",
                ariaLabels: Object.freeze({
                    statusTabs: `${referenceDataModule.name}状态筛选`, headerActions: `${referenceDataModule.name}快捷操作`,
                    toolbar: `${referenceDataModule.name}筛选工具栏`, sidebar: "数据库模块导航",
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
                    filtersReset: "筛选条件已重置", treePrefix: "数据库模块", expandLeftRegion: "展开数据库模块",
                    collapseLeftRegion: "收起数据库模块", filterActivated: "筛选工具栏已激活",
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
                gridId: referenceDataGridId, ariaLabel: "数据库模块导航", heading: "数据库模块",
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
        return Object.freeze({
            name: "typeId", label: "所属数据类型", type: "select", required: true,
            options: Object.freeze(referenceDataTypes.map((referenceDataType) => Object.freeze({
                value: String(referenceDataType.id), label: String(referenceDataType.nameZh || referenceDataType.resourceCode),
                icon: "ri-database-2-line", description: `${referenceDataType.projectCode}/${referenceDataType.resourceCode}`
            })))
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
        const referenceDataAuditRow = Object.freeze([
            Object.freeze({ name: "tenantId", label: "租户 ID", type: "number", required: true, value: "1", icon: "ri-building-line" }),
            Object.freeze({ name: "lastOperateUserId", label: "操作员 ID", type: "number", required: true, value: "1", icon: "ri-user-settings-line" })
        ]);
        if (referenceDataModule.key === "types") return Object.freeze([
            Object.freeze([referenceDataText("projectCode", "项目编码", true, "例如 reference-data", 64), referenceDataText("resourceCode", "资源编码", true, "例如 resource-kind", 64)]),
            Object.freeze([referenceDataText("nameZh", "中文名称", true), referenceDataText("nameJa", "日文名称")]),
            Object.freeze([referenceDataText("nameEn", "英文名称"), referenceDataStatusField()]),
            Object.freeze([referenceDataTextarea("descriptionZh", "中文说明"), referenceDataTextarea("descriptionJa", "日文说明")]),
            Object.freeze([referenceDataTextarea("descriptionEn", "英文说明"), referenceDataSort]),
            referenceDataAuditRow
        ]);
        if (referenceDataModule.key === "tree") return Object.freeze([
            Object.freeze([referenceDataTypeSelectField(), referenceDataParentSelectField(referenceDataModule, referenceDataRecord)]),
            Object.freeze([referenceDataText("nodeCode", "节点编码", true, "例如 root"), referenceDataText("nodeValue", "节点值", true, "例如 ROOT")]),
            Object.freeze([referenceDataText("labelZh", "中文名称", true), referenceDataText("labelJa", "日文名称")]),
            Object.freeze([referenceDataText("labelEn", "英文名称"), referenceDataStatusField()]),
            Object.freeze([referenceDataTextarea("attributesJson", "扩展属性 JSON", "例如 {\"level\":1}"), referenceDataSort]),
            referenceDataAuditRow
        ]);
        if (referenceDataModule.key === "options") return Object.freeze([
            Object.freeze([referenceDataTypeSelectField(), referenceDataText("optionValue", "选项值", true, "例如 TREE")]),
            Object.freeze([referenceDataText("groupCode", "分组编码"), referenceDataBooleanField("disabled", "禁止选择")]),
            Object.freeze([referenceDataText("labelZh", "中文名称", true), referenceDataText("labelJa", "日文名称")]),
            Object.freeze([referenceDataText("labelEn", "英文名称"), referenceDataStatusField()]),
            Object.freeze([referenceDataTextarea("attributesJson", "扩展属性 JSON"), referenceDataSort]),
            referenceDataAuditRow
        ]);
        if (referenceDataModule.key === "menus") return Object.freeze([
            Object.freeze([referenceDataTypeSelectField(), referenceDataParentSelectField(referenceDataModule, referenceDataRecord)]),
            Object.freeze([referenceDataText("itemCode", "菜单编码", true, "例如 create"), referenceDataText("command", "业务命令", false, "例如 CREATE")]),
            Object.freeze([referenceDataText("icon", "图标类名", false, "例如 ri-add-line", 100), referenceDataBooleanField("disabled", "禁止执行")]),
            Object.freeze([referenceDataText("labelZh", "中文名称", true), referenceDataText("labelJa", "日文名称")]),
            Object.freeze([referenceDataText("labelEn", "英文名称"), referenceDataStatusField()]),
            Object.freeze([referenceDataTextarea("attributesJson", "扩展属性 JSON"), referenceDataSort]),
            referenceDataAuditRow
        ]);
        if (referenceDataModule.key === "tables") return Object.freeze([
            Object.freeze([
                referenceDataText("projectName", "所属项目", true, "例如 reference-data", 100),
                referenceDataText("tableName", "对应数据库表", true, "例如 ReferenceDataType", 100)
            ]),
            Object.freeze([
                referenceDataText("gridColumnId", "表格配置 ID", true, "例如 selGridTypeManagementId", 100),
                referenceDataText("pagePath", "所在页面", false, "例如 /reference-data/reference-data.html", 500)
            ]),
            Object.freeze([referenceDataTextarea("description", "表格描述"), referenceDataStatusField()]),
            Object.freeze([referenceDataSort]),
            referenceDataAuditRow
        ]);
        return Object.freeze([
            Object.freeze([Object.freeze({
                name: "tableName", label: "对应数据库表", type: "select", required: true,
                options: Object.freeze(referenceDataModuleList.map((referenceDataTargetModule) => Object.freeze({
                    value: referenceDataTargetModule.tableName, label: referenceDataTargetModule.name,
                    icon: referenceDataTargetModule.icon, description: referenceDataTargetModule.tableName
                })))
            }), referenceDataText("gridId", "SEL 表格实例 ID", true, "例如 selGridOptionManagementId", 100)]),
            Object.freeze([referenceDataText("gridColumnId", "表格列 ID", true, "例如 labelZh", 100), referenceDataText("tableFieldName", "数据库字段名", true, "例如 labelZh", 100)]),
            Object.freeze([referenceDataText("tableSecondaryFieldName", "第二数据库字段名", false, "仅 stack 渲染使用", 100), Object.freeze({
                name: "cellRenderer", label: "单元格渲染方式", type: "select", required: true, options: Object.freeze([
                    "text", "stack", "badge", "time", "boolean", "actions"
                ].map((referenceDataRenderer) => Object.freeze({ value: referenceDataRenderer, label: referenceDataRenderer, icon: "ri-layout-column-line" })))
            })]),
            Object.freeze([referenceDataText("cellIcon", "单元格图标", false, "例如 ri-database-line", 100), referenceDataBooleanField("cellIconVisible", "显示单元格图标")]),
            Object.freeze([referenceDataText("labelZh", "中文表头", true), referenceDataText("labelJa", "日文表头")]),
            Object.freeze([referenceDataText("labelEn", "英文表头"), referenceDataText("width", "列宽", true, "例如 160px 或 18%", 32)]),
            Object.freeze([referenceDataBooleanField("visible", "页面显示", true), referenceDataStatusField()]),
            Object.freeze([referenceDataSort]),
            referenceDataAuditRow
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

    async function referenceDataLoadResolvedColumns(referenceDataModule) {
        referenceDataState.columns.set(referenceDataModule.key, await referenceDataResolveColumns(referenceDataModule));
    }

    function referenceDataApplyPayload(referenceDataPayload) {
        if (referenceDataState.panelRoot) window.selPanel.setLocale(referenceDataState.panelRoot, { view: referenceDataPayload });
        referenceDataState.searchController?.setLocale(referenceDataPayload.search);
        referenceDataState.treeController?.setLocale(referenceDataPayload.tree);
        referenceDataState.gridController?.setLocale(referenceDataPayload);
        referenceDataState.gridController?.reset();
        window.selDropdownMenu.mountAll(referenceDataState.panelRoot);
    }

    async function referenceDataRefresh(referenceDataReloadActive = true) {
        await referenceDataEnsureModuleLoaded(referenceDataActiveModule(), referenceDataReloadActive);
        await referenceDataLoadResolvedColumns(referenceDataActiveModule());
        referenceDataApplyPayload(referenceDataBuildPayload());
    }

    async function referenceDataSwitchModule(referenceDataKey) {
        if (!referenceDataModules[referenceDataKey]) return;
        if (referenceDataState.activeKey === referenceDataKey && referenceDataState.loadedKeys.has(referenceDataKey)) return;
        referenceDataState.activeKey = referenceDataKey;
        referenceDataState.editingId = null;
        await referenceDataEnsureModuleLoaded(referenceDataActiveModule());
        await referenceDataLoadResolvedColumns(referenceDataActiveModule());
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
        if (referenceDataRecord) referenceDataController.setValues(referenceDataRecord);
        referenceDataController.open();
    }

    function referenceDataOpenDelete(referenceDataModule, referenceDataRecord) {
        referenceDataState.pendingDelete = Object.freeze({ moduleKey: referenceDataModule.key, id: Number(referenceDataRecord.id) });
        referenceDataState.deleteWindowController.setLocale({
            title: `删除${referenceDataModule.itemName}`,
            subtitle: "删除采用逻辑删除；存在关联数据时由数据库阻止不安全操作",
            closeLabel: `关闭删除${referenceDataModule.itemName}确认窗口`,
            submitLabel: "确认删除"
        });
        referenceDataState.deleteWindowController.setFeedback(`即将删除：${referenceDataRecordLabel(referenceDataModule, referenceDataRecord)}`);
        referenceDataState.deleteWindowController.open();
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
            await referenceDataRefresh(true);
            referenceDataController.close();
            referenceDataState.editingId = null;
        } catch (referenceDataError) {
            referenceDataController.setFeedback(referenceDataError.message || `${referenceDataModule.itemName}保存失败。`, true);
        } finally {
            referenceDataController.setLoading(false);
        }
    }

    async function referenceDataDelete() {
        const referenceDataPending = referenceDataState.pendingDelete;
        if (!referenceDataPending) return;
        const referenceDataModule = referenceDataModules[referenceDataPending.moduleKey];
        referenceDataState.deleteWindowController.setLoading(true);
        referenceDataState.deleteWindowController.setFeedback(`正在删除${referenceDataModule.itemName}…`);
        try {
            const referenceDataResult = await referenceDataAjax.request({
                url: `${referenceDataModule.api}delete.htm`, method: "POST", data: { id: referenceDataPending.id }
            });
            referenceDataState.deleteWindowController.setFeedback(referenceDataResult.msg || `${referenceDataModule.itemName}删除完成。`);
            await referenceDataRefresh(true);
            referenceDataState.deleteWindowController.close();
            referenceDataState.pendingDelete = null;
        } catch (referenceDataError) {
            referenceDataState.deleteWindowController.setFeedback(referenceDataError.message || `${referenceDataModule.itemName}删除失败。`, true);
        } finally {
            referenceDataState.deleteWindowController.setLoading(false);
        }
    }

    async function referenceDataToggle(referenceDataModule, referenceDataRecord) {
        const referenceDataNextStatus = Number(referenceDataRecord.status) === 1 ? 2 : 1;
        await referenceDataAjax.request({
            url: `${referenceDataModule.api}update.htm`, method: "POST",
            data: { ...referenceDataRecord, status: referenceDataNextStatus }
        });
        await referenceDataRefresh(true);
    }

    async function referenceDataOpenTableColumns(referenceDataRecord) {
        await referenceDataSwitchModule("columns");
        referenceDataState.gridController.filters.setSearch(
            String(referenceDataRecord.gridColumnId || referenceDataRecord.tableName || "")
        );
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
        if (referenceDataAction === "delete") referenceDataOpenDelete(referenceDataModule, referenceDataRecord);
        if (referenceDataAction === "preview") await referenceDataPreview(referenceDataModule, referenceDataRecord);
        if (referenceDataAction === "toggle") {
            try {
                await referenceDataToggle(referenceDataModule, referenceDataRecord);
            } catch (referenceDataError) {
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
        await referenceDataLoadNavigation();
        await referenceDataEnsureModuleLoaded(referenceDataActiveModule());
        await referenceDataLoadResolvedColumns(referenceDataActiveModule());
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
        referenceDataState.deleteWindowController = window.selWindow.mount(referenceDataApplicationHost, {
            id: "selWindowReferenceDataDeleteId", messages: referenceDataWindowMessages, title: "删除引用数据",
            subtitle: "删除采用逻辑删除", closeLabel: "关闭删除确认窗口", cancelLabel: "取消", submitLabel: "确认删除",
            validationMessage: "请确认删除操作", autoSuccess: false, rows: Object.freeze([])
        });
        referenceDataState.previewMenuController = window.selContextMenu.mount(referenceDataState.panelRoot, {
            id: "selContextMenuReferenceDataPreviewId", ariaLabel: "数据库菜单预览"
        });
        if (!referenceDataState.deleteWindowController || !referenceDataState.previewMenuController) {
            throw new Error("引用数据确认或预览组件挂载失败。");
        }

        referenceDataState.panelRoot.addEventListener("selGrid:new", () => referenceDataOpenEditor(referenceDataActiveModule()));
        referenceDataState.panelRoot.addEventListener("selGrid:action", (referenceDataEvent) => {
            const referenceDataDetail = referenceDataEvent.detail;
            if (!referenceDataDetail || referenceDataDetail.instanceKey !== referenceDataGridId) return;
            referenceDataHandleAction(referenceDataActiveModule(), referenceDataDetail.action, referenceDataDetail.record);
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
            if (referenceDataEvent.detail?.id === "selWindowReferenceDataDeleteId") {
                referenceDataDelete();
                return;
            }
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
    if (!window.selPersonalization.mount(referenceDataPersonalizationHost, { backgroundController: referenceDataBackgroundController })) {
        throw new Error("引用数据个性化设置挂载失败。");
    }

    referenceDataMountApplication().catch((referenceDataError) => {
        console.error("引用数据管理初始化失败。", referenceDataError);
        throw referenceDataError;
    });
}());
