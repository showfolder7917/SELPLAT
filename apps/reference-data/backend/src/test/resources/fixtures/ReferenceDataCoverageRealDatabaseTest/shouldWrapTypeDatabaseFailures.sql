SET REFERENTIAL_INTEGRITY FALSE;
DELETE FROM ReferenceDataControlLayout;
DELETE FROM ReferenceDataWindow;
DELETE FROM ReferenceDataTableElement;
DELETE FROM ReferenceDataTreeNode;
DELETE FROM ReferenceDataTable;
DELETE FROM ReferenceDataType;
DELETE FROM CommonSequenceSegment;
SET REFERENTIAL_INTEGRITY TRUE;
INSERT INTO ReferenceDataControlLayout (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode, parentKind, parentCode,
    controlKind, optionSetCode, sourceTableName, layoutMode, orderNo, breakpoint, status, sortnum
) VALUES (
    100000, 'control100000', 1, 1, 'reference-data', 'page100000', 'PAGE', 'page100000',
    'DROPDOWN', 'optionSet100000', 'ReferenceDataControlLayout', 'FLOW', 30, 'DESKTOP', 1, 30
);
INSERT INTO ReferenceDataType (
    id, code, tenantId, lastOperateUserId, optionSetCode, valueCode, parentTypeCode, nameZh, status, sortnum
) VALUES
    (100001, 'type100001', 1, 1, 'optionSet100000', 'MENU_GROUP', NULL, '菜单组', 1, 100),
    (100002, 'type100002', 1, 1, 'optionSet100000', 'DROPDOWN', NULL, '下拉框', 1, 80);
