CREATE TABLE AiDesktopEvolutionState (
  singletonId INTEGER PRIMARY KEY,
  stateVersion INTEGER NOT NULL,
  stateJson TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopEvolutionState_Singleton CHECK (singletonId = 1),
  CONSTRAINT CK_AiDesktopEvolutionState_Version CHECK (stateVersion = 8),
  CONSTRAINT CK_AiDesktopEvolutionState_Json CHECK (json_valid(stateJson))
) STRICT;
