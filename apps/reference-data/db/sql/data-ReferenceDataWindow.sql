-- ReferenceDataWindow 只恢复页面已登记的独立 Window 外框；重复启动不覆盖后台保存的尺寸、位置和状态。
INSERT INTO ReferenceDataWindow (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode, triggerControlCode,
    nameZh, nameJa, nameEn, width, height, minWidth, minHeight,
    positionMode, resizable, draggable, maximizable, minimizable, breakpoint, versionNo, status, sortnum
) SELECT
    101064, 'window101064', 1, 1, 'reference-data', 'page101017', 'selWindowTypeManagementId',
    '数据类型编辑窗口', NULL, NULL, '960px', '680px', '480px', '320px',
    'CENTER', TRUE, TRUE, TRUE, TRUE, 'DESKTOP', 0, 1, 10.00
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataWindow WHERE code = 'window101064');

INSERT INTO ReferenceDataWindow (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode, triggerControlCode,
    nameZh, width, height, minWidth, minHeight, positionMode,
    resizable, draggable, maximizable, minimizable, breakpoint, versionNo, status, sortnum
) SELECT
    103008, 'window103008', 1, 1, 'reference-data', 'page101017', 'selWindowTreeNodeManagementId',
    '树节点编辑窗口', '960px', '680px', '480px', '320px', 'CENTER',
    TRUE, TRUE, TRUE, TRUE, 'DESKTOP', 0, 1, 20.00
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataWindow WHERE code = 'window103008');

INSERT INTO ReferenceDataWindow (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode, triggerControlCode,
    nameZh, width, height, minWidth, minHeight, positionMode,
    resizable, draggable, maximizable, minimizable, breakpoint, versionNo, status, sortnum
) SELECT
    103009, 'window103009', 1, 1, 'reference-data', 'page101017', 'selWindowTableManagementId',
    '表格定义编辑窗口', '960px', '680px', '480px', '320px', 'CENTER',
    TRUE, TRUE, TRUE, TRUE, 'DESKTOP', 0, 1, 30.00
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataWindow WHERE code = 'window103009');

INSERT INTO ReferenceDataWindow (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode, triggerControlCode,
    nameZh, width, height, minWidth, minHeight, positionMode,
    resizable, draggable, maximizable, minimizable, breakpoint, versionNo, status, sortnum
) SELECT
    103010, 'window103010', 1, 1, 'reference-data', 'page101017', 'selWindowTableElementManagementId',
    '表格列编辑窗口', '960px', '680px', '480px', '320px', 'CENTER',
    TRUE, TRUE, TRUE, TRUE, 'DESKTOP', 0, 1, 40.00
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataWindow WHERE code = 'window103010');

INSERT INTO ReferenceDataWindow (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode, triggerControlCode,
    nameZh, width, height, minWidth, minHeight, positionMode,
    resizable, draggable, maximizable, minimizable, breakpoint, versionNo, status, sortnum
) SELECT
    103011, 'window103011', 1, 1, 'reference-data', 'page101017', 'selWindowControlLayoutManagementId',
    '页面控件编辑窗口', '960px', '680px', '480px', '320px', 'CENTER',
    TRUE, TRUE, TRUE, TRUE, 'DESKTOP', 0, 1, 50.00
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataWindow WHERE code = 'window103011');

INSERT INTO ReferenceDataWindow (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode, triggerControlCode,
    nameZh, width, height, minWidth, minHeight, positionMode,
    resizable, draggable, maximizable, minimizable, breakpoint, versionNo, status, sortnum
) SELECT
    103012, 'window103012', 1, 1, 'reference-data', 'page101017', 'selWindowWindowManagementId',
    'Window 管理窗口', '960px', '680px', '480px', '320px', 'CENTER',
    TRUE, TRUE, TRUE, TRUE, 'DESKTOP', 0, 1, 60.00
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataWindow WHERE code = 'window103012');

INSERT INTO ReferenceDataWindow (
    id, code, tenantId, lastOperateUserId, projectCode, pageCode, triggerControlCode,
    nameZh, nameJa, nameEn, width, height, minWidth, minHeight,
    positionMode, resizable, draggable, maximizable, minimizable, breakpoint, versionNo, status, sortnum
) SELECT
    103013, 'window103013', 1, 1, 'japanese', 'page104008', 'selWindowJapaneseN2BlueBookQuestionId',
    'N2 题目编辑窗口', 'N2 問題編集ウィンドウ', 'N2 Question Editor',
    '960px', '760px', '560px', '420px', 'CENTER', TRUE, TRUE, TRUE, TRUE, 'DESKTOP', 0, 1, 10.00
WHERE NOT EXISTS (SELECT 1 FROM ReferenceDataWindow WHERE code = 'window103013');
