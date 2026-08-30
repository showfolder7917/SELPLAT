CREATE TABLE IF NOT EXISTS AiDesktopTaskTimelineEvent (
  factId TEXT PRIMARY KEY,
  groupId TEXT NOT NULL REFERENCES AiDesktopTaskTimelineTopic(groupId) ON DELETE CASCADE,
  proposalId TEXT,
  taskId TEXT,
  nodeId TEXT NOT NULL,
  sourceFactKey TEXT NOT NULL UNIQUE,
  sequenceNumber INTEGER NOT NULL CHECK (sequenceNumber > 0),
  eventType TEXT NOT NULL,
  contentRole TEXT NOT NULL CHECK (contentRole IN ('status', 'approval-content', 'approval-reason', 'task-content', 'analysis-output', 'execution-output', 'verification-output', 'repair-output', 'result-output')),
  detailRole TEXT NOT NULL CHECK (detailRole IN ('none', 'application-evidence', 'approval-scope', 'task-breakdown', 'acceptance-criteria', 'changed-files', 'verification-evidence', 'recovery-conditions', 'result-evidence')),
  schemaVersion INTEGER NOT NULL CHECK (schemaVersion = 2),
  kind TEXT NOT NULL CHECK (kind IN ('approval-application', 'approval-decision', 'distribution', 'analysis', 'execution', 'verification', 'repair', 'result')),
  actorMemberId TEXT NOT NULL,
  actorDisplayName TEXT NOT NULL,
  recipientsJson TEXT NOT NULL CHECK (json_valid(recipientsJson)),
  status TEXT NOT NULL CHECK (status IN ('completed', 'current', 'waiting', 'failed')),
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  detail TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  completedAt TEXT,
  automaticOpen INTEGER NOT NULL CHECK (automaticOpen IN (0, 1)),
  manualApprovalProposalId TEXT,
  occurredAt TEXT NOT NULL,
  committedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_AiDesktopTaskTimelineEvent_group_order
  ON AiDesktopTaskTimelineEvent(groupId, sequenceNumber, occurredAt, factId);

CREATE INDEX IF NOT EXISTS idx_AiDesktopTaskTimelineEvent_node_latest
  ON AiDesktopTaskTimelineEvent(groupId, nodeId, sequenceNumber DESC);

CREATE INDEX IF NOT EXISTS idx_AiDesktopTaskTimelineEvent_task
  ON AiDesktopTaskTimelineEvent(taskId, sequenceNumber DESC);
