CREATE TABLE AiDesktopInspectionExperience (
  inspectionExperienceId TEXT PRIMARY KEY,
  stableUserId TEXT NOT NULL,
  projectScope TEXT NOT NULL,
  title TEXT NOT NULL,
  scopeLevel TEXT NOT NULL,
  applicableObjectTypesJson TEXT NOT NULL,
  applicabilityConditionsJson TEXT NOT NULL,
  sourceFindingIdsJson TEXT NOT NULL,
  failedProposalId TEXT NOT NULL,
  correctionProposalId TEXT NOT NULL,
  failedRunId TEXT NOT NULL,
  passedRetestRunId TEXT NOT NULL,
  counterexamplesJson TEXT NOT NULL,
  confidenceStatus TEXT NOT NULL,
  supersededByExperienceId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT UK_AiDesktopInspectionExperience_Retest UNIQUE (stableUserId, passedRetestRunId),
  CONSTRAINT FK_AiDesktopInspectionExperience_Superseded FOREIGN KEY (supersededByExperienceId) REFERENCES AiDesktopInspectionExperience (inspectionExperienceId),
  CONSTRAINT CK_AiDesktopInspectionExperience_Scope CHECK (scopeLevel IN ('finding', 'project', 'stable-rule-candidate')),
  CONSTRAINT CK_AiDesktopInspectionExperience_Confidence CHECK (confidenceStatus IN ('candidate', 'verified-project', 'conflicted', 'limited', 'superseded', 'retired')),
  CONSTRAINT CK_AiDesktopInspectionExperience_ObjectTypes CHECK (json_valid(applicableObjectTypesJson) AND json_type(applicableObjectTypesJson) = 'array'),
  CONSTRAINT CK_AiDesktopInspectionExperience_Conditions CHECK (json_valid(applicabilityConditionsJson) AND json_type(applicabilityConditionsJson) = 'array'),
  CONSTRAINT CK_AiDesktopInspectionExperience_Findings CHECK (json_valid(sourceFindingIdsJson) AND json_type(sourceFindingIdsJson) = 'array'),
  CONSTRAINT CK_AiDesktopInspectionExperience_Counterexamples CHECK (json_valid(counterexamplesJson) AND json_type(counterexamplesJson) = 'array')
) STRICT;

CREATE INDEX IX_AiDesktopInspectionExperience_Retrieval
ON AiDesktopInspectionExperience (stableUserId, projectScope, confidenceStatus, updatedAt DESC);
