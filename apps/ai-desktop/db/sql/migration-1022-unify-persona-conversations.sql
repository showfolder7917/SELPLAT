-- 人物会话头是所有人物共享的业务会话生命周期，不等同于 Codex 平台线程。
CREATE TABLE AiDesktopPersonaConversation (
  conversationId TEXT PRIMARY KEY,
  ownerPersonaId TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopPersonaConversation_Owner CHECK (length(trim(ownerPersonaId)) > 0),
  CONSTRAINT CK_AiDesktopPersonaConversation_Status CHECK (status IN ('active', 'archived')),
  CONSTRAINT UK_AiDesktopPersonaConversation_Owner UNIQUE (ownerPersonaId, conversationId)
) STRICT;

-- 同一人物只能有一个活动业务会话；新增人物不需要修改数据库 CHECK。
CREATE UNIQUE INDEX UX_AiDesktopPersonaConversation_ActiveOwner
ON AiDesktopPersonaConversation (ownerPersonaId) WHERE status = 'active';

CREATE INDEX IX_AiDesktopPersonaConversation_OwnerUpdated
ON AiDesktopPersonaConversation (ownerPersonaId, updatedAt DESC);

-- 临时表接收旧韩立表和旧南宫记忆表的数据，成功后再替换正式表。
CREATE TABLE AiDesktopPersonaConversationMessageUnified (
  messageId TEXT PRIMARY KEY,
  ownerPersonaId TEXT NOT NULL,
  conversationId TEXT NOT NULL,
  sequenceNumber INTEGER NOT NULL,
  speakerType TEXT NOT NULL,
  speakerPersonaId TEXT,
  content TEXT NOT NULL,
  inferredIntent TEXT,
  attachmentIdsJson TEXT NOT NULL,
  replyToMessageId TEXT,
  deliveryStatus TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  completedAt TEXT,
  recordedAt TEXT NOT NULL,
  CONSTRAINT UK_AiDesktopPersonaConversationMessage_Sequence UNIQUE (ownerPersonaId, conversationId, sequenceNumber),
  CONSTRAINT FK_AiDesktopPersonaConversationMessage_Conversation
    FOREIGN KEY (ownerPersonaId, conversationId) REFERENCES AiDesktopPersonaConversation (ownerPersonaId, conversationId),
  CONSTRAINT FK_AiDesktopPersonaConversationMessage_Reply
    FOREIGN KEY (replyToMessageId) REFERENCES AiDesktopPersonaConversationMessageUnified (messageId),
  CONSTRAINT CK_AiDesktopPersonaConversationMessage_Owner CHECK (length(trim(ownerPersonaId)) > 0),
  CONSTRAINT CK_AiDesktopPersonaConversationMessage_SpeakerType CHECK (speakerType IN ('user', 'persona', 'system')),
  CONSTRAINT CK_AiDesktopPersonaConversationMessage_Speaker
    CHECK ((speakerType = 'persona' AND length(trim(speakerPersonaId)) > 0) OR (speakerType <> 'persona' AND speakerPersonaId IS NULL)),
  CONSTRAINT CK_AiDesktopPersonaConversationMessage_Status CHECK (deliveryStatus IN ('sending', 'completed', 'failed')),
  CONSTRAINT CK_AiDesktopPersonaConversationMessage_Sequence CHECK (sequenceNumber >= 0),
  CONSTRAINT CK_AiDesktopPersonaConversationMessage_Attachments
    CHECK (json_valid(attachmentIdsJson) AND json_type(attachmentIdsJson) = 'array')
) STRICT;

-- 先登记所有已知业务会话，暂时全部归档，稍后再选出每个人物的当前会话。
INSERT OR IGNORE INTO AiDesktopPersonaConversation (conversationId, ownerPersonaId, status, createdAt, updatedAt)
SELECT conversationId, 'han-li', 'archived', MIN(createdAt), MAX(COALESCE(completedAt, createdAt))
FROM AiDesktopPersonaConversationMessage
GROUP BY conversationId;

INSERT OR IGNORE INTO AiDesktopPersonaConversation (conversationId, ownerPersonaId, status, createdAt, updatedAt)
SELECT conversationId, 'nangong-wan', 'archived', MIN(createdAt), MAX(recordedAt)
FROM AiDesktopConversationMemory
GROUP BY conversationId;

-- Evolution 当前 JSON 可能包含尚未来得及异步归档的南宫消息，必须补登记会话头。
INSERT OR IGNORE INTO AiDesktopPersonaConversation (conversationId, ownerPersonaId, status, createdAt, updatedAt)
SELECT
  json_extract(stateJson, '$.conversation.conversationId'),
  'nangong-wan',
  'archived',
  COALESCE(json_extract(stateJson, '$.conversation.messages[0].createdAt'), updatedAt),
  COALESCE(json_extract(stateJson, '$.conversation.updatedAt'), updatedAt)
