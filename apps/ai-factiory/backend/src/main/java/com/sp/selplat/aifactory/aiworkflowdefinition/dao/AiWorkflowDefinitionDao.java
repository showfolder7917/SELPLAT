package com.sp.selplat.aifactory.aiworkflowdefinition.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.List;
import java.util.Map;

/** 标记 AiWorkflowDefinition 流程定义表的公共持久化契约。 */
public interface AiWorkflowDefinitionDao extends BaseDao {

    /**
     * 查询项目当前启用的流程定义，并保持页面排序。
     * 真实传参示例：项目主键 {@code 130001L}。
     * 真实返回示例：{@code [{id:140001,projectId:130001,workflowName:"快速开发流程"}]}。
     * 异常或副作用示例：数据库不可用时抛出数据访问异常；方法只读。
     *
     * @param projectId 项目主键
     * @return 启用的流程定义记录
     */
    List<Map<String, Object>> findActiveByProjectId(long projectId);
}
