-- 五张业务表分别登记一条独立号段；只补缺失配置，重启绝不回退 nextStartId 或 versionNo。
INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId,
    stepSize, versionNo, remark, sortnum, status
) SELECT 1, 1, 'ReferenceDataTypeId', '引用数据类型主键号段', 100000,
    1000, 0, 'ReferenceDataType 一表一号段，支持多进程乐观锁抢号', 10.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataTypeId'
);

INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId,
    stepSize, versionNo, remark, sortnum, status
) SELECT 1, 1, 'ReferenceDataTreeNodeId', '引用数据树节点主键号段', 100000,
    1000, 0, 'ReferenceDataTreeNode 一表一号段，支持多进程乐观锁抢号', 20.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataTreeNodeId'
);

INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId,
    stepSize, versionNo, remark, sortnum, status
) SELECT 1, 1, 'ReferenceDataOptionId', '引用数据下拉选项主键号段', 100000,
    1000, 0, 'ReferenceDataOption 一表一号段，支持多进程乐观锁抢号', 30.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataOptionId'
);

INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId,
    stepSize, versionNo, remark, sortnum, status
) SELECT 1, 1, 'ReferenceDataContextMenuItemId', '引用数据右键菜单项主键号段', 100000,
    1000, 0, 'ReferenceDataContextMenuItem 一表一号段，支持多进程乐观锁抢号', 40.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataContextMenuItemId'
);

INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId,
    stepSize, versionNo, remark, sortnum, status
) SELECT 1, 1, 'ReferenceDataTableColumnId', '页面表格头配置主键号段', 100000,
    1000, 0, 'ReferenceDataTableColumn 一表一号段，支持多进程乐观锁抢号', 50.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'ReferenceDataTableColumnId'
);
