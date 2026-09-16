-- 历史客户显示投影必须可按净化规则升级，原始会话消息继续只作审计事实。
ALTER TABLE AiDesktopPersonaCustomerDisplayMessage
ADD COLUMN derivationVersion INTEGER NOT NULL DEFAULT 1 CHECK (derivationVersion > 0);
