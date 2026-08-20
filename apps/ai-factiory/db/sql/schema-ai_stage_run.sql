-- ai_stage_run 保存本地 Python 领取阶段后形成的租约与执行事实。
CREATE TABLE IF NOT EXISTS ai_stage_run (
  -- id 是阶段运行租约记录主键。
  id BIGINT PRIMARY KEY, stage_id BIGINT NOT NULL,
  run_code VARCHAR(100) NOT NULL, stage_thread_id VARCHAR(100) NOT NULL, agent_id VARCHAR(100),
  client_id VARCHAR(100) NOT NULL, attempt INT NOT NULL, status VARCHAR(40) NOT NULL,
  lease_token_digest VARCHAR(128) NOT NULL, lease_expires_at TIMESTAMP NOT NULL,
  last_sequence BIGINT NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL,
  CONSTRAINT uk_ai_run_code UNIQUE(run_code), CONSTRAINT uk_ai_stage_thread UNIQUE(stage_thread_id),
  CONSTRAINT fk_ai_run_stage FOREIGN KEY(stage_id) REFERENCES ai_task_stage(id)
);

COMMENT ON TABLE ai_stage_run IS '本地Python领取任务阶段后的租约与运行事实表';
COMMENT ON COLUMN ai_stage_run.id IS '阶段运行记录主键';
COMMENT ON COLUMN ai_stage_run.stage_id IS '本次运行所属任务阶段主键';
COMMENT ON COLUMN ai_stage_run.run_code IS '阶段运行唯一编码';
COMMENT ON COLUMN ai_stage_run.stage_thread_id IS '阶段对应的Codex会话标识';
COMMENT ON COLUMN ai_stage_run.agent_id IS '本次运行实际启动的Agent标识';
COMMENT ON COLUMN ai_stage_run.client_id IS '领取阶段的本地Python客户端标识';
COMMENT ON COLUMN ai_stage_run.attempt IS '当前阶段运行尝试次数';
COMMENT ON COLUMN ai_stage_run.status IS '阶段运行状态';
COMMENT ON COLUMN ai_stage_run.lease_token_digest IS '阶段租约令牌摘要';
COMMENT ON COLUMN ai_stage_run.lease_expires_at IS '阶段租约失效时间';
COMMENT ON COLUMN ai_stage_run.last_sequence IS '本次运行最后确认的进度事件序号';
COMMENT ON COLUMN ai_stage_run.created_at IS '阶段运行创建时间';
COMMENT ON COLUMN ai_stage_run.updated_at IS '阶段运行最后更新时间';
