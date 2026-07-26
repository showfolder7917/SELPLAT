-- UniauthUserInsertRealDatabaseTest.normal Case 清空用户表，确保新增后的数据库记录只来自当前测试方法调用。
DELETE FROM UniauthUser;

-- 重建用户 id 号段配置，使 insert 方法能够通过真实发号 DAO 获取可用主键。
DELETE FROM CommonSequenceSegment;
INSERT INTO CommonSequenceSegment (
    id,
    tenantId,
    lastOperateUserId,
    seqCode,
    seqName,
    nextStartId,
    stepSize,
    versionNo,
    sortnum,
    status
) VALUES (
    31,
    1,
    1,
    'UniauthUserId',
    'insert 方法真实测试号段',
    310000,
    10,
    0,
    10.00,
    1
);
