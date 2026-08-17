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

-- 作答轮次使用独立号段，避免与题目或作答明细共享游标。
INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize,
    versionNo, remark, sortnum, status
) SELECT
    1, 1, 'JapaneseN2QuestionAnswerRoundId', 'JapaneseN2QuestionAnswerRound 主键号段',
    100000, 1000, 0, '独立表号段初始值100000_v2', 20.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'JapaneseN2QuestionAnswerRoundId'
);

-- 每题作答明细使用独立号段，历史轮次增长不影响其他业务表。
INSERT INTO CommonSequenceSegment (
    tenantId, lastOperateUserId, seqCode, seqName, nextStartId, stepSize,
    versionNo, remark, sortnum, status
) SELECT
    1, 1, 'JapaneseN2QuestionAnswerRecordId', 'JapaneseN2QuestionAnswerRecord 主键号段',
    100000, 1000, 0, '独立表号段初始值100000_v2', 30.00, 1
WHERE NOT EXISTS (
    SELECT 1 FROM CommonSequenceSegment WHERE seqCode = 'JapaneseN2QuestionAnswerRecordId'
);
