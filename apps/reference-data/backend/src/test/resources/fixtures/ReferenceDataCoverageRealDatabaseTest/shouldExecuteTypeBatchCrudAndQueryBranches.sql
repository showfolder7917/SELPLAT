SET REFERENTIAL_INTEGRITY FALSE;
DELETE FROM ReferenceDataControlLayout;
DELETE FROM ReferenceDataWindow;
DELETE FROM ReferenceDataTableElement;
DELETE FROM ReferenceDataTreeNode;
DELETE FROM ReferenceDataTable;
DELETE FROM ReferenceDataType;
DELETE FROM CommonSequenceSegment;
SET REFERENTIAL_INTEGRITY TRUE;
INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, status
) VALUES
    (1, 1, 'ReferenceDataObjectId', '引用数据通用逻辑对象', 101000, 100, 0, 1),
    (1, 1, 'ReferenceDataTypeId', '数据类型主键', 101000, 100, 0, 1);
INSERT INTO ReferenceDataControlLayout (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode, parentKind, parentCode,
    controlKind, optionSetCode, sourceTableName, layoutMode, orderNo, breakpoint, status, sortnum
) VALUES (
    100000, 'control100000', 1, 1, 'reference-data', 'page100000', 'PAGE', 'page100000',
    'DROPDOWN', 'optionSet100000', 'ReferenceDataControlLayout', 'FLOW', 30, 'DESKTOP', 1, 30
);
INSERT INTO ReferenceDataType (
    id, code, tenantId, lastOperateUserId, optionSetCode, valueCode, parentTypeCode,
    nameZh, nameJa, nameEn, status, sortnum
) VALUES
    (100001, 'type100001', 1, 1, 'optionSet100000', 'MENU_GROUP', NULL, '菜单组', 'メニューグループ', 'Menu group', 1, 100),
    (100002, 'type100002', 1, 1, 'optionSet100000', 'DROPDOWN', NULL, '下拉框', 'ドロップダウン', 'Dropdown', 1, 80),
    (100003, 'type100003', 1, 1, 'optionSet100000', 'CONTEXT_MENU', 'type100001', '右键菜单', 'コンテキストメニュー', 'Context menu', 2, 70);
INSERT INTO ReferenceDataTreeNode (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode,
    parentId, nodeValue, labelZh, status, sortnum
) VALUES (
    100010, 'treeNode100010', 1, 1, 'reference-data', 'page100000',
    NULL, 'ROOT', '根节点', 1, 1
);