FROM AiDesktopEvolutionState
WHERE singletonId = 1 AND json_type(stateJson, '$.conversation.conversationId') = 'text';

-- 韩立旧实现以 Codex threadId 兼作业务会话 ID；即使尚无消息，也保留当前会话头。
INSERT OR IGNORE INTO AiDesktopPersonaConversation (conversationId, ownerPersonaId, status, createdAt, updatedAt)
SELECT threadId, 'han-li', 'archived', updatedAt, updatedAt
FROM AiDesktopPersonaSession
WHERE sessionKey = 'han-li';

-- 当前 Evolution 会话和当前韩立线程优先成为活动会话。
UPDATE AiDesktopPersonaConversation
SET status = 'active'
WHERE ownerPersonaId = 'nangong-wan'
  AND conversationId = (SELECT json_extract(stateJson, '$.conversation.conversationId') FROM AiDesktopEvolutionState WHERE singletonId = 1);

UPDATE AiDesktopPersonaConversation
SET status = 'active'
WHERE ownerPersonaId = 'han-li'
  AND conversationId = (SELECT threadId FROM AiDesktopPersonaSession WHERE sessionKey = 'han-li');

-- 没有旧活动指针时，把每个人物最近更新的会话选为当前会话。
UPDATE AiDesktopPersonaConversation AS candidate
SET status = 'active'
WHERE candidate.conversationId IN (
  SELECT latest.conversationId
  FROM (
    SELECT conversationId, ownerPersonaId,
      ROW_NUMBER() OVER (PARTITION BY ownerPersonaId ORDER BY updatedAt DESC, conversationId DESC) AS ordinal
    FROM AiDesktopPersonaConversation
  ) AS latest
  WHERE latest.ordinal = 1
)
AND NOT EXISTS (
  SELECT 1 FROM AiDesktopPersonaConversation AS active
  WHERE active.ownerPersonaId = candidate.ownerPersonaId AND active.status = 'active'
);

-- 韩立完整消息原样迁移；内部南宫发言通过 speakerPersonaId 保留真实身份。
INSERT INTO AiDesktopPersonaConversationMessageUnified
  (messageId, ownerPersonaId, conversationId, sequenceNumber, speakerType, speakerPersonaId, content,
   inferredIntent, attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt, recordedAt)
SELECT messageId, 'han-li', conversationId, sequenceNumber,
  CASE WHEN role = 'user' THEN 'user' ELSE 'persona' END,
  CASE WHEN role = 'user' THEN NULL ELSE COALESCE(speakerPersonaId, 'han-li') END,
  content, inferredIntent, attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt,
  COALESCE(completedAt, createdAt)
FROM AiDesktopPersonaConversationMessage;

-- 优先从 Evolution 当前 JSON 补迁南宫消息，因为这里仍保留附件和投递状态。
INSERT OR IGNORE INTO AiDesktopPersonaConversationMessageUnified
  (messageId, ownerPersonaId, conversationId, sequenceNumber, speakerType, speakerPersonaId, content,
   inferredIntent, attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt, recordedAt)
SELECT
  json_extract(message.value, '$.messageId'),
  'nangong-wan',
  json_extract(state.stateJson, '$.conversation.conversationId'),
  CAST(COALESCE(json_extract(message.value, '$.sequenceNumber'), message.key) AS INTEGER),
  CASE WHEN json_extract(message.value, '$.role') = 'user' THEN 'user' ELSE 'persona' END,
  CASE WHEN json_extract(message.value, '$.role') = 'user' THEN NULL ELSE 'nangong-wan' END,
  json_extract(message.value, '$.content'),
  json_extract(message.value, '$.inferredIntent'),
  COALESCE(json_extract(message.value, '$.attachmentIds'), '[]'),
  json_extract(message.value, '$.replyToMessageId'),
  COALESCE(json_extract(message.value, '$.deliveryStatus'), 'completed'),
  json_extract(message.value, '$.createdAt'),
  json_extract(message.value, '$.completedAt'),
  COALESCE(json_extract(message.value, '$.completedAt'), json_extract(message.value, '$.createdAt'))
FROM AiDesktopEvolutionState AS state, json_each(state.stateJson, '$.conversation.messages') AS message
WHERE state.singletonId = 1;

-- 再补充南宫长期记忆中的其他会话；旧表没有附件和完成时间，只能使用已保存事实恢复。
INSERT OR IGNORE INTO AiDesktopPersonaConversationMessageUnified
  (messageId, ownerPersonaId, conversationId, sequenceNumber, speakerType, speakerPersonaId, content,
   inferredIntent, attachmentIdsJson, replyToMessageId, deliveryStatus, createdAt, completedAt, recordedAt)
