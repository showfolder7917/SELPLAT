CREATE TABLE AiDesktopCustomerConcern (
  concernId TEXT PRIMARY KEY,
  stableUserId TEXT NOT NULL,
  semanticKey TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  scopeType TEXT NOT NULL,
  scopeId TEXT,
  status TEXT NOT NULL,
  confidence REAL NOT NULL,
  weight REAL NOT NULL,
  firstObservedAt TEXT NOT NULL,
  lastObservedAt TEXT NOT NULL,
  confirmedAt TEXT,
  supersededByConcernId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT UK_AiDesktopCustomerConcern_Semantic UNIQUE (stableUserId, semanticKey),
  CONSTRAINT FK_AiDesktopCustomerConcern_Superseded FOREIGN KEY (supersededByConcernId) REFERENCES AiDesktopCustomerConcern (concernId),
  CONSTRAINT CK_AiDesktopCustomerConcern_Status CHECK (status IN ('candidate', 'confirmed', 'conflicted', 'changed', 'invalid')),
  CONSTRAINT CK_AiDesktopCustomerConcern_Scope CHECK (scopeType IN ('global', 'system-type', 'project', 'module', 'page')),
  CONSTRAINT CK_AiDesktopCustomerConcern_Confidence CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT CK_AiDesktopCustomerConcern_Weight CHECK (weight >= 0 AND weight <= 1)
) STRICT;

CREATE INDEX IX_AiDesktopCustomerConcern_Retrieval
ON AiDesktopCustomerConcern (stableUserId, status, scopeType, scopeId, weight DESC, lastObservedAt DESC);
