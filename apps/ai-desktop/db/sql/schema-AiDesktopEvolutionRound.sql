CREATE TABLE AiDesktopEvolutionRound (
  roundId TEXT PRIMARY KEY,
  proposalId TEXT NOT NULL,
  state TEXT NOT NULL,
  expectedTaskCount INTEGER NOT NULL,
  returnedTaskCount INTEGER NOT NULL,
  sealedAt TEXT,
  submittedToLinghuAt TEXT,
  completedAt TEXT,
  updatedAt TEXT NOT NULL,
  CONSTRAINT UK_AiDesktopEvolutionRound_Proposal UNIQUE (proposalId),
  CONSTRAINT CK_AiDesktopEvolutionRound_State CHECK (state IN ('collecting', 'sealed', 'integrating', 'blocked', 'completed')),
  CONSTRAINT CK_AiDesktopEvolutionRound_Count CHECK (expectedTaskCount > 0 AND returnedTaskCount >= 0 AND returnedTaskCount <= expectedTaskCount)
) STRICT;

CREATE INDEX IX_AiDesktopEvolutionRound_StateUpdatedAt
ON AiDesktopEvolutionRound (state, updatedAt DESC);
