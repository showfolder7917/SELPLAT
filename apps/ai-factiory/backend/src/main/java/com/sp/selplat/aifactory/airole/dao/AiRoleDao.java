package com.sp.selplat.aifactory.airole.dao;

import com.sp.selplat.common.db.dao.BaseDao;

/** 标记 AiRole 固定表公共持久化契约。 */
public interface AiRoleDao extends BaseDao {

    /**
     * 判断角色节点是否仍有未删除的直接子节点。
     * 真实传参示例：传入工程师分类主键 {@code 100001L}。
     * 真实返回示例：存在需求分析师等子角色时返回 {@code true}。
     * 异常或副作用示例：数据库不可用时抛出数据访问异常；只执行计数查询。
     *
     * @param roleId 待删除角色主键
     * @return 是否存在未删除子角色
     */
    boolean hasActiveChildren(long roleId);

    /**
     * 判断角色编码是否已经进入版本化 Agent 登记链路。
     * 真实传参示例：传入 {@code IMPLEMENTATION_ROLE}。
     * 真实返回示例：ai_role_version 已登记该编码时返回 {@code true}。
     * 异常或副作用示例：数据库不可用时抛出数据访问异常；不会修改登记数据。
     *
     * @param roleCode 角色稳定编码
     * @return 是否存在角色版本登记
     */
    boolean hasRegisteredVersion(String roleCode);
}
