-- 客户显示正文是原始人物消息的可审计派生，不覆盖审计原文、身份或顺序。
CREATE TABLE AiDesktopPersonaCustomerDisplayMessage (
  sourceMessageId TEXT PRIMARY KEY,
  ownerPersonaId TEXT NOT NULL,
  conversationId TEXT NOT NULL,
  displayState TEXT NOT NULL CHECK (displayState IN ('ready', 'excluded', 'missing', 'failed')),
  displayContent TEXT,
  failureReason TEXT,
  derivedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopPersonaCustomerDisplayMessage_Source
    FOREIGN KEY (sourceMessageId) REFERENCES AiDesktopPersonaConversationMessage (messageId),
  CONSTRAINT CK_AiDesktopPersonaCustomerDisplayMessage_Ready
    CHECK ((displayState = 'ready' AND length(trim(COALESCE(displayContent, ''))) > 0 AND failureReason IS NULL)
      OR (displayState <> 'ready' AND displayContent IS NULL))
) STRICT;

CREATE INDEX IX_AiDesktopPersonaCustomerDisplayMessage_Conversation
ON AiDesktopPersonaCustomerDisplayMessage (ownerPersonaId, conversationId, sourceMessageId);
