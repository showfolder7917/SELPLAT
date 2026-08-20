package com.sp.selplat.aifactory.airole.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/** 定义 AiRole 固定表公共业务能力。 */
public interface AiRoleService extends BaseService {

    /**
     * 更新角色管理页允许维护的业务字段，并按经验自动确定 Codex 连接池。
     * 真实传参示例：{@code {id:100010,roleName:"需求分析师",roleType:"ENGINEER",experienceLevel:"INEXPERIENCED"}}。
     * 真实返回示例：返回包含 {@code codexPoolType:"DISPOSABLE"} 的成功结果。
     * 异常或副作用示例：提交未开放字段或非法枚举时抛出稳定业务异常；不会写入半条记录。
     *
     * @param saveIn 角色编辑字段
     * @return 角色更新结果
     */
    CommonResult updateRole(CommonParam saveIn);

    /**
     * 校验角色树和 Agent 登记依赖后逻辑删除一个普通角色。
     * 真实传参示例：{@code {id:100010}}。
     * 真实返回示例：未被引用的叶子角色返回 {@code status:0} 的成功结果。
     * 异常或副作用示例：根节点、存在子节点或已有版本登记时抛出稳定业务异常且不删除。
     *
     * @param deleteIn 待删除角色主键
     * @return 逻辑删除结果
     */
    CommonResult deleteRole(CommonParam deleteIn);

    /**
     * 按完整角色 ID 顺序重新生成并批量保存 sortnum。
     * 真实传参示例：{@code {items:[{id:100010},{id:100011}]}}。
     * 真实返回示例：二十条角色全部更新时 {@code affectedRows=20}。
     * 异常或副作用示例：主键集合与当前角色不一致时整体拒绝；事务内不产生部分排序。
     *
     * @param reorderIn 页面当前完整角色顺序
     * @return 批量更新结果
     */
    CommonResult reorderRoles(CommonBatchParam reorderIn);
}
