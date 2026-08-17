CREATE TABLE IF NOT EXISTS JapaneseN2QuestionAnswerRound (
    id BIGINT PRIMARY KEY,
    tenantId BIGINT NOT NULL,
    lastOperateUserId BIGINT NOT NULL,
    userId BIGINT NOT NULL,
    roundNo INT NOT NULL,
    roundStatus VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    startedAt TIMESTAMP NOT NULL,
    completedAt TIMESTAMP,
    status INT NOT NULL DEFAULT 1,
    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL,
    CONSTRAINT UK_JapaneseN2QuestionAnswerRound_UserRound
        UNIQUE (tenantId, userId, roundNo),
    CONSTRAINT CK_JapaneseN2QuestionAnswerRound_Status
        CHECK (roundStatus IN ('IN_PROGRESS', 'COMPLETED'))
);

CREATE INDEX IF NOT EXISTS IDX_JapaneseN2QuestionAnswerRound_Current
    ON JapaneseN2QuestionAnswerRound (tenantId, userId, roundStatus, status, roundNo);

COMMENT ON TABLE JapaneseN2QuestionAnswerRound IS 'N2 蓝宝书用户作答轮次表';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.id IS '主键，由 JapaneseN2QuestionAnswerRoundId 号段生成';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.tenantId IS '租户主键';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.lastOperateUserId IS '最后操作用户主键';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.userId IS '本轮做题用户主键，由服务端身份写入';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.roundNo IS '当前用户从 1 开始递增的做题轮次';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.roundStatus IS '轮次状态：IN_PROGRESS 或 COMPLETED';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.startedAt IS '本轮开始时间';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.completedAt IS '本轮完成或主动结束时间';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.status IS '状态，1 有效、0 已删除';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.sortnum IS '人工排序值，升序';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.createdAt IS '创建时间';
COMMENT ON COLUMN JapaneseN2QuestionAnswerRound.updatedAt IS '最后更新时间';
