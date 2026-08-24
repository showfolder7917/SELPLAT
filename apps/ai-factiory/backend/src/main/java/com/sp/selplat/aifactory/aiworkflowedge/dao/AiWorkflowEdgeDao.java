package com.sp.selplat.aifactory.aiworkflowedge.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.List;
import java.util.Map;

/** 标记 AiWorkflowEdge 流程连线表的公共持久化契约。 */
public interface AiWorkflowEdgeDao extends BaseDao {

    /**
     * 查询一个流程版本中的启用连线。
     * 真实传参示例：版本主键 {@code 150001L}。
     * 真实返回示例：{@code [{id:170001,sourceNodeId:160001,targetNodeId:160002}]}。
     * 异常或副作用示例：没有连线时返回空列表；方法只读。
     *
     * @param workflowVersionId 流程版本主键
     * @return 启用连线记录
     */
    List<Map<String, Object>> findActiveByVersionId(long workflowVersionId);

    /**
     * 新增一条顺序连线。
     * 真实传参示例：{@code id=170001, workflowVersionId=150001, sourceNodeId=160001, targetNodeId=160002}。
     * 真实返回示例：返回受影响行数 {@code 1}。
     * 异常或副作用示例：主键或节点约束冲突时抛出数据访问异常；事务回滚。
     *
     * @param id 连线主键
     * @param workflowVersionId 流程版本主键
     * @param sourceNodeId 起点节点主键
     * @param targetNodeId 终点节点主键
     * @return 受影响行数
     */
    int insertSequence(long id, long workflowVersionId, long sourceNodeId, long targetNodeId);
}
