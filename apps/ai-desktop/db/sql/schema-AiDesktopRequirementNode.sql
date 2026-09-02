CREATE TABLE AiDesktopRequirementNode (
  requirementNodeId TEXT PRIMARY KEY,
  trajectoryId TEXT NOT NULL,
  nodeKey TEXT NOT NULL,
  parentNodeKey TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  statement TEXT NOT NULL,
  critical INTEGER NOT NULL,
  evidenceMessageIdsJson TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopRequirementNode_Trajectory FOREIGN KEY (trajectoryId) REFERENCES AiDesktopRequirementTrajectory (trajectoryId),
  CONSTRAINT UK_AiDesktopRequirementNode_Key UNIQUE (trajectoryId, nodeKey),
  CONSTRAINT CK_AiDesktopRequirementNode_Status CHECK (status IN ('confirmed', 'investigate', 'inferred', 'conflicted', 'waiting-customer', 'implemented-pending-acceptance', 'accepted')),
  CONSTRAINT CK_AiDesktopRequirementNode_Critical CHECK (critical IN (0, 1)),
  CONSTRAINT CK_AiDesktopRequirementNode_Evidence CHECK (json_valid(evidenceMessageIdsJson) AND json_type(evidenceMessageIdsJson) = 'array')
) STRICT;

CREATE INDEX IX_AiDesktopRequirementNode_Open
ON AiDesktopRequirementNode (trajectoryId, critical, status, updatedAt DESC);
