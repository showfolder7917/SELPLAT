-- 人物会话是训练语料的来源之一；来源和说话人不能再枚举固定人物，否则新增人物仍要改数据库。
CREATE TABLE AiDesktopTrainingCorpusTopicUnified (
  corpusTopicId TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  sourceConversationId TEXT NOT NULL,
  sourceTurnId TEXT NOT NULL,
  title TEXT NOT NULL,
  topicType TEXT NOT NULL,
  inferredIntent TEXT,
  tagsJson TEXT NOT NULL,
  definitionSource TEXT NOT NULL DEFAULT 'pending',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT UK_AiDesktopTrainingCorpusTopic_Turn UNIQUE (source, sourceTurnId),
  CONSTRAINT CK_AiDesktopTrainingCorpusTopic_Source CHECK (length(trim(source)) > 0),
  CONSTRAINT CK_AiDesktopTrainingCorpusTopic_Tags CHECK (json_valid(tagsJson) AND json_type(tagsJson) = 'array'),
  CONSTRAINT CK_AiDesktopTrainingCorpusTopic_Definition CHECK (definitionSource IN ('pending', 'ai-confirmed'))
) STRICT;

CREATE TABLE AiDesktopTrainingCorpusMessageUnified (
  corpusMessageId TEXT PRIMARY KEY,
  corpusTopicId TEXT NOT NULL,
  source TEXT NOT NULL,
  sourceMessageId TEXT NOT NULL,
  sourceConversationId TEXT NOT NULL,
  sourceTurnId TEXT NOT NULL,
  sequenceNumber INTEGER NOT NULL,
  speakerRole TEXT NOT NULL,
  content TEXT NOT NULL,
  contentRetention TEXT NOT NULL,
  evidenceTier TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  recordedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopTrainingCorpusMessage_Topic
    FOREIGN KEY (corpusTopicId) REFERENCES AiDesktopTrainingCorpusTopicUnified (corpusTopicId),
  CONSTRAINT UK_AiDesktopTrainingCorpusMessage_Source UNIQUE (source, sourceMessageId),
  CONSTRAINT UK_AiDesktopTrainingCorpusMessage_Sequence UNIQUE (source, sourceConversationId, sequenceNumber),
  CONSTRAINT CK_AiDesktopTrainingCorpusMessage_Source CHECK (length(trim(source)) > 0),
  CONSTRAINT CK_AiDesktopTrainingCorpusMessage_Role CHECK (length(trim(speakerRole)) > 0),
  CONSTRAINT CK_AiDesktopTrainingCorpusMessage_Retention CHECK (contentRetention IN ('exact', 'preview-300')),
  CONSTRAINT CK_AiDesktopTrainingCorpusMessage_Evidence CHECK (evidenceTier IN ('primary', 'supporting', 'low')),
  CONSTRAINT CK_AiDesktopTrainingCorpusMessage_Sequence CHECK (sequenceNumber >= 0)
) STRICT;

INSERT INTO AiDesktopTrainingCorpusTopicUnified
SELECT corpusTopicId, source, sourceConversationId, sourceTurnId, title, topicType, inferredIntent,
  tagsJson, definitionSource, createdAt, updatedAt
FROM AiDesktopTrainingCorpusTopic;

INSERT INTO AiDesktopTrainingCorpusMessageUnified
SELECT corpusMessageId, corpusTopicId, source, sourceMessageId, sourceConversationId, sourceTurnId,
  sequenceNumber, speakerRole, content, contentRetention, evidenceTier, createdAt, recordedAt
FROM AiDesktopTrainingCorpusMessage;

DROP TRIGGER AiDesktopTrainingCorpusTopic_AfterInsert;
DROP TRIGGER AiDesktopTrainingCorpusTopic_AfterUpdate;
DROP TRIGGER AiDesktopTrainingCorpusTopic_AfterDelete;
DROP TABLE AiDesktopTrainingCorpusMessage;
DROP TABLE AiDesktopTrainingCorpusTopic;
ALTER TABLE AiDesktopTrainingCorpusTopicUnified RENAME TO AiDesktopTrainingCorpusTopic;
ALTER TABLE AiDesktopTrainingCorpusMessageUnified RENAME TO AiDesktopTrainingCorpusMessage;

CREATE INDEX IX_AiDesktopTrainingCorpusMessage_SourceTime
ON AiDesktopTrainingCorpusMessage (source, createdAt DESC);
CREATE INDEX IX_AiDesktopTrainingCorpusMessage_Conversation
ON AiDesktopTrainingCorpusMessage (source, sourceConversationId, sequenceNumber);
CREATE INDEX IX_AiDesktopTrainingCorpusMessage_Turn
ON AiDesktopTrainingCorpusMessage (sourceTurnId, createdAt);
CREATE INDEX IX_AiDesktopTrainingCorpusTopic_SourceTime
ON AiDesktopTrainingCorpusTopic (source, createdAt DESC);

-- 全文检索表保留原数据，只重建随主题增删改同步的触发器。
CREATE TRIGGER AiDesktopTrainingCorpusTopic_AfterInsert
AFTER INSERT ON AiDesktopTrainingCorpusTopic BEGIN
  INSERT INTO AiDesktopTrainingCorpusTopicSearch (corpusTopicId, title, topicType, inferredIntent, tags)
  VALUES (new.corpusTopicId, new.title, new.topicType, new.inferredIntent, new.tagsJson);
END;

CREATE TRIGGER AiDesktopTrainingCorpusTopic_AfterUpdate
AFTER UPDATE ON AiDesktopTrainingCorpusTopic BEGIN
  DELETE FROM AiDesktopTrainingCorpusTopicSearch WHERE corpusTopicId = old.corpusTopicId;
  INSERT INTO AiDesktopTrainingCorpusTopicSearch (corpusTopicId, title, topicType, inferredIntent, tags)
  VALUES (new.corpusTopicId, new.title, new.topicType, new.inferredIntent, new.tagsJson);
END;

CREATE TRIGGER AiDesktopTrainingCorpusTopic_AfterDelete
AFTER DELETE ON AiDesktopTrainingCorpusTopic BEGIN
  DELETE FROM AiDesktopTrainingCorpusTopicSearch WHERE corpusTopicId = old.corpusTopicId;
END;
