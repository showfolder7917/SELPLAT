CREATE TABLE IF NOT EXISTS AiDesktopCollaborationTopic (
  groupId TEXT PRIMARY KEY,
  topicId TEXT UNIQUE,
  proposalId TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('waiting-approval', 'running', 'verifying', 'blocked', 'completed', 'cancelled')),
  summary TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_AiDesktopCollaborationTopic_updated
  ON AiDesktopCollaborationTopic(updatedAt DESC, groupId);
