-- 六张业务表号段只在缺失时初始化；重启不覆盖管理员已经推进的 nextStartId 和 versionNo。
INSERT INTO CommonSequenceSegment
    (tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, remark, sortnum, status)
SELECT 1, 1, 'ReferenceDataTypeId', '引用数据类型主键', 101000, 100, 0, 'Reference Data 测试与管理数据号段', 10, 1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataTypeId');

INSERT INTO CommonSequenceSegment
    (tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, remark, sortnum, status)
SELECT 1, 1, 'ReferenceDataTreeNodeId', '引用数据树节点主键', 101000, 100, 0, 'Reference Data 测试与管理数据号段', 20, 1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataTreeNodeId');

INSERT INTO CommonSequenceSegment
    (tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, remark, sortnum, status)
SELECT 1, 1, 'ReferenceDataOptionId', '引用数据选项主键', 101000, 100, 0, 'Reference Data 测试与管理数据号段', 30, 1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataOptionId');

INSERT INTO CommonSequenceSegment
    (tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, remark, sortnum, status)
SELECT 1, 1, 'ReferenceDataContextMenuItemId', '引用数据菜单主键', 101000, 100, 0, 'Reference Data 测试与管理数据号段', 40, 1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataContextMenuItemId');

INSERT INTO CommonSequenceSegment
    (tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, remark, sortnum, status)
SELECT 1, 1, 'ReferenceDataTableId', '业务表格定义主键', 101000, 100, 0, 'Reference Data 表格定义测试数据号段', 50, 1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataTableId');

INSERT INTO CommonSequenceSegment
    (tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize, versionNo, remark, sortnum, status)
SELECT 1, 1, 'ReferenceDataTableColumnId', '业务表格列主键', 101000, 100, 0, 'Reference Data 表格列测试数据号段', 60, 1
WHERE NOT EXISTS (SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataTableColumnId');
