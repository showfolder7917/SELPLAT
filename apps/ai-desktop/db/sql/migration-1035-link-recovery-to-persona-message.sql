-- 恢复事实保留 Codex 回合定位，同时可关联到客户时间线中的安全消息位置。
ALTER TABLE AiDesktopPersonaConversationRecovery ADD COLUMN affectedMessageId TEXT;

CREATE INDEX IX_AiDesktopPersonaConversationRecovery_AffectedMessage
ON AiDesktopPersonaConversationRecovery (ownerPersonaId, conversationId, affectedMessageId);
