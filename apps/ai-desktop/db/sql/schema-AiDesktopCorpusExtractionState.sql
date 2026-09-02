CREATE TABLE AiDesktopCorpusExtractionState (
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
  CONSTRAINT FK_AiDesktopCorpusExtractionState_Topic FOREIGN KEY (corpusTopicId) REFERENCES AiDesktopTrainingCorpusTopic (corpusTopicId),
  CONSTRAINT UK_AiDesktopCorpusExtractionState_Target UNIQUE (corpusTopicId, stableUserId, extractorType),
  CONSTRAINT CK_AiDesktopCorpusExtractionState_Status CHECK (status IN ('pending', 'processing', 'completed', 'retryable', 'blocked', 'superseded')),
  CONSTRAINT CK_AiDesktopCorpusExtractionState_Attempt CHECK (attemptCount >= 0),
  CONSTRAINT CK_AiDesktopCorpusExtractionState_Hash CHECK (length(sourceContentHash) = 64)
) STRICT;

CREATE INDEX IX_AiDesktopCorpusExtractionState_Queue
ON AiDesktopCorpusExtractionState (stableUserId, extractorType, status, nextRetryAt, updatedAt);
