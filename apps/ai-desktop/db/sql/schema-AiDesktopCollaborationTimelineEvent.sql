CREATE TABLE IF NOT EXISTS AiDesktopCollaborationTimelineEvent (
  factId TEXT PRIMARY KEY,
  groupId TEXT NOT NULL REFERENCES AiDesktopCollaborationTopic(groupId) ON DELETE CASCADE,
  proposalId TEXT,
  taskId TEXT,
  nodeId TEXT NOT NULL,
  sourceFactKey TEXT NOT NULL UNIQUE,
  sequenceNumber INTEGER NOT NULL CHECK (sequenceNumber > 0),
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
  recordedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_AiDesktopCollaborationTimelineEvent_group_order
  ON AiDesktopCollaborationTimelineEvent(groupId, sequenceNumber, occurredAt, factId);

CREATE INDEX IF NOT EXISTS idx_AiDesktopCollaborationTimelineEvent_node_latest
  ON AiDesktopCollaborationTimelineEvent(groupId, nodeId, sequenceNumber DESC);

CREATE INDEX IF NOT EXISTS idx_AiDesktopCollaborationTimelineEvent_task
  ON AiDesktopCollaborationTimelineEvent(taskId, sequenceNumber DESC);
