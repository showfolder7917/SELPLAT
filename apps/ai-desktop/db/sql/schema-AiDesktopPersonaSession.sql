CREATE TABLE AiDesktopPersonaSession (
  sessionKey TEXT PRIMARY KEY,
  threadId TEXT NOT NULL,
  workspaceSignature TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopPersonaSession_Key CHECK (sessionKey IN ('nangong', 'han-li', 'linghu'))
) STRICT;
