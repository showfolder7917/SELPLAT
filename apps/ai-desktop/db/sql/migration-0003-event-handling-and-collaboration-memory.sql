ALTER TABLE AiDesktopEvent ADD COLUMN handlingOwnerId TEXT;
ALTER TABLE AiDesktopEvent ADD COLUMN handlingStartedAt TEXT;
ALTER TABLE AiDesktopEvent ADD COLUMN resolutionSummary TEXT;

CREATE INDEX IX_AiDesktopEvent_HandlingQueue
ON AiDesktopEvent (status, handlingOwnerId, occurredAt);

CREATE TABLE AiDesktopConversationMemory (
  messageId TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL,
  sequenceNumber INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  contentPreview TEXT NOT NULL,
  inferredIntent TEXT,
  createdAt TEXT NOT NULL,
  recordedAt TEXT NOT NULL,
  conversationTopicId TEXT,
  CONSTRAINT CK_AiDesktopConversationMemory_Role CHECK (role IN ('user', 'nangong')),
  CONSTRAINT CK_AiDesktopConversationMemory_Sequence CHECK (sequenceNumber >= 0),
  CONSTRAINT UK_AiDesktopConversationMemory_Sequence UNIQUE (conversationId, sequenceNumber)
) STRICT;

CREATE INDEX IX_AiDesktopConversationMemory_UserConcern
ON AiDesktopConversationMemory (role, createdAt DESC);

CREATE TABLE AiDesktopConversationTopic (
  conversationTopicId TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL,
  title TEXT NOT NULL,
  topicType TEXT NOT NULL,
  state TEXT NOT NULL,
  detectedFromMessageId TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  endedAt TEXT,
  updatedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopConversationTopic_DetectedMessage FOREIGN KEY (detectedFromMessageId) REFERENCES AiDesktopConversationMemory (messageId),
  CONSTRAINT CK_AiDesktopConversationTopic_State CHECK (state IN ('active', 'closed'))
) STRICT;

CREATE INDEX IX_AiDesktopConversationTopic_ConversationState
ON AiDesktopConversationTopic (conversationId, state, updatedAt DESC);

CREATE TABLE AiDesktopConversationTopicLink (
  topicId TEXT NOT NULL,
  conversationId TEXT NOT NULL,
  messageId TEXT NOT NULL,
  linkedAt TEXT NOT NULL,
  PRIMARY KEY (topicId, messageId),
  CONSTRAINT FK_AiDesktopConversationTopicLink_Message FOREIGN KEY (messageId) REFERENCES AiDesktopConversationMemory (messageId)
) STRICT;

CREATE INDEX IX_AiDesktopConversationTopicLink_Conversation
ON AiDesktopConversationTopicLink (conversationId, linkedAt DESC);
