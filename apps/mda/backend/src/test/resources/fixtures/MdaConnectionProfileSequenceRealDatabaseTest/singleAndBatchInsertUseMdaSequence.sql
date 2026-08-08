-- MdaConnectionProfileSequenceRealDatabaseTest.singleAndBatchInsertUseMdaSequence Case
DELETE FROM MdaConnectionProfile;
DELETE FROM CommonSequenceSegment;

INSERT INTO CommonSequenceSegment (
    tenantId,
    lastOperateUserId,
    seqCode,
    seqName,
    nextStartId,
    stepSize,
    versionNo,
    remark,
    sortnum,
    status)
VALUES (
    1,
    1,
    'MdaConnectionProfileId',
    'MDA连接配置主键号段',
    100000,
    1000,
    0,
    '真实数据库测试号段',
    10.00,
    1);
