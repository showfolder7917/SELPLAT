package com.sp.selplat.aifactory.airole.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.Map;

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
     * 查询一个启用角色供流程节点展示和校验。
     * 真实传参示例：角色主键 {@code 100010L}。
     * 真实返回示例：{@code {id:100010,roleCode:"REQUIREMENT_ANALYST",roleName:"需求分析师"}}。
     * 异常或副作用示例：角色不存在时底层查询抛出异常；方法只读。
     *
     * @param roleId 角色主键
     * @return 启用角色记录
     */
    Map<String, Object> findActiveById(long roleId);

}
