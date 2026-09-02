ALTER TABLE AiDesktopPersonaConversationMessage
ADD COLUMN speakerPersonaId TEXT
CONSTRAINT CK_AiDesktopPersonaConversationMessage_SpeakerPersona
CHECK (speakerPersonaId IS NULL OR speakerPersonaId IN ('han-li', 'nangong-wan'));
