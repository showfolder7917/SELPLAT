-- 用户主键号段仅在缺失时创建，应用重启不得覆盖已经推进的游标和版本。
INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize,
    versionNo, remark, sortnum, status
) SELECT
    1, 1, 'UniauthUserId', '统一认证用户主键号段', 100000, 1000,
    0, '按模块缓存号段生成用户主键', 10.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'UniauthUserId'
);

-- 租户主键使用独立号段，禁止与用户表共享一条游标。
INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize,
    versionNo, remark, sortnum, status
) SELECT
    1, 1, 'UniauthTenantId', '统一认证租户主键号段', 100000, 1000,
    0, '按模块缓存号段生成租户主键', 20.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'UniauthTenantId'
);
