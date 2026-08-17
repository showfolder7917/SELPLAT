CREATE TABLE IF NOT EXISTS JapaneseN2QuestionAnswerRecord (
    id BIGINT PRIMARY KEY,
    tenantId BIGINT NOT NULL,
    lastOperateUserId BIGINT NOT NULL,
    userId BIGINT NOT NULL,
    roundId BIGINT NOT NULL,
    questionId BIGINT NOT NULL,
    selectedOption VARCHAR(1) NOT NULL,
    correctFlag BOOLEAN NOT NULL,
    answeredAt TIMESTAMP NOT NULL,
    status INT NOT NULL DEFAULT 1,
    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL,
    CONSTRAINT FK_JapaneseN2QuestionAnswerRecord_Round
        FOREIGN KEY (roundId) REFERENCES JapaneseN2QuestionAnswerRound(id),
    CONSTRAINT FK_JapaneseN2QuestionAnswerRecord_Question
        FOREIGN KEY (questionId) REFERENCES JapaneseN2BlueBookQuestion(id),
    CONSTRAINT CK_JapaneseN2QuestionAnswerRecord_Option
        CHECK (selectedOption IN ('A', 'B', 'C', 'D'))
);

-- 旧版每轮每题唯一约束会吞掉后续作答；删除后每次点击都能形成独立正确或错误明细。
ALTER TABLE JapaneseN2QuestionAnswerRecord
    DROP CONSTRAINT IF EXISTS UK_JapaneseN2QuestionAnswerRecord_RoundQuestion;

CREATE INDEX IF NOT EXISTS IDX_JapaneseN2QuestionAnswerRecord_UserQuestion
    ON JapaneseN2QuestionAnswerRecord (tenantId, userId, questionId, status);
CREATE INDEX IF NOT EXISTS IDX_JapaneseN2QuestionAnswerRecord_UserRound
    ON JapaneseN2QuestionAnswerRecord (tenantId, userId, roundId, status);

COMMENT ON TABLE JapaneseN2QuestionAnswerRecord IS 'N2 蓝宝书用户每次选择的独立作答明细表';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.id IS '主键，由 JapaneseN2QuestionAnswerRecordId 号段生成';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.tenantId IS '租户主键';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.lastOperateUserId IS '最后操作用户主键';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.userId IS '做题用户主键，由服务端身份写入';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.roundId IS '所属做题轮次主键';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.questionId IS 'N2 题目主键';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.selectedOption IS '用户选择的 A 至 D';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.correctFlag IS '本次选择是否正确';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.answeredAt IS '正式提交答案的时间';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.status IS '状态，1 有效、0 已删除';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.sortnum IS '人工排序值，升序';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.createdAt IS '创建时间';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRecord.updatedAt IS '最后更新时间';
