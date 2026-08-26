ALTER TABLE AiDesktopApprovalRecord ADD COLUMN approvalStage TEXT NOT NULL DEFAULT 'direction'
  CONSTRAINT CK_AiDesktopApprovalRecord_Stage CHECK (approvalStage IN ('direction', 'result'));

CREATE TABLE AiDesktopApprovalGovernance (
  governanceId TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  subjectId TEXT NOT NULL,
  correlationId TEXT,
  title TEXT NOT NULL,
  requestKind TEXT NOT NULL,
  decision TEXT NOT NULL,
  initiatorId TEXT,
  initiatorDisplayName TEXT,
  approverId TEXT NOT NULL,
  approverDisplayName TEXT NOT NULL,
  source TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidenceJson TEXT NOT NULL,
  decidedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopApprovalGovernance_Domain CHECK (domain IN ('evolution', 'collaboration-review', 'codex-command')),
  CONSTRAINT CK_AiDesktopApprovalGovernance_EvidenceJson CHECK (json_valid(evidenceJson))
) STRICT;

CREATE INDEX IX_AiDesktopApprovalGovernance_DomainDecidedAt ON AiDesktopApprovalGovernance (domain, decidedAt DESC);
CREATE INDEX IX_AiDesktopApprovalGovernance_CorrelationDecidedAt ON AiDesktopApprovalGovernance (correlationId, decidedAt DESC);
