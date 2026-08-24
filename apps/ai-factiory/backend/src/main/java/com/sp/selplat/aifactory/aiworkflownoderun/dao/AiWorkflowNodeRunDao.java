package com.sp.selplat.aifactory.aiworkflownoderun.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.List;
import java.util.Map;

/** 标记 AiWorkflowNodeRun 节点运行表的公共持久化契约。 */
public interface AiWorkflowNodeRunDao extends BaseDao {

    /**
     * 查询一次流程运行中的全部节点执行事实。
     * 真实传参示例：流程运行主键 {@code 180003L}。
     * 真实返回示例：{@code [{nodeId:160001,status:"RUNNING",currentWork:"生成代码"}]}。
     * 异常或副作用示例：没有执行事实时返回空列表；方法只读。
     *
     * @param workflowRunId 流程运行主键
     * @return 节点运行记录
     */
    List<Map<String, Object>> findByWorkflowRunId(long workflowRunId);
}
