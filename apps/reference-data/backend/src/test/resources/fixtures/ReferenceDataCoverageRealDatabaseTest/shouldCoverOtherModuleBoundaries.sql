-- ReferenceDataCoverageRealDatabaseTest.shouldCoverOtherModuleBoundaries Case
SET REFERENTIAL_INTEGRITY FALSE;
DELETE FROM ReferenceDataContextMenuItem;
DELETE FROM ReferenceDataOption;
DELETE FROM ReferenceDataTreeNode;
DELETE FROM ReferenceDataTableColumn;
DELETE FROM ReferenceDataTable;
DELETE FROM ReferenceDataType;
DELETE FROM CommonSequenceSegment;
SET REFERENTIAL_INTEGRITY TRUE;
INSERT INTO ReferenceDataType (
    id, tenantId, lastOperateUserId, projectCode, resourceCode, nameZh, status, sortnum
) VALUES (100001, 1, 1, 'coverage', 'configured', '覆盖率配置类型', 1, 100);
INSERT INTO ReferenceDataOption (
    id, tenantId, lastOperateUserId, typeId, optionValue, labelZh, groupCode, disabled, status, sortnum
) VALUES
    (100001, 1, 1, 100001, 'FIRST', '第一项', NULL, FALSE, 1, 1),
    (100002, 1, 1, 100001, 'SECOND', '第二项', 'GROUP-A', TRUE, 1, 2);
INSERT INTO ReferenceDataTreeNode (
    id, tenantId, lastOperateUserId, typeId, parentId, nodeCode, nodeValue, labelZh, status, sortnum
) VALUES (100001, 1, 1, 100001, NULL, 'coverage-root', 'ROOT', '覆盖根节点', 1, 1);
INSERT INTO ReferenceDataContextMenuItem (
    id, tenantId, lastOperateUserId, typeId, parentId, itemCode, labelZh, icon, command, disabled, status, sortnum
) VALUES (100001, 1, 1, 100001, NULL, 'coverage-menu', '覆盖菜单', 'ri-test-line', 'COVERAGE_COMMAND', FALSE, 1, 1);
INSERT INTO ReferenceDataTableColumn (
    id, tenantId, lastOperateUserId, tableName, gridId, gridColumnId, tableFieldName,
    tableSecondaryFieldName, labelZh, labelJa, labelEn, width, cellRenderer,
    cellIcon, cellIconVisible, visible, status, sortnum
) VALUES (
    100001, 1, 1, 'ReferenceDataOption', 'coverageGrid', 'coverage-column', 'optionValue',
    'labelZh', '覆盖列', 'カバレッジ列', 'Coverage column', '180px', 'text',
    'ri-test-line', TRUE, TRUE, 1, 1
);
