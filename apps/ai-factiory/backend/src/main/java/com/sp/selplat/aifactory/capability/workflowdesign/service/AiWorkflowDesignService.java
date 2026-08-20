package com.sp.selplat.aifactory.capability.workflowdesign.service;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/** 定义项目流程画布及角色节点进度的控制面能力。 */
public interface AiWorkflowDesignService {
    /**
     * 查询一个项目的当前流程、节点、连线和最新节点运行事实。
     * 真实传参示例：{@code projectId=130001}。
     * 真实返回示例：返回 workflow、nodes、edges、progress 四组数据。
     * 异常或副作用示例：项目没有流程时返回空集合；只读数据库。
     * @param projectId 项目主键
     * @return 流程画布快照
     */
    CommonResult snapshot(long projectId);

    /**
     * 创建一个独立角色节点实例，同一允许角色可以重复加入。
     * 真实传参示例：{@code {workflowVersionId:160000,roleId:100015,positionX:120,positionY:80}}。
     * 真实返回示例：返回 {@code {id:170010,nodeCode:"ROLE_170010"}}。
     * 异常或副作用示例：非三类开发角色被拒绝；成功时新增一个画布节点。
     * @param command 流程版本、角色和画布坐标
     * @return 新节点主键与稳定编码
     */
    CommonResult addRoleNode(CommonParam command);

    /**
     * 保存一个现有节点的画布位置。
     * 真实传参示例：{@code {id:170001,positionX:320,positionY:180}}。
     * 真实返回示例：返回 {@code {id:170001}}。
     * 异常或副作用示例：节点不存在时拒绝更新；成功时刷新节点更新时间。
     * @param command 节点主键和新坐标
     * @return 已移动节点主键
     */
    CommonResult moveNode(CommonParam command);

    /**
     * 创建同一流程版本中两个节点实例间的有向连线。
     * 真实传参示例：{@code {sourceNodeId:170001,targetNodeId:170002}}。
     * 真实返回示例：返回 {@code {id:180010}}。
     * 异常或副作用示例：自连或跨版本连线被拒绝；成功时新增顺序连线。
     * @param command 来源节点与目标节点主键
     * @return 新连线主键
     */
    CommonResult addEdge(CommonParam command);
}
