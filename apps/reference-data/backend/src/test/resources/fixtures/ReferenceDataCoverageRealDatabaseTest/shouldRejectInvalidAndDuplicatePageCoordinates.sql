-- ReferenceDataCoverageRealDatabaseTest.shouldRejectInvalidAndDuplicatePageCoordinates Case
DELETE FROM ReferenceDataControlLayout;
INSERT INTO ReferenceDataControlLayout (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode, parentKind, parentCode,
    controlKind, fieldName, sourceTableName, layoutMode, orderNo, breakpoint, status, sortnum
) VALUES
    (110001, 'page110001', 1, 1, 'qa', 'page110001', NULL, NULL,
     'PAGE', 'duplicate-page', 'ReferenceDataControlLayout', 'FLOW', 1, 'DESKTOP', 1, 1),
    (110002, 'page110002', 1, 1, 'qa', 'page110002', NULL, NULL,
     'PAGE', 'duplicate-page', 'ReferenceDataControlLayout', 'FLOW', 2, 'DESKTOP', 1, 2);
