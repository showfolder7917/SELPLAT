-- ReferenceDataCoverageRealDatabaseTest.shouldExecuteControlLayoutUpdateGuards Case
DELETE FROM ReferenceDataControlLayout;
INSERT INTO ReferenceDataControlLayout (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode, parentKind, parentCode,
    controlKind, fieldName, sourceTableName, layoutMode, orderNo, breakpoint, status, sortnum
) VALUES (
    120001, 'control120001', 1, 1, 'qa', 'page120000', 'PAGE', 'page120000',
    'BUTTON', 'before-update', 'ReferenceDataControlLayout', 'FLOW', 1, 'DESKTOP', 1, 1
);
