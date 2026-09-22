-- 人物业务会话与 Codex 平台线程分别保存；关联记录防止当前人物线程误用于另一段历史会话。
CREATE TABLE AiDesktopPersonaConversationCodexThread (
  ownerPersonaId TEXT NOT NULL,
  conversationId TEXT NOT NULL,
  threadId TEXT NOT NULL,
  workspaceSignature TEXT NOT NULL,
  linkedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (ownerPersonaId, conversationId),
  CONSTRAINT FK_AiDesktopPersonaConversationCodexThread_Conversation
    FOREIGN KEY (ownerPersonaId, conversationId) REFERENCES AiDesktopPersonaConversation (ownerPersonaId, conversationId)
) STRICT;

CREATE UNIQUE INDEX UX_AiDesktopPersonaConversationCodexThread_Thread
ON AiDesktopPersonaConversationCodexThread (ownerPersonaId, threadId);

-- 旧固定人物线程只能迁移到同名的旧业务会话，不能猜测性绑定到其他历史会话。
INSERT OR IGNORE INTO AiDesktopPersonaConversationCodexThread
  (ownerPersonaId, conversationId, threadId, workspaceSignature, linkedAt, updatedAt)
SELECT 'han-li', session.threadId, session.threadId, session.workspaceSignature, session.updatedAt, session.updatedAt
FROM AiDesktopPersonaSession AS session
JOIN AiDesktopPersonaConversation AS conversation
  ON conversation.ownerPersonaId='han-li' AND conversation.conversationId=session.threadId
WHERE session.sessionKey='han-li';
