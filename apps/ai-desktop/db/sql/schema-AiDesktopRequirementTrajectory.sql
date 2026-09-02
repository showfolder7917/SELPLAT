CREATE TABLE AiDesktopRequirementTrajectory (
  trajectoryId TEXT PRIMARY KEY,
  stableUserId TEXT NOT NULL,
  sourceCorpusTopicId TEXT NOT NULL,
  projectScope TEXT NOT NULL,
  customerGoal TEXT NOT NULL,
  confirmedFactsJson TEXT NOT NULL,
  assumptionsJson TEXT NOT NULL,
  conflictsJson TEXT NOT NULL,
  informationGapsJson TEXT NOT NULL,
  implicitRequirementsJson TEXT NOT NULL,
  selectedAction TEXT NOT NULL,
  questionAsked TEXT,
  questionReason TEXT,
  customerAnswer TEXT,
  resultSummary TEXT,
  evolutionDirection TEXT,
  acceptanceEvidenceJson TEXT NOT NULL,
  maturityScore REAL NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopRequirementTrajectory_Topic FOREIGN KEY (sourceCorpusTopicId) REFERENCES AiDesktopTrainingCorpusTopic (corpusTopicId),
  CONSTRAINT UK_AiDesktopRequirementTrajectory_Source UNIQUE (stableUserId, sourceCorpusTopicId),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Maturity CHECK (maturityScore >= 0 AND maturityScore <= 1),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Confirmed CHECK (json_valid(confirmedFactsJson) AND json_type(confirmedFactsJson) = 'array'),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Assumptions CHECK (json_valid(assumptionsJson) AND json_type(assumptionsJson) = 'array'),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Conflicts CHECK (json_valid(conflictsJson) AND json_type(conflictsJson) = 'array'),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Gaps CHECK (json_valid(informationGapsJson) AND json_type(informationGapsJson) = 'array'),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Implicit CHECK (json_valid(implicitRequirementsJson) AND json_type(implicitRequirementsJson) = 'array'),
  CONSTRAINT CK_AiDesktopRequirementTrajectory_Acceptance CHECK (json_valid(acceptanceEvidenceJson) AND json_type(acceptanceEvidenceJson) = 'array')
) STRICT;

CREATE INDEX IX_AiDesktopRequirementTrajectory_Retrieval
ON AiDesktopRequirementTrajectory (stableUserId, projectScope, maturityScore DESC, updatedAt DESC);
