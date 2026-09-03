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

-- 主题表有两条直接外键和一条需求轨迹下游外键；一起重建才能在保持 foreign_keys=ON 时原子替换主题表。
CREATE TABLE AiDesktopCorpusExtractionStateUnified (
  extractionId TEXT PRIMARY KEY,
  corpusTopicId TEXT NOT NULL,
  stableUserId TEXT NOT NULL,
  extractorType TEXT NOT NULL,
  sourceContentHash TEXT NOT NULL,
  extractorVersion TEXT NOT NULL,
  status TEXT NOT NULL,
  attemptCount INTEGER NOT NULL,
  claimedAt TEXT,
  completedAt TEXT,
  nextRetryAt TEXT,
  lastError TEXT,
  updatedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopCorpusExtractionState_Topic
    FOREIGN KEY (corpusTopicId) REFERENCES AiDesktopTrainingCorpusTopicUnified (corpusTopicId),
  CONSTRAINT UK_AiDesktopCorpusExtractionState_Target UNIQUE (corpusTopicId, stableUserId, extractorType),
  CONSTRAINT CK_AiDesktopCorpusExtractionState_Status CHECK (status IN ('pending', 'processing', 'completed', 'retryable', 'blocked', 'superseded')),
  CONSTRAINT CK_AiDesktopCorpusExtractionState_Attempt CHECK (attemptCount >= 0),
  CONSTRAINT CK_AiDesktopCorpusExtractionState_Hash CHECK (length(sourceContentHash) = 64)
) STRICT;

CREATE TABLE AiDesktopRequirementTrajectoryUnified (
  trajectoryId TEXT PRIMARY KEY,
  stableUserId TEXT NOT NULL,
  sourceCorpusTopicId TEXT NOT NULL,
  projectScope TEXT NOT NULL,
  customerGoal TEXT NOT NULL,
  confirmedFactsJson TEXT NOT NULL,
  assumptionsJson TEXT NOT NULL,
  conflictsJson TEXT NOT NULL,
  informationGapsJson TEXT NOT NULL,
  implicitRequirementsJson TEXT NOT NULL,
  selectedAction TEXT NOT NULL,
  questionAsked TEXT,
  questionReason TEXT,
  customerAnswer TEXT,
  resultSummary TEXT,
  evolutionDirection TEXT,
  acceptanceEvidenceJson TEXT NOT NULL,
  maturityScore REAL NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopRequirementTrajectory_Topic
    FOREIGN KEY (sourceCorpusTopicId) REFERENCES AiDesktopTrainingCorpusTopicUnified (corpusTopicId),
  CONSTRAINT UK_AiDesktopRequirementTrajectory_Source UNIQUE (stableUserId, sourceCorpusTopicId),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Maturity CHECK (maturityScore >= 0 AND maturityScore <= 1),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Confirmed CHECK (json_valid(confirmedFactsJson) AND json_type(confirmedFactsJson) = 'array'),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Assumptions CHECK (json_valid(assumptionsJson) AND json_type(assumptionsJson) = 'array'),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Conflicts CHECK (json_valid(conflictsJson) AND json_type(conflictsJson) = 'array'),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Gaps CHECK (json_valid(informationGapsJson) AND json_type(informationGapsJson) = 'array'),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Implicit CHECK (json_valid(implicitRequirementsJson) AND json_type(implicitRequirementsJson) = 'array'),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Acceptance CHECK (json_valid(acceptanceEvidenceJson) AND json_type(acceptanceEvidenceJson) = 'array')
) STRICT;

