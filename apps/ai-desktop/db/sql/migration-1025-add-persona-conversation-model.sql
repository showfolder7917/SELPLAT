-- 人物对话模型仅归属统一会话头；null 表示继续使用设置页全局默认模型。
ALTER TABLE AiDesktopPersonaConversation ADD COLUMN selectedModel TEXT;
