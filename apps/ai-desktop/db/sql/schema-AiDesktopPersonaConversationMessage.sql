CREATE TABLE AiDesktopPersonaConversationMessage (
  messageId TEXT PRIMARY KEY,
  personaId TEXT NOT NULL,
  conversationId TEXT NOT NULL,
  sequenceNumber INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  inferredIntent TEXT,
  attachmentIdsJson TEXT NOT NULL,
  replyToMessageId TEXT,
  deliveryStatus TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  completedAt TEXT,
  CONSTRAINT UK_AiDesktopPersonaConversationMessage_Sequence UNIQUE (personaId, conversationId, sequenceNumber),
  CONSTRAINT FK_AiDesktopPersonaConversationMessage_Reply FOREIGN KEY (replyToMessageId) REFERENCES AiDesktopPersonaConversationMessage (messageId),
  CONSTRAINT CK_AiDesktopPersonaConversationMessage_Persona CHECK (personaId IN ('han-li')),
  CONSTRAINT CK_AiDesktopPersonaConversationMessage_Role CHECK (role IN ('user', 'hanli')),
  CONSTRAINT CK_AiDesktopPersonaConversationMessage_Status CHECK (deliveryStatus IN ('sending', 'completed', 'failed')),
  CONSTRAINT CK_AiDesktopPersonaConversationMessage_Sequence CHECK (sequenceNumber >= 0),
  CONSTRAINT CK_AiDesktopPersonaConversationMessage_Attachments CHECK (json_valid(attachmentIdsJson) AND json_type(attachmentIdsJson) = 'array')
) STRICT;

CREATE INDEX IX_AiDesktopPersonaConversationMessage_Conversation
ON AiDesktopPersonaConversationMessage (personaId, conversationId, sequenceNumber);
