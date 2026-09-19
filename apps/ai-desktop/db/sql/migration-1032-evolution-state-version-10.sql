-- Evolution v10 新增当前专题的 Host 启动验收事实；保留 v8/v9 快照，应用层会在首次读取后统一写回 v10。
CREATE TABLE AiDesktopEvolutionStateUnified (
  singletonId INTEGER PRIMARY KEY,
  stateVersion INTEGER NOT NULL,
  stateJson TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopEvolutionState_Singleton CHECK (singletonId = 1),
  CONSTRAINT CK_AiDesktopEvolutionState_Version CHECK (stateVersion IN (8, 9, 10)),
  CONSTRAINT CK_AiDesktopEvolutionState_Json CHECK (json_valid(stateJson))
) STRICT;

INSERT INTO AiDesktopEvolutionStateUnified (singletonId, stateVersion, stateJson, updatedAt)
SELECT singletonId, stateVersion, stateJson, updatedAt
FROM AiDesktopEvolutionState;

DROP TABLE AiDesktopEvolutionState;
ALTER TABLE AiDesktopEvolutionStateUnified RENAME TO AiDesktopEvolutionState;
