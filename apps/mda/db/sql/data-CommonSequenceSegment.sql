-- MdaConnectionProfileId 是连接配置表唯一主键号段；重复启动不得覆盖已推进游标和后台维护值。
INSERT INTO CommonSequenceSegment (
    seqCode,
    seqName,
    nextStartId,
    stepSize,
    versionNo,
    remark,
    sortnum,
    status)
SELECT
    'MdaConnectionProfileId',
    'MDA连接配置主键号段',
    GREATEST(100000, COALESCE((SELECT MAX(id) + 1 FROM MdaConnectionProfile), 100000)),
    1000,
    0,
    '按模块缓存号段生成MDA连接配置主键',
    10.00,
    1
WHERE NOT EXISTS (
    SELECT 1
      FROM CommonSequenceSegment
     WHERE seqCode = 'MdaConnectionProfileId'
);
