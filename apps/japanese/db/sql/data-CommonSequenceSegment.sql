-- 日语 N2 题库主键号段仅在缺失时创建，应用重启不得覆盖已推进游标。
INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize,
    versionNo, remark, sortnum, status
) SELECT
    1, 1, 'JapaneseN2BlueBookQuestionId', 'JapaneseN2BlueBookQuestion 主键号段',
    100000, 1000, 0, '按模块缓存号段生成主键', 10.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'JapaneseN2BlueBookQuestionId'
);
