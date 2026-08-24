package com.sp.selplat.aifactory.aiworkflowrun.dao;

import com.sp.selplat.common.db.dao.BaseDao;

/** 标记 AiWorkflowRun 流程运行表的公共持久化契约。 */
public interface AiWorkflowRunDao extends BaseDao {

    /**
     * 查询流程版本最近一次运行主键。
     * 真实传参示例：版本主键 {@code 150001L}。
     * 真实返回示例：存在运行时返回 {@code 180003L}，从未运行时返回 {@code null}。
     * 异常或副作用示例：数据库不可用时抛出数据访问异常；方法只读。
     *
     * @param workflowVersionId 流程版本主键
     * @return 最近运行主键或空值
     */
    Long findLatestIdByVersionId(long workflowVersionId);
}
