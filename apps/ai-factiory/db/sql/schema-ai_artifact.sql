-- ai_artifact 只登记本地产物的任务坐标、相对路径、版本与摘要。
CREATE TABLE IF NOT EXISTS ai_artifact (
  -- id 是任务产物登记记录主键。
  id BIGINT PRIMARY KEY, task_id BIGINT NOT NULL, run_id BIGINT,
  artifact_code VARCHAR(100) NOT NULL, type VARCHAR(50) NOT NULL, standard_name VARCHAR(300) NOT NULL,
  logical_path VARCHAR(1000) NOT NULL, version INT NOT NULL, digest VARCHAR(128) NOT NULL,
  size_bytes BIGINT NOT NULL, gate_status VARCHAR(30) NOT NULL, created_at TIMESTAMP NOT NULL,
  CONSTRAINT uk_ai_artifact_code UNIQUE(artifact_code),
  CONSTRAINT uk_ai_artifact_version UNIQUE(task_id,standard_name,version),
  CONSTRAINT fk_ai_artifact_task FOREIGN KEY(task_id) REFERENCES ai_task(id),
  CONSTRAINT fk_ai_artifact_run FOREIGN KEY(run_id) REFERENCES ai_stage_run(id)
);

COMMENT ON TABLE ai_artifact IS '本地任务产物坐标、版本和摘要登记表';
COMMENT ON COLUMN ai_artifact.id IS '任务产物登记记录主键';
COMMENT ON COLUMN ai_artifact.task_id IS '产物所属任务主键';
COMMENT ON COLUMN ai_artifact.run_id IS '生成产物的阶段运行主键';
COMMENT ON COLUMN ai_artifact.artifact_code IS '产物唯一业务编码';
COMMENT ON COLUMN ai_artifact.type IS '产物类型';
COMMENT ON COLUMN ai_artifact.standard_name IS '产物标准文件名称';
COMMENT ON COLUMN ai_artifact.logical_path IS 'OPTION临时目录中的产物逻辑相对路径';
COMMENT ON COLUMN ai_artifact.version IS '同一任务产物版本号';
COMMENT ON COLUMN ai_artifact.digest IS '产物内容摘要';
COMMENT ON COLUMN ai_artifact.size_bytes IS '产物文件字节数';
COMMENT ON COLUMN ai_artifact.gate_status IS '产物门禁检查状态';
COMMENT ON COLUMN ai_artifact.created_at IS '产物登记时间';