SELECT memory.messageId, 'nangong-wan', memory.conversationId, memory.sequenceNumber,
  CASE WHEN memory.role = 'user' THEN 'user' ELSE 'persona' END,
  CASE WHEN memory.role = 'user' THEN NULL ELSE 'nangong-wan' END,
  memory.content, memory.inferredIntent, '[]',
  CASE WHEN memory.role = 'nangong' THEN (
    SELECT userMessage.messageId FROM AiDesktopConversationMemory AS userMessage
    WHERE userMessage.conversationId = memory.conversationId
      AND userMessage.role = 'user'
      AND userMessage.sequenceNumber < memory.sequenceNumber
    ORDER BY userMessage.sequenceNumber DESC LIMIT 1
  ) ELSE NULL END,
  'completed', memory.createdAt, memory.recordedAt, memory.recordedAt
FROM AiDesktopConversationMemory AS memory;

-- 先把引用旧消息表的两张子表迁走，再删除旧消息表；否则开启外键约束的真实数据库会拒绝升级。
CREATE TABLE AiDesktopConversationTopicUnified (
  conversationTopicId TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL,
  title TEXT NOT NULL,
  topicType TEXT NOT NULL,
  state TEXT NOT NULL,
  detectedFromMessageId TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  endedAt TEXT,
  updatedAt TEXT NOT NULL,
  CONSTRAINT FK_AiDesktopConversationTopic_DetectedMessage
    FOREIGN KEY (detectedFromMessageId) REFERENCES AiDesktopPersonaConversationMessageUnified (messageId),
  CONSTRAINT CK_AiDesktopConversationTopic_State CHECK (state IN ('active', 'closed'))
) STRICT;

INSERT INTO AiDesktopConversationTopicUnified
SELECT conversationTopicId, conversationId, title, topicType, state, detectedFromMessageId, startedAt, endedAt, updatedAt
FROM AiDesktopConversationTopic;
DROP TABLE AiDesktopConversationTopic;

CREATE TABLE AiDesktopConversationTopicLinkUnified (
  topicId TEXT NOT NULL,
  conversationId TEXT NOT NULL,
  messageId TEXT NOT NULL,
  linkedAt TEXT NOT NULL,
  PRIMARY KEY (topicId, messageId),
  CONSTRAINT FK_AiDesktopConversationTopicLink_Message
    FOREIGN KEY (messageId) REFERENCES AiDesktopPersonaConversationMessageUnified (messageId)
) STRICT;

INSERT INTO AiDesktopConversationTopicLinkUnified
SELECT topicId, conversationId, messageId, linkedAt FROM AiDesktopConversationTopicLink;
DROP TABLE AiDesktopConversationTopicLink;

DROP TABLE AiDesktopPersonaConversationMessage;
ALTER TABLE AiDesktopPersonaConversationMessageUnified RENAME TO AiDesktopPersonaConversationMessage;
ALTER TABLE AiDesktopConversationTopicUnified RENAME TO AiDesktopConversationTopic;
ALTER TABLE AiDesktopConversationTopicLinkUnified RENAME TO AiDesktopConversationTopicLink;

CREATE INDEX IX_AiDesktopPersonaConversationMessage_Conversation
ON AiDesktopPersonaConversationMessage (ownerPersonaId, conversationId, sequenceNumber);

CREATE INDEX IX_AiDesktopPersonaConversationMessage_UserHistory
ON AiDesktopPersonaConversationMessage (speakerType, createdAt DESC);

CREATE INDEX IX_AiDesktopConversationTopic_ConversationState
ON AiDesktopConversationTopic (conversationId, state, updatedAt DESC);

CREATE INDEX IX_AiDesktopConversationTopicLink_Conversation
ON AiDesktopConversationTopicLink (conversationId, linkedAt DESC);

DROP TABLE AiDesktopConversationMemory;

-- 平台线程键不再枚举固定人物；应用注册表负责拒绝未知人物。
CREATE TABLE AiDesktopPersonaSessionUnified (
  sessionKey TEXT PRIMARY KEY,
  threadId TEXT NOT NULL,
  workspaceSignature TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  CONSTRAINT CK_AiDesktopPersonaSession_Key CHECK (length(trim(sessionKey)) > 0)
) STRICT;
INSERT INTO AiDesktopPersonaSessionUnified SELECT sessionKey, threadId, workspaceSignature, updatedAt FROM AiDesktopPersonaSession;
DROP TABLE AiDesktopPersonaSession;
ALTER TABLE AiDesktopPersonaSessionUnified RENAME TO AiDesktopPersonaSession;

-- Evolution 以后只保存专题运行事实，会话正文启动时从统一人物表装配。
UPDATE AiDesktopEvolutionState
SET stateJson = json_remove(stateJson, '$.conversation');
