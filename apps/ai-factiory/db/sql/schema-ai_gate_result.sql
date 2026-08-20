-- ai_gate_result 登记本地门禁程序提交的版本化证据与结论。
CREATE TABLE IF NOT EXISTS ai_gate_result (
  -- id 是门禁执行结果记录主键。
  id BIGINT PRIMARY KEY, result_code VARCHAR(100) NOT NULL,
  task_id BIGINT NOT NULL, stage_id BIGINT, artifact_id BIGINT, artifact_version INT,
  gate_definition_id BIGINT, gate_id VARCHAR(100) NOT NULL, definition_version VARCHAR(30) NOT NULL,
  runner_digest VARCHAR(128) NOT NULL, artifact_digest VARCHAR(128) NOT NULL, result VARCHAR(20) NOT NULL,
  violations_json CLOB, evidence_digest VARCHAR(128) NOT NULL, status VARCHAR(30) NOT NULL,
  created_at TIMESTAMP NOT NULL, CONSTRAINT uk_ai_gate_result_code UNIQUE(result_code),
  CONSTRAINT fk_ai_gate_task FOREIGN KEY(task_id) REFERENCES ai_task(id)
);

COMMENT ON TABLE ai_gate_result IS '本地门禁程序提交的版本化证据与结论表';
COMMENT ON COLUMN ai_gate_result.id IS '门禁执行结果记录主键';
COMMENT ON COLUMN ai_gate_result.result_code IS '门禁结果唯一业务编码';
COMMENT ON COLUMN ai_gate_result.task_id IS '门禁结果所属任务主键';
COMMENT ON COLUMN ai_gate_result.stage_id IS '门禁结果所属任务阶段主键';
COMMENT ON COLUMN ai_gate_result.artifact_id IS '被检查产物主键';
COMMENT ON COLUMN ai_gate_result.artifact_version IS '被检查产物版本';
COMMENT ON COLUMN ai_gate_result.gate_definition_id IS '采用的门禁定义版本主键';
COMMENT ON COLUMN ai_gate_result.gate_id IS '门禁稳定标识';
COMMENT ON COLUMN ai_gate_result.definition_version IS '门禁定义版本';
COMMENT ON COLUMN ai_gate_result.runner_digest IS '本地门禁执行程序摘要';
COMMENT ON COLUMN ai_gate_result.artifact_digest IS '被检查产物内容摘要';
COMMENT ON COLUMN ai_gate_result.result IS '门禁执行结论';
COMMENT ON COLUMN ai_gate_result.violations_json IS '门禁违规明细JSON';
COMMENT ON COLUMN ai_gate_result.evidence_digest IS '门禁证据包摘要';
COMMENT ON COLUMN ai_gate_result.status IS '门禁结果处理状态';
COMMENT ON COLUMN ai_gate_result.created_at IS '门禁结果提交时间';
