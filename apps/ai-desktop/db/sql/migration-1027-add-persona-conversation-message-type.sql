-- 消息类别是持久化事实；运行期投影不得再从 messageId 前后缀推断可见性。
ALTER TABLE AiDesktopPersonaConversationMessage
ADD COLUMN messageType TEXT NOT NULL DEFAULT 'customer-visible'
CHECK (messageType IN ('customer-visible', 'internal-recovery', 'internal-deliberation'));

-- 已有恢复快照保留原始身份、序号和正文，只修正为不可投影的恢复类别。
UPDATE AiDesktopPersonaConversationMessage
SET messageType = 'internal-recovery'
WHERE messageId LIKE 'internal:inquiry-checkpoint:%';

-- 旧内部研讨与交接使用稳定内部类别；assessment 后缀不再参与任何运行期判断。
UPDATE AiDesktopPersonaConversationMessage
SET messageType = 'internal-deliberation'
WHERE messageId LIKE 'internal:%'
  AND messageType <> 'internal-recovery';
