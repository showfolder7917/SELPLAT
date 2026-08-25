CREATE TABLE AiDesktopSchemaVersion (
  id INTEGER PRIMARY KEY,
  versionCode TEXT NOT NULL,
  description TEXT NOT NULL,
  checksum TEXT NOT NULL,
  appliedAt TEXT NOT NULL,
  durationMs INTEGER NOT NULL,
  successFlag INTEGER NOT NULL,
  CONSTRAINT UK_AiDesktopSchemaVersion_VersionCode UNIQUE (versionCode),
  CONSTRAINT CK_AiDesktopSchemaVersion_VersionCode CHECK (versionCode GLOB '[0-9][0-9][0-9][0-9]'),
  CONSTRAINT CK_AiDesktopSchemaVersion_Checksum CHECK (length(checksum) = 64 AND checksum NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT CK_AiDesktopSchemaVersion_DurationMs CHECK (durationMs >= 0),
  CONSTRAINT CK_AiDesktopSchemaVersion_SuccessFlag CHECK (successFlag IN (0, 1))
) STRICT;
