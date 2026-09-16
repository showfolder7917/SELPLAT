-- 技术证据与可读研讨共用稳定消息身份和顺序，但页面只能把证据作为关联折叠内容展示。
ALTER TABLE AiDesktopPersonaConversationMessage
ADD COLUMN contentRole TEXT NOT NULL DEFAULT 'conversation'
CHECK (contentRole IN ('conversation', 'technical-evidence'));

-- 已有正文、历史客户消息和内部交接保留原始内容与身份；不回写或重排历史记录。
