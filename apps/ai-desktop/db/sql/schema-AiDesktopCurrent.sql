CREATE TABLE AiDesktopSchemaVersion (
  id INTEGER PRIMARY KEY,
  versionCode TEXT NOT NULL,
  description TEXT NOT NULL,
  checksum TEXT NOT NULL,
  appliedAt TEXT NOT NULL,
  durationMs INTEGER NOT NULL,
  successFlag INTEGER NOT NULL,
  CONSTRAINT UK_AiDesktopSchemaVersion_VersionCode UNIQUE (versionCode),
  CONSTRAINT CK_AiDesktopSchemaVersion_VersionCode CHECK (versionCode GLOB '[0-9][0-9][0-9][0-9]'),
  CONSTRAINT CK_AiDesktopSchemaVersion_Checksum CHECK (length(checksum) = 64 AND checksum NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT CK_AiDesktopSchemaVersion_DurationMs CHECK (durationMs >= 0),
  CONSTRAINT CK_AiDesktopSchemaVersion_SuccessFlag CHECK (successFlag IN (0, 1))
) STRICT;

CREATE TABLE AiDesktopEvent (
  eventId TEXT PRIMARY KEY,
  correlationId TEXT,
  sourceType TEXT NOT NULL,
  sourceId TEXT NOT NULL,
  eventType TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  payloadJson TEXT NOT NULL,
  fingerprint TEXT,
  occurredAt TEXT NOT NULL,
  recordedAt TEXT NOT NULL,
  resolvedAt TEXT,
  handlingOwnerId TEXT,
  handlingStartedAt TEXT,
  resolutionSummary TEXT,
  CONSTRAINT CK_AiDesktopEvent_SourceType CHECK (sourceType IN ('member', 'system', 'launcher', 'task')),
  CONSTRAINT CK_AiDesktopEvent_Category CHECK (category IN ('state-change', 'approval', 'execution', 'technical-error', 'business-exception', 'stalled', 'audit')),
  CONSTRAINT CK_AiDesktopEvent_Severity CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  CONSTRAINT CK_AiDesktopEvent_Status CHECK (status IN ('observed', 'open', 'processing', 'resolved', 'ignored')),
  CONSTRAINT CK_AiDesktopEvent_PayloadJson CHECK (json_valid(payloadJson))
) STRICT;

CREATE INDEX IX_AiDesktopEvent_CorrelationOccurredAt ON AiDesktopEvent (correlationId, occurredAt DESC);
CREATE INDEX IX_AiDesktopEvent_OpenCategory ON AiDesktopEvent (status, category, occurredAt DESC);
CREATE UNIQUE INDEX UK_AiDesktopEvent_Fingerprint ON AiDesktopEvent (fingerprint) WHERE fingerprint IS NOT NULL;

CREATE TABLE AiDesktopWorkflowRun (
  workflowId TEXT PRIMARY KEY,
  topicId TEXT,
  proposalId TEXT,
  origin TEXT NOT NULL,
  title TEXT NOT NULL,
  state TEXT NOT NULL,
  currentStage TEXT NOT NULL,
  currentOwnerId TEXT NOT NULL,
  recoveryPoint TEXT,
  nextLaunchAt TEXT,
  startedAt TEXT NOT NULL,
  completedAt TEXT,
  updatedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopWorkflowRun_Origin CHECK (origin IN ('nangong', 'linghu', 'collaboration', 'launcher'))
) STRICT;

CREATE INDEX IX_AiDesktopWorkflowRun_StateUpdatedAt ON AiDesktopWorkflowRun (state, updatedAt DESC);

CREATE TABLE AiDesktopTaskExecution (
  taskId TEXT PRIMARY KEY,
  workflowId TEXT,
  proposalId TEXT,
  title TEXT NOT NULL,
  initiatorMemberId TEXT,
  executorMemberId TEXT,
  state TEXT NOT NULL,
  phase TEXT,
  runtimeStatus TEXT NOT NULL,
  heartbeatAt TEXT,
  timeoutAt TEXT,
  retryCount INTEGER NOT NULL DEFAULT 0,
  maxRetries INTEGER NOT NULL DEFAULT 3,
  recoveryPoint TEXT,
  blockingKind TEXT NOT NULL DEFAULT 'none',
  blockingReason TEXT,
  acceptanceState TEXT NOT NULL DEFAULT 'pending',
  startedAt TEXT NOT NULL,
  completedAt TEXT,
  updatedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopTaskExecution_Workflow FOREIGN KEY (workflowId) REFERENCES AiDesktopWorkflowRun (workflowId),
  CONSTRAINT CK_AiDesktopTaskExecution_RuntimeStatus CHECK (runtimeStatus IN ('queued', 'running', 'waiting', 'stalled', 'recovering', 'completed', 'cancelled', 'failed')),
  CONSTRAINT CK_AiDesktopTaskExecution_RetryCount CHECK (retryCount >= 0 AND retryCount <= maxRetries),
  CONSTRAINT CK_AiDesktopTaskExecution_MaxRetries CHECK (maxRetries BETWEEN 0 AND 10),
  CONSTRAINT CK_AiDesktopTaskExecution_BlockingKind CHECK (blockingKind IN ('none', 'infrastructure', 'data', 'code', 'test', 'business')),
  CONSTRAINT CK_AiDesktopTaskExecution_AcceptanceState CHECK (acceptanceState IN ('pending', 'passed', 'failed', 'cancelled'))
) STRICT;

CREATE INDEX IX_AiDesktopTaskExecution_RuntimeHeartbeat ON AiDesktopTaskExecution (runtimeStatus, heartbeatAt);
CREATE INDEX IX_AiDesktopTaskExecution_Proposal ON AiDesktopTaskExecution (proposalId, updatedAt DESC);

CREATE TABLE AiDesktopApprovalRecord (
  approvalId TEXT PRIMARY KEY,
  proposalId TEXT NOT NULL,
  title TEXT NOT NULL,
  proposalType TEXT NOT NULL,
  submitterId TEXT NOT NULL,
  submitterDisplayName TEXT NOT NULL,
  approverId TEXT NOT NULL,
  approverDisplayName TEXT NOT NULL,
  decision TEXT NOT NULL,
  source TEXT NOT NULL,
  advice TEXT NOT NULL,
  evidenceJson TEXT NOT NULL,
  referencedApprovalIdsJson TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  approvedAt TEXT NOT NULL,
  approvalStage TEXT NOT NULL DEFAULT 'direction',
  CONSTRAINT CK_AiDesktopApprovalRecord_Stage CHECK (approvalStage IN ('direction', 'result')),
  CONSTRAINT CK_AiDesktopApprovalRecord_Decision CHECK (decision IN ('approved', 'rejected', 'supplement-required')),
  CONSTRAINT CK_AiDesktopApprovalRecord_Source CHECK (source IN ('manual-user', 'automatic-han-li')),
  CONSTRAINT CK_AiDesktopApprovalRecord_EvidenceJson CHECK (json_valid(evidenceJson)),
  CONSTRAINT CK_AiDesktopApprovalRecord_ReferencesJson CHECK (json_valid(referencedApprovalIdsJson))
) STRICT;

CREATE INDEX IX_AiDesktopApprovalRecord_History ON AiDesktopApprovalRecord (proposalType, submitterId, approvedAt DESC);

CREATE TABLE AiDesktopMemberRuntime (
  memberId TEXT PRIMARY KEY,
  displayName TEXT NOT NULL,
  state TEXT NOT NULL,
  role TEXT,
  currentTaskId TEXT,
  generation INTEGER NOT NULL DEFAULT 0,
  heartbeatAt TEXT,
  protocolProgressAt TEXT,
  blockingReason TEXT,
  updatedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopMemberRuntime_Generation CHECK (generation >= 0)
) STRICT;

CREATE INDEX IX_AiDesktopMemberRuntime_StateHeartbeat ON AiDesktopMemberRuntime (state, heartbeatAt);

CREATE TABLE AiDesktopRuntimeSession (
  sessionId TEXT PRIMARY KEY,
  processId INTEGER NOT NULL,
  state TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  heartbeatAt TEXT NOT NULL,
  stoppedAt TEXT,
  CONSTRAINT CK_AiDesktopRuntimeSession_State CHECK (state IN ('running', 'stopped', 'interrupted')),
  CONSTRAINT CK_AiDesktopRuntimeSession_ProcessId CHECK (processId > 0)
) STRICT;

CREATE INDEX IX_AiDesktopRuntimeSession_StateHeartbeat ON AiDesktopRuntimeSession (state, heartbeatAt);

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

CREATE TABLE AiDesktopApprovalGovernance (
  governanceId TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  subjectId TEXT NOT NULL,
  correlationId TEXT,
  title TEXT NOT NULL,
  requestKind TEXT NOT NULL,
  decision TEXT NOT NULL,
  initiatorId TEXT,
  initiatorDisplayName TEXT,
  approverId TEXT NOT NULL,
  approverDisplayName TEXT NOT NULL,
  source TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidenceJson TEXT NOT NULL,
  decidedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopApprovalGovernance_Domain CHECK (domain IN ('evolution', 'collaboration-review', 'codex-command')),
  CONSTRAINT CK_AiDesktopApprovalGovernance_EvidenceJson CHECK (json_valid(evidenceJson))
) STRICT;

CREATE INDEX IX_AiDesktopApprovalGovernance_DomainDecidedAt ON AiDesktopApprovalGovernance (domain, decidedAt DESC);
CREATE INDEX IX_AiDesktopApprovalGovernance_CorrelationDecidedAt ON AiDesktopApprovalGovernance (correlationId, decidedAt DESC);

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

CREATE TABLE AiDesktopEvolutionRound (
  roundId TEXT PRIMARY KEY,
  proposalId TEXT NOT NULL,
  state TEXT NOT NULL,
  expectedTaskCount INTEGER NOT NULL,
  returnedTaskCount INTEGER NOT NULL,
  sealedAt TEXT,
  submittedToLinghuAt TEXT,
  completedAt TEXT,
  updatedAt TEXT NOT NULL,
  CONSTRAINT UK_AiDesktopEvolutionRound_Proposal UNIQUE (proposalId),
  CONSTRAINT CK_AiDesktopEvolutionRound_State CHECK (state IN ('collecting', 'sealed', 'integrating', 'blocked', 'completed')),
  CONSTRAINT CK_AiDesktopEvolutionRound_Count CHECK (expectedTaskCount > 0 AND returnedTaskCount >= 0 AND returnedTaskCount <= expectedTaskCount)
) STRICT;

CREATE INDEX IX_AiDesktopEvolutionRound_StateUpdatedAt
ON AiDesktopEvolutionRound (state, updatedAt DESC);

CREATE TABLE AiDesktopEvolutionRoundTask (
  roundId TEXT NOT NULL,
  taskId TEXT NOT NULL,
  executorMemberId TEXT,
  collectionState TEXT NOT NULL,
  resultSha TEXT,
  returnedAt TEXT,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (roundId, taskId),
  CONSTRAINT FK_AiDesktopEvolutionRoundTask_Round FOREIGN KEY (roundId) REFERENCES AiDesktopEvolutionRound (roundId),
  CONSTRAINT FK_AiDesktopEvolutionRoundTask_Task FOREIGN KEY (taskId) REFERENCES AiDesktopTaskExecution (taskId),
  CONSTRAINT CK_AiDesktopEvolutionRoundTask_State CHECK (collectionState IN ('executing', 'returned', 'sealed', 'integrating', 'blocked', 'completed'))
) STRICT;

CREATE INDEX IX_AiDesktopEvolutionRoundTask_RoundState
ON AiDesktopEvolutionRoundTask (roundId, collectionState, updatedAt DESC);

CREATE TABLE AiDesktopCorpusIngestionCheckpoint (
  sourceKey TEXT PRIMARY KEY,
  sourceThreadId TEXT,
  sourceContentHash TEXT NOT NULL,
  sourceSize INTEGER NOT NULL,
  ingestedMessageCount INTEGER NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopCorpusIngestionCheckpoint_Hash CHECK (length(sourceContentHash) = 64),
  CONSTRAINT CK_AiDesktopCorpusIngestionCheckpoint_Size CHECK (sourceSize >= 0),
  CONSTRAINT CK_AiDesktopCorpusIngestionCheckpoint_Count CHECK (ingestedMessageCount >= 0)
) STRICT;

CREATE INDEX IX_AiDesktopCorpusIngestionCheckpoint_Thread
ON AiDesktopCorpusIngestionCheckpoint (sourceThreadId, updatedAt DESC);

CREATE TABLE AiDesktopTrainingCorpusTopic (
  corpusTopicId TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  sourceConversationId TEXT NOT NULL,
  sourceTurnId TEXT NOT NULL,
  title TEXT NOT NULL,
  topicType TEXT NOT NULL,
  inferredIntent TEXT,
  tagsJson TEXT NOT NULL,
  definitionSource TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT UK_AiDesktopTrainingCorpusTopic_Turn UNIQUE (source, sourceTurnId),
  CONSTRAINT CK_AiDesktopTrainingCorpusTopic_Source CHECK (source IN ('codex', 'nangong', 'hanli')),
  CONSTRAINT CK_AiDesktopTrainingCorpusTopic_Tags CHECK (json_valid(tagsJson) AND json_type(tagsJson) = 'array'),
  CONSTRAINT CK_AiDesktopTrainingCorpusTopic_Definition CHECK (definitionSource IN ('pending', 'ai-confirmed'))
) STRICT;

CREATE VIRTUAL TABLE AiDesktopTrainingCorpusTopicSearch USING fts5(
  corpusTopicId UNINDEXED,
  title,
  topicType,
  inferredIntent,
  tags,
  tokenize='trigram'
);

CREATE TABLE AiDesktopTrainingCorpusMessage (
  corpusMessageId TEXT PRIMARY KEY,
  corpusTopicId TEXT NOT NULL,
  source TEXT NOT NULL,
  sourceConversationId TEXT NOT NULL,
  sourceTurnId TEXT NOT NULL,
  sourceMessageId TEXT NOT NULL,
  sequenceNumber INTEGER NOT NULL,
  speakerRole TEXT NOT NULL,
  content TEXT NOT NULL,
  contentRetention TEXT NOT NULL,
  evidenceTier TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  recordedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopTrainingCorpusMessage_Topic FOREIGN KEY (corpusTopicId) REFERENCES AiDesktopTrainingCorpusTopic (corpusTopicId),
  CONSTRAINT UK_AiDesktopTrainingCorpusMessage_Source UNIQUE (source, sourceMessageId),
  CONSTRAINT UK_AiDesktopTrainingCorpusMessage_Sequence UNIQUE (source, sourceConversationId, sequenceNumber),
  CONSTRAINT CK_AiDesktopTrainingCorpusMessage_Source CHECK (source IN ('codex', 'nangong', 'hanli')),
  CONSTRAINT CK_AiDesktopTrainingCorpusMessage_Role CHECK (speakerRole IN ('user', 'codex', 'nangong', 'hanli')),
  CONSTRAINT CK_AiDesktopTrainingCorpusMessage_Retention CHECK (contentRetention IN ('exact', 'preview-300')),
  CONSTRAINT CK_AiDesktopTrainingCorpusMessage_Evidence CHECK (evidenceTier IN ('primary', 'supporting', 'low')),
  CONSTRAINT CK_AiDesktopTrainingCorpusMessage_Sequence CHECK (sequenceNumber >= 0)
) STRICT;

CREATE INDEX IX_AiDesktopTrainingCorpusMessage_SourceTime
ON AiDesktopTrainingCorpusMessage (source, createdAt DESC);

CREATE INDEX IX_AiDesktopTrainingCorpusMessage_Conversation
ON AiDesktopTrainingCorpusMessage (source, sourceConversationId, sequenceNumber);

CREATE INDEX IX_AiDesktopTrainingCorpusMessage_Turn
ON AiDesktopTrainingCorpusMessage (sourceTurnId, createdAt);

CREATE INDEX IX_AiDesktopTrainingCorpusTopic_SourceTime
ON AiDesktopTrainingCorpusTopic (source, createdAt DESC);

CREATE TRIGGER AiDesktopTrainingCorpusTopic_AfterInsert
AFTER INSERT ON AiDesktopTrainingCorpusTopic BEGIN
  INSERT INTO AiDesktopTrainingCorpusTopicSearch (corpusTopicId, title, topicType, inferredIntent, tags)
  VALUES (new.corpusTopicId, new.title, new.topicType, COALESCE(new.inferredIntent, ''), new.tagsJson);
END;

CREATE TRIGGER AiDesktopTrainingCorpusTopic_AfterUpdate
AFTER UPDATE ON AiDesktopTrainingCorpusTopic BEGIN
  DELETE FROM AiDesktopTrainingCorpusTopicSearch WHERE corpusTopicId = old.corpusTopicId;
  INSERT INTO AiDesktopTrainingCorpusTopicSearch (corpusTopicId, title, topicType, inferredIntent, tags)
  VALUES (new.corpusTopicId, new.title, new.topicType, COALESCE(new.inferredIntent, ''), new.tagsJson);
END;

CREATE TRIGGER AiDesktopTrainingCorpusTopic_AfterDelete
AFTER DELETE ON AiDesktopTrainingCorpusTopic BEGIN
  DELETE FROM AiDesktopTrainingCorpusTopicSearch WHERE corpusTopicId = old.corpusTopicId;
END;