CREATE TABLE AiDesktopRequirementNodeUnified (
  requirementNodeId TEXT PRIMARY KEY,
  trajectoryId TEXT NOT NULL,
  nodeKey TEXT NOT NULL,
  parentNodeKey TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  statement TEXT NOT NULL,
  critical INTEGER NOT NULL,
  evidenceMessageIdsJson TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopRequirementNode_Trajectory
    FOREIGN KEY (trajectoryId) REFERENCES AiDesktopRequirementTrajectoryUnified (trajectoryId),
  CONSTRAINT UK_AiDesktopRequirementNode_Key UNIQUE (trajectoryId, nodeKey),
  CONSTRAINT CK_AiDesktopRequirementNode_Status CHECK (status IN ('confirmed', 'investigate', 'inferred', 'conflicted', 'waiting-customer', 'implemented-pending-acceptance', 'accepted')),
  CONSTRAINT CK_AiDesktopRequirementNode_Critical CHECK (critical IN (0, 1)),
  CONSTRAINT CK_AiDesktopRequirementNode_Evidence CHECK (json_valid(evidenceMessageIdsJson) AND json_type(evidenceMessageIdsJson) = 'array')
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

INSERT INTO AiDesktopCorpusExtractionStateUnified
SELECT extractionId, corpusTopicId, stableUserId, extractorType, sourceContentHash, extractorVersion,
  status, attemptCount, claimedAt, completedAt, nextRetryAt, lastError, updatedAt
FROM AiDesktopCorpusExtractionState;

INSERT INTO AiDesktopRequirementTrajectoryUnified
SELECT trajectoryId, stableUserId, sourceCorpusTopicId, projectScope, customerGoal, confirmedFactsJson,
  assumptionsJson, conflictsJson, informationGapsJson, implicitRequirementsJson, selectedAction,
  questionAsked, questionReason, customerAnswer, resultSummary, evolutionDirection,
  acceptanceEvidenceJson, maturityScore, createdAt, updatedAt
FROM AiDesktopRequirementTrajectory;

INSERT INTO AiDesktopRequirementNodeUnified
SELECT requirementNodeId, trajectoryId, nodeKey, parentNodeKey, title, category, status, statement,
  critical, evidenceMessageIdsJson, createdAt, updatedAt
FROM AiDesktopRequirementNode;

DROP TRIGGER AiDesktopTrainingCorpusTopic_AfterInsert;
DROP TRIGGER AiDesktopTrainingCorpusTopic_AfterUpdate;
DROP TRIGGER AiDesktopTrainingCorpusTopic_AfterDelete;
DROP TABLE AiDesktopRequirementNode;
DROP TABLE AiDesktopCorpusExtractionState;
DROP TABLE AiDesktopRequirementTrajectory;
DROP TABLE AiDesktopTrainingCorpusMessage;
DROP TABLE AiDesktopTrainingCorpusTopic;
ALTER TABLE AiDesktopTrainingCorpusTopicUnified RENAME TO AiDesktopTrainingCorpusTopic;
ALTER TABLE AiDesktopTrainingCorpusMessageUnified RENAME TO AiDesktopTrainingCorpusMessage;
ALTER TABLE AiDesktopCorpusExtractionStateUnified RENAME TO AiDesktopCorpusExtractionState;
ALTER TABLE AiDesktopRequirementTrajectoryUnified RENAME TO AiDesktopRequirementTrajectory;
ALTER TABLE AiDesktopRequirementNodeUnified RENAME TO AiDesktopRequirementNode;

CREATE INDEX IX_AiDesktopTrainingCorpusMessage_SourceTime
ON AiDesktopTrainingCorpusMessage (source, createdAt DESC);
CREATE INDEX IX_AiDesktopTrainingCorpusMessage_Conversation
ON AiDesktopTrainingCorpusMessage (source, sourceConversationId, sequenceNumber);
CREATE INDEX IX_AiDesktopTrainingCorpusMessage_Turn
ON AiDesktopTrainingCorpusMessage (sourceTurnId, createdAt);
CREATE INDEX IX_AiDesktopTrainingCorpusTopic_SourceTime
ON AiDesktopTrainingCorpusTopic (source, createdAt DESC);
CREATE INDEX IX_AiDesktopCorpusExtractionState_Queue
ON AiDesktopCorpusExtractionState (stableUserId, extractorType, status, nextRetryAt, updatedAt);
CREATE INDEX IX_AiDesktopRequirementTrajectory_Retrieval
ON AiDesktopRequirementTrajectory (stableUserId, projectScope, maturityScore DESC, updatedAt DESC);
CREATE INDEX IX_AiDesktopRequirementNode_Open
ON AiDesktopRequirementNode (trajectoryId, critical, status, updatedAt DESC);

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
