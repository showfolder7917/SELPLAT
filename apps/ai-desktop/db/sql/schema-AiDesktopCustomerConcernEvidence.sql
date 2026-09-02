CREATE TABLE AiDesktopCustomerConcernEvidence (
  evidenceId TEXT PRIMARY KEY,
  concernId TEXT NOT NULL,
  source TEXT NOT NULL,
  sourceConversationId TEXT NOT NULL,
  sourceTurnId TEXT NOT NULL,
  sourceMessageId TEXT NOT NULL,
  evidenceType TEXT NOT NULL,
  stance TEXT NOT NULL,
  evidenceExcerpt TEXT NOT NULL,
  occurredAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopCustomerConcernEvidence_Concern FOREIGN KEY (concernId) REFERENCES AiDesktopCustomerConcern (concernId),
  CONSTRAINT UK_AiDesktopCustomerConcernEvidence_Source UNIQUE (concernId, source, sourceMessageId, evidenceType, stance),
  CONSTRAINT CK_AiDesktopCustomerConcernEvidence_Source CHECK (source IN ('codex', 'nangong', 'hanli')),
  CONSTRAINT CK_AiDesktopCustomerConcernEvidence_Type CHECK (evidenceType IN ('explicit', 'correction', 'rejection', 'choice', 'acceptance', 'inference')),
  CONSTRAINT CK_AiDesktopCustomerConcernEvidence_Stance CHECK (stance IN ('supporting', 'counterexample', 'changed'))
) STRICT;

CREATE INDEX IX_AiDesktopCustomerConcernEvidence_Concern
ON AiDesktopCustomerConcernEvidence (concernId, occurredAt DESC);
