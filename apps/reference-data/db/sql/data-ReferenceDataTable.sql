-- 工作台六个业务表格定义作为可编辑测试数据写入；相同项目和控件 ID 已存在时保留用户数据。
INSERT INTO ReferenceDataTable
    (id, tenantId, lastOperateUserId, projectName, tableName, gridColumnId, description, pagePath, status, sortnum)
SELECT 200001, 1, 1, 'reference-data', 'ReferenceDataType', 'selGridTypeManagementId',
       '数据类型管理表格', '/reference-data/reference-data.html', 1, 10
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTable WHERE projectName = 'reference-data' AND gridColumnId = 'selGridTypeManagementId');

INSERT INTO ReferenceDataTable
    (id, tenantId, lastOperateUserId, projectName, tableName, gridColumnId, description, pagePath, status, sortnum)
SELECT 200002, 1, 1, 'reference-data', 'ReferenceDataTreeNode', 'selGridTreeNodeManagementId',
       '树节点管理表格', '/reference-data/reference-data.html', 1, 20
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTable WHERE projectName = 'reference-data' AND gridColumnId = 'selGridTreeNodeManagementId');

INSERT INTO ReferenceDataTable
    (id, tenantId, lastOperateUserId, projectName, tableName, gridColumnId, description, pagePath, status, sortnum)
SELECT 200003, 1, 1, 'reference-data', 'ReferenceDataOption', 'selGridOptionManagementId',
       '下拉选项管理表格', '/reference-data/reference-data.html', 1, 30
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTable WHERE projectName = 'reference-data' AND gridColumnId = 'selGridOptionManagementId');

INSERT INTO ReferenceDataTable
    (id, tenantId, lastOperateUserId, projectName, tableName, gridColumnId, description, pagePath, status, sortnum)
SELECT 200004, 1, 1, 'reference-data', 'ReferenceDataContextMenuItem', 'selGridContextMenuManagementId',
       '菜单项目管理表格', '/reference-data/reference-data.html', 1, 40
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTable WHERE projectName = 'reference-data' AND gridColumnId = 'selGridContextMenuManagementId');

INSERT INTO ReferenceDataTable
    (id, tenantId, lastOperateUserId, projectName, tableName, gridColumnId, description, pagePath, status, sortnum)
SELECT 200005, 1, 1, 'reference-data', 'ReferenceDataTable', 'selGridTableManagementId',
       '业务表格定义管理', '/reference-data/reference-data.html', 1, 50
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTable WHERE projectName = 'reference-data' AND gridColumnId = 'selGridTableManagementId');

INSERT INTO ReferenceDataTable
    (id, tenantId, lastOperateUserId, projectName, tableName, gridColumnId, description, pagePath, status, sortnum)
SELECT 200006, 1, 1, 'reference-data', 'ReferenceDataTableColumn', 'selGridTableColumnManagementId',
       '业务表格列配置管理', '/reference-data/reference-data.html', 1, 60
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataTable WHERE projectName = 'reference-data' AND gridColumnId = 'selGridTableColumnManagementId');
