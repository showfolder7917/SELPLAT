package com.sp.selplat.aifactory.aiworkflowversion.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.List;
import java.util.Map;

/** 标记 AiWorkflowVersion 流程版本表的公共持久化契约。 */
public interface AiWorkflowVersionDao extends BaseDao {

    /**
     * 查询流程定义的最新版本。
     * 真实传参示例：流程定义主键 {@code 140001L}。
     * 真实返回示例：{@code [{id:150001,workflowId:140001,versionNo:1}]}。
     * 异常或副作用示例：没有版本时返回空列表；方法只读。
     *
     * @param workflowId 流程定义主键
     * @return 至多一条最新版本记录
     */
    List<Map<String, Object>> findLatestByWorkflowId(long workflowId);

    /**
     * 查询一个流程版本并用于新增节点前的存在性校验。
     * 真实传参示例：流程版本主键 {@code 150001L}。
     * 真实返回示例：{@code {id:150001,workflowId:140001,versionNo:1}}。
     * 异常或副作用示例：版本不存在时底层查询抛出异常；方法只读。
     *
     * @param id 流程版本主键
     * @return 流程版本记录
     */
    Map<String, Object> findById(long id);
}
