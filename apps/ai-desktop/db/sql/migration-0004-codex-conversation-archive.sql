CREATE TABLE AiDesktopConversationArchiveMessage (
  messageId TEXT PRIMARY KEY,
  threadId TEXT NOT NULL,
  sequenceNumber INTEGER NOT NULL,
  sourceRole TEXT NOT NULL,
  responsePhase TEXT,
  content TEXT NOT NULL,
  contentRetention TEXT NOT NULL,
  inferredIntent TEXT,
  topicTitle TEXT NOT NULL,
  topicType TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  recordedAt TEXT NOT NULL,
  CONSTRAINT UK_AiDesktopConversationArchiveMessage_Sequence UNIQUE (threadId, sequenceNumber),
  CONSTRAINT CK_AiDesktopConversationArchiveMessage_Role CHECK (sourceRole IN ('user', 'codex')),
  CONSTRAINT CK_AiDesktopConversationArchiveMessage_Phase CHECK (responsePhase IS NULL OR responsePhase IN ('commentary', 'final_answer')),
  CONSTRAINT CK_AiDesktopConversationArchiveMessage_Retention CHECK (contentRetention IN ('exact', 'preview-80')),
  CONSTRAINT CK_AiDesktopConversationArchiveMessage_Sequence CHECK (sequenceNumber >= 0)
) STRICT;

CREATE INDEX IX_AiDesktopConversationArchiveMessage_Thread
ON AiDesktopConversationArchiveMessage (threadId, sequenceNumber);

CREATE INDEX IX_AiDesktopConversationArchiveMessage_UserIntent
ON AiDesktopConversationArchiveMessage (sourceRole, createdAt DESC);
