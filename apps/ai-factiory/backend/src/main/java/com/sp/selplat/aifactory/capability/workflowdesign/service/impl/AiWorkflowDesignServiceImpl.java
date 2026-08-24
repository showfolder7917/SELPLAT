package com.sp.selplat.aifactory.capability.workflowdesign.service.impl;

import com.sp.selplat.aifactory.airole.dao.AiRoleDao;
import com.sp.selplat.aifactory.aiworkflowdefinition.dao.AiWorkflowDefinitionDao;
import com.sp.selplat.aifactory.aiworkflowedge.dao.AiWorkflowEdgeDao;
import com.sp.selplat.aifactory.aiworkflownode.dao.AiWorkflowNodeDao;
import com.sp.selplat.aifactory.aiworkflownoderun.dao.AiWorkflowNodeRunDao;
import com.sp.selplat.aifactory.aiworkflowrun.dao.AiWorkflowRunDao;
import com.sp.selplat.aifactory.aiworkflowversion.dao.AiWorkflowVersionDao;
import com.sp.selplat.aifactory.capability.workflowdesign.service.AiWorkflowDesignService;
import com.sp.selplat.aifactory.common.util.AiFactoryResults;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 使用六张工作流表业务 DAO 编排流程画布；运行事实仍只允许本地 Python 上报。 */
@Service
public class AiWorkflowDesignServiceImpl implements AiWorkflowDesignService {

    // 画布只允许三类开发角色进入节点，审核角色与项目经理不参与自动开发链。
    private static final Set<String> DEVELOPMENT_ROLE_CODES = Set.of(
            "REQUIREMENT_ANALYST", "SOFTWARE_ENGINEER", "TEST_ENGINEER");
    // 每张流程表通过自己的 BaseDao 访问私有库，capability Service 不再直接执行 SQL。
    private final AiWorkflowDefinitionDao definitionDao;
    private final AiWorkflowVersionDao versionDao;
    private final AiWorkflowNodeDao nodeDao;
    private final AiWorkflowEdgeDao edgeDao;
    private final AiWorkflowRunDao runDao;
    private final AiWorkflowNodeRunDao nodeRunDao;
    private final AiRoleDao roleDao;
    // 公共发号器按各表登记的稳定 seqCode 生成节点和连线主键。
    private final SequenceGenerator sequenceGenerator;

