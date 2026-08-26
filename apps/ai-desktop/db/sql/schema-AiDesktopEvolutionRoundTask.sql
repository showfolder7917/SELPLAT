CREATE TABLE AiDesktopEvolutionRoundTask (
  roundId TEXT NOT NULL,
  taskId TEXT NOT NULL,
  executorMemberId TEXT,
  collectionState TEXT NOT NULL,
  resultSha TEXT,
  returnedAt TEXT,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (roundId, taskId),
  CONSTRAINT FK_AiDesktopEvolutionRoundTask_Round FOREIGN KEY (roundId) REFERENCES AiDesktopEvolutionRound (roundId),
  CONSTRAINT FK_AiDesktopEvolutionRoundTask_Task FOREIGN KEY (taskId) REFERENCES AiDesktopTaskExecution (taskId),
  CONSTRAINT CK_AiDesktopEvolutionRoundTask_State CHECK (collectionState IN ('executing', 'returned', 'sealed', 'integrating', 'blocked', 'completed'))
) STRICT;

CREATE INDEX IX_AiDesktopEvolutionRoundTask_RoundState
ON AiDesktopEvolutionRoundTask (roundId, collectionState, updatedAt DESC);
