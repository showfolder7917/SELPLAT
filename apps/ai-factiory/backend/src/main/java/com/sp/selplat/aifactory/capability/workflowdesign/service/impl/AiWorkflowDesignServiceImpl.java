package com.sp.selplat.aifactory.capability.workflowdesign.service.impl;

import com.sp.selplat.aifactory.capability.workflowdesign.service.AiWorkflowDesignService;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 使用 AI 工厂私有库维护流程定义；运行事实仍只允许本地 Python 上报。 */
@Service
public class AiWorkflowDesignServiceImpl implements AiWorkflowDesignService {
    private static final Set<String> DEVELOPMENT_ROLE_CODES = Set.of(
            "REQUIREMENT_ANALYST", "SOFTWARE_ENGINEER", "TEST_ENGINEER");
    private final JdbcTemplate jdbc;
    private final SequenceGenerator sequenceGenerator;

    /**
     * 创建流程设计服务。
     * 真实传参示例：注入 aiFactoryDataSource 与平台公共发号器。
     * 真实返回示例：构造后可读写流程定义六张表。
     * 异常或副作用示例：依赖缺失时 Spring 启动失败；构造不访问数据库。
     * @param dataSource AI 工厂私有数据源
     * @param sequenceGenerator 公共号段生成器
     */
    public AiWorkflowDesignServiceImpl(
            @Qualifier("aiFactoryDataSource") DataSource dataSource,
            SequenceGenerator sequenceGenerator) {
        this.jdbc = new JdbcTemplate(dataSource);
        this.sequenceGenerator = sequenceGenerator;
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult snapshot(long projectId) {
        List<Map<String, Object>> workflows = jdbc.queryForList(
                "SELECT * FROM AiWorkflowDefinition WHERE projectId=? AND status<>0 ORDER BY sortnum,id",
                projectId);
        Map<String, Object> data = new LinkedHashMap<>();
        if (workflows.isEmpty()) {
            data.put("workflow", null);
            data.put("nodes", List.of());
            data.put("edges", List.of());
            data.put("progress", List.of());
            return AiFactoryResults.success(data, "当前项目尚未设计流程。");
        }
        Map<String, Object> workflow = workflows.get(0);
        List<Map<String, Object>> versions = jdbc.queryForList(
                "SELECT * FROM AiWorkflowVersion WHERE workflowId=? ORDER BY versionNo DESC LIMIT 1",
                workflow.get("id"));
        data.put("workflow", workflow);
        if (versions.isEmpty()) {
            data.put("version", null);
            data.put("nodes", List.of());
            data.put("edges", List.of());
            data.put("progress", List.of());
            return AiFactoryResults.success(data, "流程尚无版本。");
        }
        Map<String, Object> version = versions.get(0);
        Object versionId = version.get("id");
        data.put("version", version);
        data.put("nodes", jdbc.queryForList(
                "SELECT n.*,r.roleName,r.roleType FROM AiWorkflowNode n LEFT JOIN AiRole r ON r.id=n.roleId "
                        + "WHERE n.workflowVersionId=? AND n.status<>0 ORDER BY n.sortnum,n.id", versionId));
        data.put("edges", jdbc.queryForList(
                "SELECT * FROM AiWorkflowEdge WHERE workflowVersionId=? AND status<>0 ORDER BY sortnum,id",
                versionId));
        data.put("progress", jdbc.queryForList(
                "SELECT n.id nodeId,n.nodeName,n.roleId,r.roleName,COALESCE(nr.status,'NOT_STARTED') status,"
                        + "nr.currentWork,nr.startedAt,nr.endedAt,COALESCE(nr.elapsedMillis,0) elapsedMillis,"
                        + "nr.localLogPath FROM AiWorkflowNode n LEFT JOIN AiRole r ON r.id=n.roleId "
                        + "LEFT JOIN AiWorkflowNodeRun nr ON nr.nodeId=n.id AND nr.workflowRunId=(SELECT MAX(wr.id) "
                        + "FROM AiWorkflowRun wr WHERE wr.workflowVersionId=?) WHERE n.workflowVersionId=? "
                        + "AND n.status<>0 ORDER BY n.sortnum,n.id", versionId, versionId));
        return AiFactoryResults.success(data, "流程画布查询完成。");
    }

    /** {@inheritDoc} */
    @Override
    @Transactional("aiFactoryTransactionManager")
    public CommonResult addRoleNode(CommonParam command) {
        long versionId = requiredLong(command, "workflowVersionId");
        long roleId = requiredLong(command, "roleId");
        Map<String, Object> role = one("SELECT id,roleCode,roleName FROM AiRole WHERE id=? AND status=1", roleId);
        if (!DEVELOPMENT_ROLE_CODES.contains(String.valueOf(role.get("roleCode")))) {
            throw new IllegalArgumentException("流程设计只允许需求分析师、软件工程师和测试工程师。");
        }
        one("SELECT id FROM AiWorkflowVersion WHERE id=?", versionId);
        long id = sequenceGenerator.nextId("AiWorkflowNodeId");
        String code = "ROLE_" + id;
        jdbc.update("INSERT INTO AiWorkflowNode(id,workflowVersionId,nodeCode,nodeName,nodeType,roleId,"
                        + "positionX,positionY,joinPolicy,status,sortnum) VALUES(?,?,?,?,?,?,?,?,?,1,?)",
                id, versionId, code, role.get("roleName"), "ROLE", roleId,
                number(command, "positionX"), number(command, "positionY"), "ALL", id);
        return AiFactoryResults.success(Map.of("id", id, "nodeCode", code), "角色节点已加入流程。");
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult moveNode(CommonParam command) {
        long id = requiredLong(command, "id");
        int affected = jdbc.update("UPDATE AiWorkflowNode SET positionX=?,positionY=?,updatedAt=CURRENT_TIMESTAMP "
                        + "WHERE id=? AND status<>0",
                number(command, "positionX"), number(command, "positionY"), id);
        if (affected != 1) throw new IllegalArgumentException("流程节点不存在。");
        return AiFactoryResults.success(Map.of("id", id), "节点位置已保存。");
    }

    /** {@inheritDoc} */
    @Override
    @Transactional("aiFactoryTransactionManager")
    public CommonResult addEdge(CommonParam command) {
        long sourceId = requiredLong(command, "sourceNodeId");
        long targetId = requiredLong(command, "targetNodeId");
        if (sourceId == targetId) throw new IllegalArgumentException("流程连线不能指向自身。");
        Map<String, Object> source = one("SELECT workflowVersionId FROM AiWorkflowNode WHERE id=? AND status<>0", sourceId);
        Map<String, Object> target = one("SELECT workflowVersionId FROM AiWorkflowNode WHERE id=? AND status<>0", targetId);
        if (!String.valueOf(source.get("workflowVersionId")).equals(String.valueOf(target.get("workflowVersionId")))) {
            throw new IllegalArgumentException("只能连接同一流程版本的节点。");
        }
        long id = sequenceGenerator.nextId("AiWorkflowEdgeId");
        jdbc.update("INSERT INTO AiWorkflowEdge(id,workflowVersionId,sourceNodeId,targetNodeId,edgeType,status,sortnum) "
                        + "VALUES(?,?,?,?,?,1,?)", id, source.get("workflowVersionId"), sourceId, targetId, "SEQUENCE", id);
        return AiFactoryResults.success(Map.of("id", id), "流程连线已保存。");
    }

    /**
     * 查询必须唯一存在的一条流程相关记录。
     * 真实传参示例：SQL 为 {@code SELECT id FROM AiRole WHERE id=?}，参数为 {@code 100015}。
     * 真实返回示例：返回包含 {@code id=100015} 的字段映射。
     * 异常或副作用示例：无记录或多记录时 JDBC 抛出异常；方法不修改数据库。
     * @param sql 单参数唯一记录查询
     * @param value 查询参数
     * @return 唯一记录字段映射
     */
    private Map<String, Object> one(String sql, Object value) { return jdbc.queryForMap(sql, value); }

    /**
     * 从请求中读取必需长整数。
     * 真实传参示例：command 含 {@code roleId=100015}，key 为 {@code roleId}。
     * 真实返回示例：返回 {@code 100015L}。
     * 异常或副作用示例：字段为空或不是整数时抛出参数异常；不修改请求。
     * @param command 画布请求参数
     * @param key 必需字段名
     * @return 长整数参数值
     */
    private long requiredLong(CommonParam command, String key) {
        Object value = command == null ? null : command.getParam(key);
        if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException(key + " 不能为空。");
        return Long.parseLong(String.valueOf(value));
    }

    /**
     * 从请求中读取画布坐标并为空值提供零坐标。
     * 真实传参示例：command 含 {@code positionX=120.5}，key 为 {@code positionX}。
     * 真实返回示例：返回 {@code 120.5D}。
     * 异常或副作用示例：非数字文本触发转换异常；空值返回零且不修改请求。
     * @param command 画布请求参数
     * @param key 坐标字段名
     * @return 双精度坐标
     */
    private double number(CommonParam command, String key) {
        Object value = command == null ? null : command.getParam(key);
        return value == null || String.valueOf(value).isBlank() ? 0D : Double.parseDouble(String.valueOf(value));
    }
}
