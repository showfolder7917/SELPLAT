CREATE TABLE IF NOT EXISTS AiDesktopCollaborationStreamChunk (
  chunkId TEXT PRIMARY KEY,
  groupId TEXT NOT NULL REFERENCES AiDesktopCollaborationTopic(groupId) ON DELETE CASCADE,
  taskId TEXT NOT NULL,
  nodeId TEXT,
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

CREATE INDEX IF NOT EXISTS idx_AiDesktopCollaborationStreamChunk_node_order
  ON AiDesktopCollaborationStreamChunk(groupId, nodeId, sequenceNumber, occurredAt, chunkId);

CREATE INDEX IF NOT EXISTS idx_AiDesktopCollaborationStreamChunk_task_order
  ON AiDesktopCollaborationStreamChunk(taskId, sequenceNumber, occurredAt, chunkId);
