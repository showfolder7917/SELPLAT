package com.sp.selplat.aifactory.aitask.dao;

import com.sp.selplat.aifactory.common.persistence.AiFactoryBaseDao;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** 使用 AI 工厂私有数据库实现跨表控制面事务。 */
@Repository
public class AiTaskDaoImpl extends AiFactoryBaseDao implements AiTaskDao {

    private final JdbcTemplate jdbc;

    /**
     * 绑定私有数据源。
     * 真实传参示例：Spring 注入 {@code aiFactoryDataSource}。
     * 真实返回示例：构造完成后 DAO 可访问 ai_task 等控制表。
     * 异常或副作用示例：数据源缺失时应用启动失败；构造过程不执行 SQL。
     *
     * @param dataSource AI 工厂私有数据源
     */
    public AiTaskDaoImpl(@Qualifier("aiFactoryDataSource") DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(transactionManager = "aiFactoryTransactionManager")
    public Map<String, Object> createTask(CommonParam command) {
        String taskCode = "TASK-" + compactId();
        String rootThreadId = compactId();
        String stageCode = "STAGE-" + taskCode + "-1";
        String title = required(command, "title");
        String project = required(command, "project");
        String owner = value(command, "owner", "XUNAN");
        jdbc.update("INSERT INTO ai_task(task_code,root_thread_id,title,project,status,workflow_version,state_version,owner,created_at,updated_at) VALUES(?,?,?,?, 'READY','1.0.0',1,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
                taskCode, rootThreadId, title, project, owner);
        Long taskId = jdbc.queryForObject("SELECT id FROM ai_task WHERE task_code=?", Long.class, taskCode);
        Long roleVersionId = jdbc.queryForObject(
                "SELECT id FROM ai_role_version WHERE role_id='IMPLEMENTATION_ROLE' AND status='APPROVED' ORDER BY id DESC LIMIT 1",
                Long.class);
        jdbc.update("INSERT INTO ai_task_stage(task_id,stage_code,stage_type,status,role_version_id,sequence_no,state_version) VALUES(?,?, 'IMPLEMENTATION','READY',?,1,1)",
                taskId, stageCode, roleVersionId);
        appendProgress(taskId, null, "stage.ready", 0, "实现阶段等待本地 Python 领取",
                Map.of("taskId", taskCode, "stageId", stageCode, "instruction", title));
        return map("taskId", taskCode, "rootThreadId", rootThreadId, "stateVersion", 1,
                "stageId", stageCode);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> findTaskSnapshot(String taskCode) {
        List<Map<String, Object>> tasks = jdbc.queryForList("SELECT * FROM ai_task WHERE task_code=?", taskCode);
        if (tasks.isEmpty()) {
            return Map.of();
        }
        Map<String, Object> task = new LinkedHashMap<>(tasks.get(0));
        long taskId = number(task.get("id"));
        return map("task", task,
                "stages", jdbc.queryForList("SELECT * FROM ai_task_stage WHERE task_id=? ORDER BY sequence_no", taskId),
                "runs", jdbc.queryForList("SELECT r.* FROM ai_stage_run r JOIN ai_task_stage s ON s.id=r.stage_id WHERE s.task_id=? ORDER BY r.id", taskId),
                "artifacts", jdbc.queryForList("SELECT * FROM ai_artifact WHERE task_id=? ORDER BY id", taskId),
                "gates", jdbc.queryForList("SELECT * FROM ai_gate_result WHERE task_id=? ORDER BY id", taskId),
                "events", jdbc.queryForList("SELECT sequence,event_type,percent,message,created_at FROM ai_progress_event WHERE task_id=? ORDER BY sequence DESC LIMIT 100", taskId));
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findReadyEvents(long cursor, int limit) {
        return jdbc.queryForList("SELECT e.sequence AS sequence,e.event_type AS eventType,t.task_code AS taskId,s.stage_code AS stageId,e.payload_json AS payloadJson "
                        + "FROM ai_progress_event e JOIN ai_task t ON t.id=e.task_id "
                        + "JOIN ai_task_stage s ON s.task_id=t.id AND s.status='READY' "
                        + "WHERE e.sequence>? AND e.event_type='stage.ready' ORDER BY e.sequence LIMIT ?",
                cursor, Math.max(1, Math.min(limit, 100)));
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> findApprovedRole(String stageCode) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT r.role_id AS roleId,r.version,r.digest,r.permissions_json AS permissionsJson "
                        + "FROM ai_task_stage s JOIN ai_role_version r ON r.id=s.role_version_id "
                        + "WHERE s.stage_code=? AND r.status='APPROVED'", stageCode);
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }

    /** {@inheritDoc} */
    @Override
    public Map<String, Object> resolveAgent(String roleId, String version) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT a.agent_id AS agentId,a.version,a.endpoint_type AS endpointType,a.endpoint," 
                        + "a.protocol_version AS protocolVersion,a.capabilities_json AS capabilitiesJson,a.config_digest AS digest,"
                        + "COALESCE(m.experienceLevel,'INEXPERIENCED') AS experienceLevel,"
                        + "COALESCE(m.codexPoolType,'DISPOSABLE') AS codexPoolType "
                        + "FROM ai_role_version r JOIN ai_role_agent_binding b ON b.role_version_id=r.id "
                        + "JOIN ai_agent_registration a ON a.id=b.agent_registration_id "
                        + "LEFT JOIN AiRole m ON m.roleCode=r.role_id AND m.status=1 "
                        + "WHERE r.role_id=? AND r.version=? AND r.status='APPROVED' AND b.status='ACTIVE' AND a.status='ACTIVE' "
                        + "ORDER BY b.priority LIMIT 2", roleId, version);
        if (rows.size() != 1) {
            return Map.of();
        }
        return rows.get(0);
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(transactionManager = "aiFactoryTransactionManager")
    public Map<String, Object> claimStage(String stageCode, String clientId, String leaseToken,
                                          String leaseDigest, Instant expiresAt) {
        int updated = jdbc.update("UPDATE ai_task_stage SET status='RUNNING',state_version=state_version+1 WHERE stage_code=? AND status='READY'",
                stageCode);
        if (updated != 1) {
            return Map.of();
        }
        Map<String, Object> stage = jdbc.queryForMap("SELECT id,task_id,state_version FROM ai_task_stage WHERE stage_code=?", stageCode);
        String runCode = "RUN-" + compactId();
        String stageThreadId = compactId();
        jdbc.update("INSERT INTO ai_stage_run(stage_id,run_code,stage_thread_id,client_id,attempt,status,lease_token_digest,lease_expires_at,last_sequence,created_at,updated_at) "
                        + "VALUES(?,?,?, ?,1,'RUNNING',?,?,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
                stage.get("id"), runCode, stageThreadId, clientId, leaseDigest, expiresAt);
        Long runId = jdbc.queryForObject("SELECT id FROM ai_stage_run WHERE run_code=?", Long.class, runCode);
        appendProgress(number(stage.get("task_id")), runId, "stage.claimed", 0, "本地 Python 已领取阶段",
                Map.of("runId", runCode, "clientId", clientId));
        return map("runId", runCode, "stageThreadId", stageThreadId, "leaseToken", leaseToken,
                "expiresAt", expiresAt.toString(), "stateVersion", stage.get("state_version"));
    }

    /** {@inheritDoc} */
    @Override
    public int appendAgentState(String runCode, String agentId, long sequence, String state, String digest) {
        Map<String, Object> run = jdbc.queryForMap(
                "SELECT r.id,s.task_id FROM ai_stage_run r JOIN ai_task_stage s ON s.id=r.stage_id WHERE r.run_code=?", runCode);
        int affected = jdbc.update("INSERT INTO ai_agent_state_event(task_id,run_id,agent_id,sequence,state,facts_digest,created_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)",
                run.get("task_id"), run.get("id"), agentId, sequence, state, digest);
        jdbc.update("UPDATE ai_stage_run SET agent_id=?,last_sequence=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND last_sequence<?",
                agentId, sequence, run.get("id"), sequence);
        return affected;
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(transactionManager = "aiFactoryTransactionManager")
    public Map<String, Object> completeRun(String runCode, int exitCode, List<String> artifactDigests) {
        Map<String, Object> run = jdbc.queryForMap(
                "SELECT r.id,r.stage_id,s.task_id FROM ai_stage_run r JOIN ai_task_stage s ON s.id=r.stage_id WHERE r.run_code=?", runCode);
        String status = exitCode == 0 ? "WAITING_FILE_GATE" : "FAILED";
        jdbc.update("UPDATE ai_stage_run SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", status, run.get("id"));
        jdbc.update("UPDATE ai_task_stage SET status=?,state_version=state_version+1 WHERE id=?",
                status, run.get("stage_id"));
        appendProgress(number(run.get("task_id")), number(run.get("id")), "stage.execution.finished",
                exitCode == 0 ? 90 : 100, status, Map.of("artifactDigests", artifactDigests));
        return map("status", status);
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(transactionManager = "aiFactoryTransactionManager")
    public Map<String, Object> registerArtifact(CommonParam command) {
        String artifactCode = "ART-" + compactId();
        Long taskId = jdbc.queryForObject("SELECT id FROM ai_task WHERE task_code=?", Long.class,
                required(command, "taskId"));
        Integer version = jdbc.queryForObject("SELECT COALESCE(MAX(version),0)+1 FROM ai_artifact WHERE task_id=? AND standard_name=?",
                Integer.class, taskId, required(command, "standardName"));
        jdbc.update("INSERT INTO ai_artifact(task_id,artifact_code,type,standard_name,logical_path,version,digest,size_bytes,gate_status,created_at) VALUES(?,?,?,?,?,?,?,?, 'PENDING',CURRENT_TIMESTAMP)",
                taskId, artifactCode, required(command, "type"), required(command, "standardName"),
                required(command, "logicalPath"), version, required(command, "sha256"),
                Long.parseLong(value(command, "size", "0")));
        appendProgress(taskId, null, "artifact.registered", 80, "产物摘要已登记", Map.of("artifactId", artifactCode));
        return map("artifactId", artifactCode, "version", version, "gateStatus", "PENDING");
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(transactionManager = "aiFactoryTransactionManager")
    public Map<String, Object> registerGateEvidence(CommonParam command) {
        String resultCode = "GR-" + compactId();
        Long taskId = jdbc.queryForObject("SELECT id FROM ai_task WHERE task_code=?", Long.class,
                required(command, "taskId"));
        String result = required(command, "result");
        jdbc.update("INSERT INTO ai_gate_result(task_id,result_code,gate_id,definition_version,runner_digest,artifact_digest,result,violations_json,evidence_digest,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,'ACTIVE',CURRENT_TIMESTAMP)",
                taskId, resultCode, required(command, "gateId"), required(command, "definitionVersion"),
                required(command, "runnerDigest"), required(command, "artifactDigest"), result,
                JsonUtils.toJsonIgnoreNull(command.getParam("violations")), required(command, "evidenceDigest"));
        appendProgress(taskId, null, "gate.result.registered", 95, "本地门禁证据已登记",
                Map.of("gateResultId", resultCode, "result", result));
        return map("gateResultId", resultCode, "aggregateStatus", result);
    }

    private void appendProgress(long taskId, Long runId, String eventType, int percent,
                                String message, Map<String, Object> payload) {
        String payloadJson = JsonUtils.toJsonIgnoreNull(payload);
        jdbc.update("INSERT INTO ai_progress_event(task_id,run_id,event_type,percent,message,payload_digest,payload_json,created_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)",
                taskId, runId, eventType, percent, message, sha256(payloadJson), payloadJson);
    }

    private static String required(CommonParam command, String key) {
        Object value = command == null ? null : command.getParam(key);
        if (value == null || String.valueOf(value).isBlank()) {
            throw new IllegalArgumentException(key + " 不能为空");
        }
        return String.valueOf(value);
    }

    private static String value(CommonParam command, String key, String fallback) {
        Object value = command == null ? null : command.getParam(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value);
    }

    private static String compactId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("运行环境缺少 SHA-256", exception);
        }
    }

    private static long number(Object value) {
        return value instanceof Number number ? number.longValue() : Long.parseLong(String.valueOf(value));
    }

    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) {
            result.put(String.valueOf(values[index]), values[index + 1]);
        }
        return result;
    }
}
