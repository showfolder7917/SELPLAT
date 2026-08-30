CREATE TABLE IF NOT EXISTS AiDesktopTaskTimelineStream (
  chunkId TEXT PRIMARY KEY,
  groupId TEXT NOT NULL REFERENCES AiDesktopTaskTimelineTopic(groupId) ON DELETE CASCADE,
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
  occurredAt TEXT NOT NULL,
  committedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_AiDesktopTaskTimelineStream_node_order
  ON AiDesktopTaskTimelineStream(groupId, nodeId, sequenceNumber, occurredAt, chunkId);

CREATE INDEX IF NOT EXISTS idx_AiDesktopTaskTimelineStream_task_turn
  ON AiDesktopTaskTimelineStream(taskId, turnId, sequenceNumber);
