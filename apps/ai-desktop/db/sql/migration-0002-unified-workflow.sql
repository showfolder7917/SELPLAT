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
