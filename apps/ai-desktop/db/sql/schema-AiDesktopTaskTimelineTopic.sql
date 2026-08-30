CREATE TABLE IF NOT EXISTS AiDesktopTaskTimelineTopic (
  groupId TEXT PRIMARY KEY,
  topicId TEXT,
  proposalId TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('waiting-approval', 'running', 'verifying', 'blocked', 'completed', 'cancelled')),
  summary TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  startedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_AiDesktopTaskTimelineTopic_updated
  ON AiDesktopTaskTimelineTopic(updatedAt DESC, groupId);
