CREATE TABLE IF NOT EXISTS AiDesktopTaskCollaborationStream (
  chunkId TEXT PRIMARY KEY,
  groupId TEXT NOT NULL REFERENCES AiDesktopTaskCollaborationTopic(groupId) ON DELETE CASCADE,
  taskId TEXT NOT NULL,
  nodeId TEXT NOT NULL,
  memberId TEXT NOT NULL,
  turnId TEXT NOT NULL,
  segmentId TEXT,
  itemId TEXT,
  eventType TEXT NOT NULL,
  sequenceNumber INTEGER NOT NULL CHECK (sequenceNumber > 0),
  deltaText TEXT,
  snapshotText TEXT,
  occurredAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_AiDesktopTaskCollaborationStream_node_order
  ON AiDesktopTaskCollaborationStream(groupId, nodeId, sequenceNumber, occurredAt, chunkId);

CREATE INDEX IF NOT EXISTS idx_AiDesktopTaskCollaborationStream_task_turn
  ON AiDesktopTaskCollaborationStream(taskId, turnId, sequenceNumber);
