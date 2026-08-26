CREATE TABLE AiDesktopEvolutionDeliberation (
  deliberationId TEXT PRIMARY KEY,
  topicId TEXT,
  status TEXT NOT NULL,
  candidateJson TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopEvolutionDeliberation_Status CHECK (status IN ('questioning', 'ready-to-establish', 'established', 'blocked')),
  CONSTRAINT CK_AiDesktopEvolutionDeliberation_Candidate CHECK (candidateJson IS NULL OR json_valid(candidateJson))
) STRICT;

CREATE INDEX IX_AiDesktopEvolutionDeliberation_Topic
ON AiDesktopEvolutionDeliberation (topicId, updatedAt DESC);

CREATE TABLE AiDesktopEvolutionSourceSnapshot (
  snapshotId TEXT PRIMARY KEY,
  deliberationId TEXT NOT NULL,
  source TEXT NOT NULL,
  conversationId TEXT NOT NULL,
  sourceMessageId TEXT NOT NULL,
  sequenceNumber INTEGER NOT NULL,
  role TEXT NOT NULL,
  responsePhase TEXT,
  content TEXT NOT NULL,
  originalCreatedAt TEXT NOT NULL,
  capturedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopEvolutionSourceSnapshot_Deliberation FOREIGN KEY (deliberationId) REFERENCES AiDesktopEvolutionDeliberation (deliberationId),
  CONSTRAINT CK_AiDesktopEvolutionSourceSnapshot_Source CHECK (source IN ('nangong', 'codex')),
  CONSTRAINT CK_AiDesktopEvolutionSourceSnapshot_Sequence CHECK (sequenceNumber >= 0),
  CONSTRAINT UK_AiDesktopEvolutionSourceSnapshot_Source UNIQUE (deliberationId, source, sourceMessageId)
) STRICT;

CREATE INDEX IX_AiDesktopEvolutionSourceSnapshot_Conversation
ON AiDesktopEvolutionSourceSnapshot (deliberationId, source, conversationId, sequenceNumber);

CREATE TABLE AiDesktopEvolutionArchiveRecord (
  recordId TEXT PRIMARY KEY,
  deliberationId TEXT,
  topicId TEXT,
  proposalId TEXT,
  taskId TEXT,
  sequenceNumber INTEGER NOT NULL,
  category TEXT NOT NULL,
  eventType TEXT NOT NULL,
  actor TEXT NOT NULL,
  title TEXT NOT NULL,
  originalPayloadJson TEXT NOT NULL,
  occurredAt TEXT NOT NULL,
  recordedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopEvolutionArchiveRecord_Category CHECK (category IN ('source', 'deliberation', 'topic', 'proposal', 'approval', 'distribution', 'execution', 'test', 'release', 'acceptance', 'recovery')),
  CONSTRAINT CK_AiDesktopEvolutionArchiveRecord_Actor CHECK (actor IN ('han-li', 'nangong-wan', 'codex', 'linghu-ancestor', 'system', 'user')),
  CONSTRAINT CK_AiDesktopEvolutionArchiveRecord_Sequence CHECK (sequenceNumber >= 1),
  CONSTRAINT CK_AiDesktopEvolutionArchiveRecord_Payload CHECK (json_valid(originalPayloadJson))
) STRICT;

CREATE INDEX IX_AiDesktopEvolutionArchiveRecord_TopicTimeline
ON AiDesktopEvolutionArchiveRecord (topicId, occurredAt, sequenceNumber);

CREATE INDEX IX_AiDesktopEvolutionArchiveRecord_DeliberationTimeline
ON AiDesktopEvolutionArchiveRecord (deliberationId, occurredAt, sequenceNumber);
