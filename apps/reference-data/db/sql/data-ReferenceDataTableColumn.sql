-- 七个管理表格的列配置作为可编辑测试数据写入；重启只补充缺失列，不覆盖用户修改。
INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210001, 1, 1, 'ReferenceDataType', 'selGridTypeManagementId', 'coordinate', 'resourceCode',
       'projectCode', '类型坐标', 'タイプ座標', 'Type coordinate', '210px', 'stack',
       NULL, FALSE, TRUE, 1, 10
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataType' AND gridId = 'selGridTypeManagementId' AND gridColumnId = 'coordinate'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210002, 1, 1, 'ReferenceDataType', 'selGridTypeManagementId', 'nameZh', 'nameZh',
       NULL, '中文名称', '中国語名', 'Chinese name', '180px', 'text',
       NULL, FALSE, TRUE, 1, 20
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataType' AND gridId = 'selGridTypeManagementId' AND gridColumnId = 'nameZh'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210003, 1, 1, 'ReferenceDataType', 'selGridTypeManagementId', 'localized', 'nameEn',
       'nameJa', '英文 / 日文', '英語 / 日本語', 'English / Japanese', '220px', 'stack',
       NULL, FALSE, TRUE, 1, 30
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataType' AND gridId = 'selGridTypeManagementId' AND gridColumnId = 'localized'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210004, 1, 1, 'ReferenceDataType', 'selGridTypeManagementId', 'status', 'status',
       NULL, '状态', '状態', 'Status', '90px', 'badge',
       NULL, FALSE, TRUE, 1, 40
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataType' AND gridId = 'selGridTypeManagementId' AND gridColumnId = 'status'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210005, 1, 1, 'ReferenceDataType', 'selGridTypeManagementId', 'sortnum', 'sortnum',
       NULL, '排序', '並び順', 'Order', '90px', 'text',
       NULL, FALSE, TRUE, 1, 50
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataType' AND gridId = 'selGridTypeManagementId' AND gridColumnId = 'sortnum'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210006, 1, 1, 'ReferenceDataType', 'selGridTypeManagementId', 'updatedAt', 'updatedAt',
       NULL, '更新时间', '更新日時', 'Updated at', '160px', 'time',
       NULL, FALSE, TRUE, 1, 60
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataType' AND gridId = 'selGridTypeManagementId' AND gridColumnId = 'updatedAt'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210007, 1, 1, 'ReferenceDataType', 'selGridTypeManagementId', 'actions', 'id',
       NULL, '操作', '操作', 'Actions', '132px', 'actions',
       NULL, FALSE, TRUE, 1, 70
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataType' AND gridId = 'selGridTypeManagementId' AND gridColumnId = 'actions'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210008, 1, 1, 'ReferenceDataTreeNode', 'selGridTreeNodeManagementId', 'node', 'nodeCode',
       'nodeValue', '节点编码 / 值', 'ノードコード / 値', 'Node code / value', '210px', 'stack',
       NULL, FALSE, TRUE, 1, 10
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTreeNode' AND gridId = 'selGridTreeNodeManagementId' AND gridColumnId = 'node'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210009, 1, 1, 'ReferenceDataTreeNode', 'selGridTreeNodeManagementId', 'typeId', 'typeId',
       NULL, '所属类型', '所属タイプ', 'Type', '120px', 'text',
       NULL, FALSE, TRUE, 1, 20
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTreeNode' AND gridId = 'selGridTreeNodeManagementId' AND gridColumnId = 'typeId'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210010, 1, 1, 'ReferenceDataTreeNode', 'selGridTreeNodeManagementId', 'parentId', 'parentId',
       NULL, '父节点', '親ノード', 'Parent', '120px', 'text',
       NULL, FALSE, TRUE, 1, 30
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTreeNode' AND gridId = 'selGridTreeNodeManagementId' AND gridColumnId = 'parentId'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210011, 1, 1, 'ReferenceDataTreeNode', 'selGridTreeNodeManagementId', 'labelZh', 'labelZh',
       NULL, '中文名称', '中国語名', 'Chinese name', '180px', 'text',
       NULL, FALSE, TRUE, 1, 40
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTreeNode' AND gridId = 'selGridTreeNodeManagementId' AND gridColumnId = 'labelZh'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210012, 1, 1, 'ReferenceDataTreeNode', 'selGridTreeNodeManagementId', 'status', 'status',
       NULL, '状态', '状態', 'Status', '90px', 'badge',
       NULL, FALSE, TRUE, 1, 50
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTreeNode' AND gridId = 'selGridTreeNodeManagementId' AND gridColumnId = 'status'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210013, 1, 1, 'ReferenceDataTreeNode', 'selGridTreeNodeManagementId', 'sortnum', 'sortnum',
       NULL, '排序', '並び順', 'Order', '90px', 'text',
       NULL, FALSE, TRUE, 1, 60
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTreeNode' AND gridId = 'selGridTreeNodeManagementId' AND gridColumnId = 'sortnum'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210014, 1, 1, 'ReferenceDataTreeNode', 'selGridTreeNodeManagementId', 'actions', 'id',
       NULL, '操作', '操作', 'Actions', '132px', 'actions',
       NULL, FALSE, TRUE, 1, 70
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTreeNode' AND gridId = 'selGridTreeNodeManagementId' AND gridColumnId = 'actions'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210015, 1, 1, 'ReferenceDataOption', 'selGridOptionManagementId', 'optionValue', 'optionValue',
       NULL, '选项值', '選択肢値', 'Option value', '170px', 'text',
       NULL, FALSE, TRUE, 1, 10
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataOption' AND gridId = 'selGridOptionManagementId' AND gridColumnId = 'optionValue'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210016, 1, 1, 'ReferenceDataOption', 'selGridOptionManagementId', 'groupCode', 'groupCode',
       NULL, '分组编码', 'グループコード', 'Group code', '140px', 'text',
       NULL, FALSE, TRUE, 1, 20
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataOption' AND gridId = 'selGridOptionManagementId' AND gridColumnId = 'groupCode'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210017, 1, 1, 'ReferenceDataOption', 'selGridOptionManagementId', 'labelZh', 'labelZh',
       NULL, '中文名称', '中国語名', 'Chinese name', '180px', 'text',
       NULL, FALSE, TRUE, 1, 30
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataOption' AND gridId = 'selGridOptionManagementId' AND gridColumnId = 'labelZh'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210018, 1, 1, 'ReferenceDataOption', 'selGridOptionManagementId', 'disabled', 'disabled',
       NULL, '禁止选择', '選択禁止', 'Disabled', '100px', 'boolean',
       NULL, FALSE, TRUE, 1, 40
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataOption' AND gridId = 'selGridOptionManagementId' AND gridColumnId = 'disabled'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210019, 1, 1, 'ReferenceDataOption', 'selGridOptionManagementId', 'status', 'status',
       NULL, '状态', '状態', 'Status', '90px', 'badge',
       NULL, FALSE, TRUE, 1, 50
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataOption' AND gridId = 'selGridOptionManagementId' AND gridColumnId = 'status'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210020, 1, 1, 'ReferenceDataOption', 'selGridOptionManagementId', 'sortnum', 'sortnum',
       NULL, '排序', '並び順', 'Order', '90px', 'text',
       NULL, FALSE, TRUE, 1, 60
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataOption' AND gridId = 'selGridOptionManagementId' AND gridColumnId = 'sortnum'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210021, 1, 1, 'ReferenceDataOption', 'selGridOptionManagementId', 'actions', 'id',
       NULL, '操作', '操作', 'Actions', '132px', 'actions',
       NULL, FALSE, TRUE, 1, 70
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataOption' AND gridId = 'selGridOptionManagementId' AND gridColumnId = 'actions'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210022, 1, 1, 'ReferenceDataContextMenuItem', 'selGridContextMenuManagementId', 'itemCode', 'itemCode',
       NULL, '菜单编码', 'メニューコード', 'Menu code', '160px', 'text',
       NULL, FALSE, TRUE, 1, 10
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataContextMenuItem' AND gridId = 'selGridContextMenuManagementId' AND gridColumnId = 'itemCode'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210023, 1, 1, 'ReferenceDataContextMenuItem', 'selGridContextMenuManagementId', 'command', 'command',
       NULL, '业务命令', '業務コマンド', 'Command', '180px', 'text',
       NULL, FALSE, TRUE, 1, 20
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataContextMenuItem' AND gridId = 'selGridContextMenuManagementId' AND gridColumnId = 'command'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210024, 1, 1, 'ReferenceDataContextMenuItem', 'selGridContextMenuManagementId', 'labelZh', 'labelZh',
       NULL, '中文名称', '中国語名', 'Chinese name', '170px', 'text',
       NULL, FALSE, TRUE, 1, 30
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataContextMenuItem' AND gridId = 'selGridContextMenuManagementId' AND gridColumnId = 'labelZh'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210025, 1, 1, 'ReferenceDataContextMenuItem', 'selGridContextMenuManagementId', 'icon', 'icon',
       NULL, '图标', 'アイコン', 'Icon', '130px', 'text',
       NULL, FALSE, TRUE, 1, 40
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataContextMenuItem' AND gridId = 'selGridContextMenuManagementId' AND gridColumnId = 'icon'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210026, 1, 1, 'ReferenceDataContextMenuItem', 'selGridContextMenuManagementId', 'disabled', 'disabled',
       NULL, '禁止执行', '実行禁止', 'Disabled', '100px', 'boolean',
       NULL, FALSE, TRUE, 1, 50
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataContextMenuItem' AND gridId = 'selGridContextMenuManagementId' AND gridColumnId = 'disabled'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210027, 1, 1, 'ReferenceDataContextMenuItem', 'selGridContextMenuManagementId', 'status', 'status',
       NULL, '状态', '状態', 'Status', '90px', 'badge',
       NULL, FALSE, TRUE, 1, 60
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataContextMenuItem' AND gridId = 'selGridContextMenuManagementId' AND gridColumnId = 'status'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210028, 1, 1, 'ReferenceDataContextMenuItem', 'selGridContextMenuManagementId', 'actions', 'id',
       NULL, '操作', '操作', 'Actions', '132px', 'actions',
       NULL, FALSE, TRUE, 1, 70
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataContextMenuItem' AND gridId = 'selGridContextMenuManagementId' AND gridColumnId = 'actions'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210029, 1, 1, 'ReferenceDataTable', 'selGridTableManagementId', 'projectName', 'projectName',
       NULL, '所属项目', '所属プロジェクト', 'Project', '140px', 'text',
       NULL, FALSE, TRUE, 1, 10
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTable' AND gridId = 'selGridTableManagementId' AND gridColumnId = 'projectName'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210030, 1, 1, 'ReferenceDataTable', 'selGridTableManagementId', 'tableName', 'tableName',
       NULL, '业务数据表', '業務データ表', 'Business table', '190px', 'text',
       NULL, FALSE, TRUE, 1, 20
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTable' AND gridId = 'selGridTableManagementId' AND gridColumnId = 'tableName'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210031, 1, 1, 'ReferenceDataTable', 'selGridTableManagementId', 'gridColumnId', 'gridColumnId',
       NULL, '表格控件 ID', 'グリッドID', 'Grid ID', '220px', 'text',
       NULL, FALSE, TRUE, 1, 30
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTable' AND gridId = 'selGridTableManagementId' AND gridColumnId = 'gridColumnId'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210032, 1, 1, 'ReferenceDataTable', 'selGridTableManagementId', 'description', 'description',
       NULL, '表格描述', 'グリッド説明', 'Description', '220px', 'text',
       NULL, FALSE, TRUE, 1, 40
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTable' AND gridId = 'selGridTableManagementId' AND gridColumnId = 'description'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210033, 1, 1, 'ReferenceDataTable', 'selGridTableManagementId', 'pagePath', 'pagePath',
       NULL, '所在页面', 'ページ', 'Page', '230px', 'text',
       NULL, FALSE, TRUE, 1, 50
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTable' AND gridId = 'selGridTableManagementId' AND gridColumnId = 'pagePath'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210034, 1, 1, 'ReferenceDataTable', 'selGridTableManagementId', 'status', 'status',
       NULL, '状态', '状態', 'Status', '90px', 'badge',
       NULL, FALSE, TRUE, 1, 60
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTable' AND gridId = 'selGridTableManagementId' AND gridColumnId = 'status'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210035, 1, 1, 'ReferenceDataTable', 'selGridTableManagementId', 'sortnum', 'sortnum',
       NULL, '排序', '並び順', 'Order', '90px', 'text',
       NULL, FALSE, TRUE, 1, 70
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTable' AND gridId = 'selGridTableManagementId' AND gridColumnId = 'sortnum'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210036, 1, 1, 'ReferenceDataTable', 'selGridTableManagementId', 'actions', 'id',
       NULL, '操作', '操作', 'Actions', '132px', 'actions',
       NULL, FALSE, TRUE, 1, 80
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTable' AND gridId = 'selGridTableManagementId' AND gridColumnId = 'actions'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210037, 1, 1, 'ReferenceDataTableColumn', 'selGridTableColumnManagementId', 'coordinate', 'tableName',
       'gridId', '表格 / 控件', '表 / グリッド', 'Table / grid', '230px', 'stack',
       NULL, FALSE, TRUE, 1, 10
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTableColumn' AND gridId = 'selGridTableColumnManagementId' AND gridColumnId = 'coordinate'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210038, 1, 1, 'ReferenceDataTableColumn', 'selGridTableColumnManagementId', 'gridColumnId', 'gridColumnId',
       NULL, '表格列 ID', '列ID', 'Column ID', '160px', 'text',
       NULL, FALSE, TRUE, 1, 20
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTableColumn' AND gridId = 'selGridTableColumnManagementId' AND gridColumnId = 'gridColumnId'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210039, 1, 1, 'ReferenceDataTableColumn', 'selGridTableColumnManagementId', 'tableFieldName', 'tableFieldName',
       NULL, '绑定字段', 'バインド項目', 'Bound field', '150px', 'text',
       NULL, FALSE, TRUE, 1, 30
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTableColumn' AND gridId = 'selGridTableColumnManagementId' AND gridColumnId = 'tableFieldName'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210040, 1, 1, 'ReferenceDataTableColumn', 'selGridTableColumnManagementId', 'labelZh', 'labelZh',
       NULL, '中文表头', '中国語見出し', 'Chinese label', '170px', 'text',
       NULL, FALSE, TRUE, 1, 40
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTableColumn' AND gridId = 'selGridTableColumnManagementId' AND gridColumnId = 'labelZh'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210041, 1, 1, 'ReferenceDataTableColumn', 'selGridTableColumnManagementId', 'width', 'width',
       NULL, '列宽', '列幅', 'Width', '90px', 'text',
       NULL, FALSE, TRUE, 1, 50
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTableColumn' AND gridId = 'selGridTableColumnManagementId' AND gridColumnId = 'width'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210042, 1, 1, 'ReferenceDataTableColumn', 'selGridTableColumnManagementId', 'cellRenderer', 'cellRenderer',
       NULL, '渲染方式', 'レンダラー', 'Renderer', '110px', 'text',
       NULL, FALSE, TRUE, 1, 60
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTableColumn' AND gridId = 'selGridTableColumnManagementId' AND gridColumnId = 'cellRenderer'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210043, 1, 1, 'ReferenceDataTableColumn', 'selGridTableColumnManagementId', 'visible', 'visible',
       NULL, '页面显示', '表示', 'Visible', '90px', 'boolean',
       NULL, FALSE, TRUE, 1, 70
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTableColumn' AND gridId = 'selGridTableColumnManagementId' AND gridColumnId = 'visible'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210044, 1, 1, 'ReferenceDataTableColumn', 'selGridTableColumnManagementId', 'status', 'status',
       NULL, '状态', '状態', 'Status', '90px', 'badge',
       NULL, FALSE, TRUE, 1, 80
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTableColumn' AND gridId = 'selGridTableColumnManagementId' AND gridColumnId = 'status'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210045, 1, 1, 'ReferenceDataTableColumn', 'selGridTableColumnManagementId', 'sortnum', 'sortnum',
       NULL, '排序', '並び順', 'Order', '90px', 'text',
       NULL, FALSE, TRUE, 1, 90
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTableColumn' AND gridId = 'selGridTableColumnManagementId' AND gridColumnId = 'sortnum'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210046, 1, 1, 'ReferenceDataTableColumn', 'selGridTableColumnManagementId', 'actions', 'id',
       NULL, '操作', '操作', 'Actions', '132px', 'actions',
       NULL, FALSE, TRUE, 1, 100
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataTableColumn' AND gridId = 'selGridTableColumnManagementId' AND gridColumnId = 'actions'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210047, 1, 1, 'ReferenceDataControlBinding', 'selGridControlBindingManagementId', 'pageCoordinate', 'pageProjectCode',
       'pagePath', '页面项目 / 路径', 'ページプロジェクト / パス', 'Page project / path', '260px', 'stack',
       NULL, FALSE, TRUE, 1, 10
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataControlBinding' AND gridId = 'selGridControlBindingManagementId' AND gridColumnId = 'pageCoordinate'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210048, 1, 1, 'ReferenceDataControlBinding', 'selGridControlBindingManagementId', 'controlId', 'controlId',
       NULL, '控件实例 ID', 'コントロールID', 'Control ID', '220px', 'text',
       NULL, FALSE, TRUE, 1, 20
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataControlBinding' AND gridId = 'selGridControlBindingManagementId' AND gridColumnId = 'controlId'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210049, 1, 1, 'ReferenceDataControlBinding', 'selGridControlBindingManagementId', 'controlType', 'controlType',
       NULL, '控件类型', 'コントロール種別', 'Control type', '140px', 'text',
       NULL, FALSE, TRUE, 1, 30
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataControlBinding' AND gridId = 'selGridControlBindingManagementId' AND gridColumnId = 'controlType'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210050, 1, 1, 'ReferenceDataControlBinding', 'selGridControlBindingManagementId', 'typeId', 'typeId',
       NULL, '引用数据类型', '参照データ種別', 'Reference data type', '130px', 'text',
       NULL, FALSE, TRUE, 1, 40
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataControlBinding' AND gridId = 'selGridControlBindingManagementId' AND gridColumnId = 'typeId'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210051, 1, 1, 'ReferenceDataControlBinding', 'selGridControlBindingManagementId', 'description', 'description',
       NULL, '控件说明', 'コントロール説明', 'Description', '220px', 'text',
       NULL, FALSE, TRUE, 1, 50
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataControlBinding' AND gridId = 'selGridControlBindingManagementId' AND gridColumnId = 'description'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210052, 1, 1, 'ReferenceDataControlBinding', 'selGridControlBindingManagementId', 'status', 'status',
       NULL, '状态', '状態', 'Status', '90px', 'badge',
       NULL, FALSE, TRUE, 1, 60
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataControlBinding' AND gridId = 'selGridControlBindingManagementId' AND gridColumnId = 'status'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210053, 1, 1, 'ReferenceDataControlBinding', 'selGridControlBindingManagementId', 'sortnum', 'sortnum',
       NULL, '排序', '並び順', 'Order', '90px', 'text',
       NULL, FALSE, TRUE, 1, 70
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataControlBinding' AND gridId = 'selGridControlBindingManagementId' AND gridColumnId = 'sortnum'
);

INSERT INTO ReferenceDataTableColumn
    (id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
     tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
     cellIcon, cellIconVisible, visible, status, sortnum)
SELECT 210054, 1, 1, 'ReferenceDataControlBinding', 'selGridControlBindingManagementId', 'actions', 'id',
       NULL, '操作', '操作', 'Actions', '132px', 'actions',
       NULL, FALSE, TRUE, 1, 80
WHERE NOT EXISTS (
    SELECT 1 FROM ReferenceDataTableColumn
    WHERE tableName = 'ReferenceDataControlBinding' AND gridId = 'selGridControlBindingManagementId' AND gridColumnId = 'actions'
);
