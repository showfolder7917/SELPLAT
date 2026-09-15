-- Evolution v9 新增提案验收计划；保留尚未由应用层迁移的 v8 快照，避免升级时丢失专题事实。
CREATE TABLE AiDesktopEvolutionStateUnified (
  singletonId INTEGER PRIMARY KEY,
  stateVersion INTEGER NOT NULL,
  stateJson TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopEvolutionState_Singleton CHECK (singletonId = 1),
  CONSTRAINT CK_AiDesktopEvolutionState_Version CHECK (stateVersion IN (8, 9)),
  CONSTRAINT CK_AiDesktopEvolutionState_Json CHECK (json_valid(stateJson))
) STRICT;

INSERT INTO AiDesktopEvolutionStateUnified (singletonId, stateVersion, stateJson, updatedAt)
SELECT singletonId, stateVersion, stateJson, updatedAt
FROM AiDesktopEvolutionState;

DROP TABLE AiDesktopEvolutionState;
ALTER TABLE AiDesktopEvolutionStateUnified RENAME TO AiDesktopEvolutionState;
