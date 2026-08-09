CREATE TABLE IF NOT EXISTS JapaneseN2BlueBookQuestion (
    id BIGINT PRIMARY KEY,
    tenantId BIGINT NOT NULL,
    lastOperateUserId BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    jlptLevel VARCHAR(8) NOT NULL DEFAULT 'N2',
    sourceBook VARCHAR(100) NOT NULL DEFAULT '蓝宝书1000题',
    sourceQuestionNo INT NOT NULL,
    questionType VARCHAR(32) NOT NULL,
    questionText VARCHAR(4000) NOT NULL,
    optionA VARCHAR(2000) NOT NULL,
    optionB VARCHAR(2000) NOT NULL,
    optionC VARCHAR(2000) NOT NULL,
    optionD VARCHAR(2000) NOT NULL,
    correctOption VARCHAR(1) NOT NULL,
    explanation VARCHAR(8000),
    audioText VARCHAR(4000),
    imageStorageProvider VARCHAR(32),
    imageStorageKey VARCHAR(500),
    imageUrl VARCHAR(1000),
    audioStorageProvider VARCHAR(32),
    audioStorageKey VARCHAR(500),
    audioUrl VARCHAR(1000),
    sortnum DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status INT NOT NULL DEFAULT 1,
    createdAt TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP NOT NULL,
    CONSTRAINT UK_JapaneseN2BlueBookQuestion_Source
        UNIQUE (tenantId, jlptLevel, sourceBook, sourceQuestionNo),
    CONSTRAINT CK_JapaneseN2BlueBookQuestion_Type
        CHECK (questionType IN ('PRONUNCIATION', 'KANJI', 'GRAMMAR')),
    CONSTRAINT CK_JapaneseN2BlueBookQuestion_Answer
        CHECK (correctOption IN ('A', 'B', 'C', 'D'))
);

COMMENT ON TABLE JapaneseN2BlueBookQuestion IS 'N2 蓝宝书1000题独立题库表';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.id IS '主键，由 JapaneseN2BlueBookQuestionId 号段生成';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.tenantId IS '租户主键';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.lastOperateUserId IS '最后操作用户主键';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.name IS '题目显示名称';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.jlptLevel IS 'JLPT 等级，当前表固定 N2';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.sourceBook IS '来源题库，当前默认蓝宝书1000题';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.sourceQuestionNo IS '来源题号，例如 416';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.questionType IS '题型：PRONUNCIATION、KANJI、GRAMMAR';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.questionText IS '日语题干';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.optionA IS 'A 选项';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.optionB IS 'B 选项';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.optionC IS 'C 选项';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.optionD IS 'D 选项';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.correctOption IS '正确选项 A 至 D';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.explanation IS 'Codex 生成并允许人工修订的解释';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.audioText IS 'NanamiNeural 朗读文本，为空时使用题干';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.imageStorageProvider IS '图片存储提供方，当前 local、未来可替换云存储';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.imageStorageKey IS '图片对象键';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.imageUrl IS '图片访问 URL';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.audioStorageProvider IS '语音存储提供方，当前 local、未来可替换云存储';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.audioStorageKey IS '语音对象键';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.audioUrl IS '语音访问 URL';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.sortnum IS '人工排序值，升序';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.status IS '状态，1 有效、0 已删除';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.createdAt IS '创建时间';
COMMENT ON COLUMN JapaneseN2BlueBookQuestion.updatedAt IS '最后更新时间';
