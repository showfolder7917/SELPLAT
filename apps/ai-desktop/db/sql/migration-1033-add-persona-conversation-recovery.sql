-- Codex 线程恢复事实独立保存，不能覆盖人物消息、客户显示派生或事件中心审计。
CREATE TABLE AiDesktopPersonaConversationRecovery (
  recoveryId TEXT PRIMARY KEY,
  ownerPersonaId TEXT NOT NULL,
  conversationId TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('verified', 'unknown-turn', 'thread-unavailable', 'retryable', 'verification-incomplete')),
  sourceThreadId TEXT,
  successorThreadId TEXT,
  affectedTurnId TEXT,
  affectedItemId TEXT,
  summary TEXT NOT NULL,
  retryable INTEGER NOT NULL CHECK (retryable IN (0, 1)),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopPersonaConversationRecovery_Conversation
    FOREIGN KEY (conversationId) REFERENCES AiDesktopPersonaConversation (conversationId)
) STRICT;

CREATE INDEX IX_AiDesktopPersonaConversationRecovery_Latest
ON AiDesktopPersonaConversationRecovery (ownerPersonaId, conversationId, updatedAt DESC);