    /**
     * 创建流程画布编排服务。
     * 真实传参示例：Spring 注入六张流程表 DAO、角色 DAO 与平台公共发号器。
     * 真实返回示例：构造后可查询画布、增加角色节点、移动节点和增加连线。
     * 异常或副作用示例：任一表业务依赖缺失时 Spring 启动失败；构造不访问数据库。
     *
     * @param definitionDao 流程定义表 DAO
     * @param versionDao 流程版本表 DAO
     * @param nodeDao 流程节点表 DAO
     * @param edgeDao 流程连线表 DAO
     * @param runDao 流程运行表 DAO
     * @param nodeRunDao 节点运行表 DAO
     * @param roleDao 角色表 DAO
     * @param sequenceGenerator 公共号段生成器
     */
    public AiWorkflowDesignServiceImpl(
            AiWorkflowDefinitionDao definitionDao,
            AiWorkflowVersionDao versionDao,
            AiWorkflowNodeDao nodeDao,
            AiWorkflowEdgeDao edgeDao,
            AiWorkflowRunDao runDao,
            AiWorkflowNodeRunDao nodeRunDao,
            AiRoleDao roleDao,
            SequenceGenerator sequenceGenerator) {
        this.definitionDao = definitionDao;
        this.versionDao = versionDao;
        this.nodeDao = nodeDao;
        this.edgeDao = edgeDao;
        this.runDao = runDao;
        this.nodeRunDao = nodeRunDao;
        this.roleDao = roleDao;
        this.sequenceGenerator = sequenceGenerator;
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult snapshot(long projectId) {
        // 项目 → 当前流程定义；没有流程时返回可直接渲染的空画布结构。
        List<Map<String, Object>> workflows = definitionDao.findActiveByProjectId(projectId);
        Map<String, Object> data = new LinkedHashMap<>();
        if (workflows.isEmpty()) {
            data.put("workflow", null);
            data.put("nodes", List.of());
            data.put("edges", List.of());
            data.put("progress", List.of());
            return AiFactoryResults.success(data, "当前项目尚未设计流程。");
        }
        Map<String, Object> workflow = workflows.get(0);
        data.put("workflow", workflow);

        // 流程定义 → 最新版本；没有版本时保留流程摘要并返回空画布。
        List<Map<String, Object>> versions = versionDao.findLatestByWorkflowId(longValue(workflow, "id"));
        if (versions.isEmpty()) {
            data.put("version", null);
            data.put("nodes", List.of());
            data.put("edges", List.of());
            data.put("progress", List.of());
            return AiFactoryResults.success(data, "流程尚无版本。");
        }
        Map<String, Object> version = versions.get(0);
        long versionId = longValue(version, "id");
        data.put("version", version);

        // 节点表与角色表分别读取，再由编排层补齐画布展示名称和角色类型。
        List<Map<String, Object>> nodes = nodeDao.findActiveByVersionId(versionId).stream()
                .map(this::withRoleDisplay)
                .toList();
        data.put("nodes", nodes);
        data.put("edges", edgeDao.findActiveByVersionId(versionId));

        // 最新流程运行与节点运行事实分别查询；从未运行的节点统一显示 NOT_STARTED。
        Long latestRunId = runDao.findLatestIdByVersionId(versionId);
        Map<String, Map<String, Object>> runsByNode = new LinkedHashMap<>();
        if (latestRunId != null) {
            for (Map<String, Object> nodeRun : nodeRunDao.findByWorkflowRunId(latestRunId)) {
                runsByNode.put(String.valueOf(nodeRun.get("nodeId")), nodeRun);
            }
        }
        data.put("progress", nodes.stream()
                .map(node -> progressRecord(node, runsByNode.get(String.valueOf(node.get("id")))))
                .toList());
        return AiFactoryResults.success(data, "流程画布查询完成。");
    }

    /** {@inheritDoc} */
    @Override
    @Transactional("aiFactoryTransactionManager")
    public CommonResult addRoleNode(CommonParam command) {
        long versionId = requiredLong(command, "workflowVersionId");
        long roleId = requiredLong(command, "roleId");
        // 角色必须存在且属于三类开发角色，才允许生成流程节点。
        Map<String, Object> role = roleDao.findActiveById(roleId);
        if (!DEVELOPMENT_ROLE_CODES.contains(String.valueOf(role.get("roleCode")))) {
            throw new IllegalArgumentException("流程设计只允许需求分析师、软件工程师和测试工程师。");
        }
        versionDao.findById(versionId);
        long id = sequenceGenerator.nextId("AiWorkflowNodeId");
        String code = "ROLE_" + id;
        // 生成主键和节点编码 → 由节点 DAO 一次写入角色节点。
        nodeDao.insertRoleNode(
                id, versionId, code, String.valueOf(role.get("roleName")), roleId,
                number(command, "positionX"), number(command, "positionY"));
        return AiFactoryResults.success(Map.of("id", id, "nodeCode", code), "角色节点已加入流程。");
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult moveNode(CommonParam command) {
        long id = requiredLong(command, "id");
        // 坐标更新必须命中唯一启用节点，否则阻断页面误报保存成功。
        int affected = nodeDao.move(id, number(command, "positionX"), number(command, "positionY"));
        if (affected != 1) {
            throw new IllegalArgumentException("流程节点不存在。");
        }
        return AiFactoryResults.success(Map.of("id", id), "节点位置已保存。");
    }

    /** {@inheritDoc} */
    @Override
    @Transactional("aiFactoryTransactionManager")
    public CommonResult addEdge(CommonParam command) {
        long sourceId = requiredLong(command, "sourceNodeId");
        long targetId = requiredLong(command, "targetNodeId");
        if (sourceId == targetId) {
            throw new IllegalArgumentException("流程连线不能指向自身。");
        }
        Map<String, Object> source = nodeDao.findActiveById(sourceId);
        Map<String, Object> target = nodeDao.findActiveById(targetId);
        if (!String.valueOf(source.get("workflowVersionId"))
                .equals(String.valueOf(target.get("workflowVersionId")))) {
            throw new IllegalArgumentException("只能连接同一流程版本的节点。");
        }
        // 同版本起点与终点 → 公共号段生成连线主键并由连线 DAO 落库。
        long id = sequenceGenerator.nextId("AiWorkflowEdgeId");
        edgeDao.insertSequence(id, longValue(source, "workflowVersionId"), sourceId, targetId);
        return AiFactoryResults.success(Map.of("id", id), "流程连线已保存。");
    }

    /**
     * 为节点补充角色展示字段。
     * 真实传参示例：{@code {id:160001,roleId:100010,nodeName:"需求分析师"}}。
     * 真实返回示例：增加 {@code roleName:"需求分析师",roleType:"ENGINEER"} 的节点映射。
     * 异常或副作用示例：角色不存在时角色 DAO 抛出异常；不修改原节点映射。
     *
     * @param node 节点表记录
     * @return 带角色展示字段的新映射
     */
    private Map<String, Object> withRoleDisplay(Map<String, Object> node) {
        Map<String, Object> result = new LinkedHashMap<>(node);
        Object roleId = node.get("roleId");
        if (roleId != null) {
            Map<String, Object> role = roleDao.findActiveById(Long.parseLong(String.valueOf(roleId)));
            result.put("roleName", role.get("roleName"));
            result.put("roleType", role.get("roleType"));
        }
        return result;
    }

    /**
     * 合并节点定义和最近运行事实为页面进度记录。
     * 真实传参示例：节点 {@code id=160001} 与运行事实 {@code status=RUNNING,currentWork=生成代码}。
     * 真实返回示例：返回包含节点名称、角色、状态、耗时和日志路径的完整进度映射。
     * 异常或副作用示例：运行事实为空时状态返回 NOT_STARTED，其他运行字段为空；方法只读。
     *
     * @param node 带角色展示字段的节点
     * @param nodeRun 最近节点运行事实，可为空
     * @return 页面进度记录
     */
    private Map<String, Object> progressRecord(
            Map<String, Object> node, Map<String, Object> nodeRun) {
        Map<String, Object> progress = new LinkedHashMap<>();
        progress.put("nodeId", node.get("id"));
        progress.put("nodeName", node.get("nodeName"));
        progress.put("roleId", node.get("roleId"));
        progress.put("roleName", node.get("roleName"));
        progress.put("status", nodeRun == null ? "NOT_STARTED" : nodeRun.get("status"));
        progress.put("currentWork", nodeRun == null ? null : nodeRun.get("currentWork"));
        progress.put("startedAt", nodeRun == null ? null : nodeRun.get("startedAt"));
        progress.put("endedAt", nodeRun == null ? null : nodeRun.get("endedAt"));
        progress.put("elapsedMillis", nodeRun == null || nodeRun.get("elapsedMillis") == null
                ? 0 : nodeRun.get("elapsedMillis"));
        progress.put("localLogPath", nodeRun == null ? null : nodeRun.get("localLogPath"));
        return progress;
    }

    /**
     * 从记录中读取必需长整数。
     * 真实传参示例：记录含 {@code workflowVersionId=150001}，key 为 workflowVersionId。
     * 真实返回示例：返回 {@code 150001L}。
     * 异常或副作用示例：字段为空或不是整数时抛出转换异常；不修改记录。
     *
     * @param record 数据库记录
     * @param key 必需字段名
     * @return 长整数值
     */
    private long longValue(Map<String, Object> record, String key) {
        return Long.parseLong(String.valueOf(record.get(key)));
    }

    /**
     * 从请求中读取必需长整数。
     * 真实传参示例：command 含 {@code roleId=100010}，key 为 roleId。
     * 真实返回示例：返回 {@code 100010L}。
     * 异常或副作用示例：字段为空或不是整数时抛出参数异常；不修改请求。
     *
     * @param command 画布请求参数
     * @param key 必需字段名
     * @return 长整数参数值
     */
    private long requiredLong(CommonParam command, String key) {
        Object value = command == null ? null : command.getParam(key);
        if (value == null || String.valueOf(value).isBlank()) {
            throw new IllegalArgumentException(key + " 不能为空。");
        }
        return Long.parseLong(String.valueOf(value));
    }

    /**
     * 从请求中读取画布坐标并为空值提供零坐标。
     * 真实传参示例：command 含 {@code positionX=120.5}，key 为 positionX。
     * 真实返回示例：返回 {@code 120.5D}。
     * 异常或副作用示例：非数字文本触发转换异常；空值返回零且不修改请求。
     *
     * @param command 画布请求参数
     * @param key 坐标字段名
     * @return 双精度坐标
     */
    private double number(CommonParam command, String key) {
        Object value = command == null ? null : command.getParam(key);
        return value == null || String.valueOf(value).isBlank()
                ? 0D : Double.parseDouble(String.valueOf(value));
    }
}
