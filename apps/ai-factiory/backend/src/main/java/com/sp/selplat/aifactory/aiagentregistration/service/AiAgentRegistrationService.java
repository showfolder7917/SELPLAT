package com.sp.selplat.aifactory.aiagentregistration.service;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/** 定义角色、Agent 登记解析和状态事实登记合同。 */
public interface AiAgentRegistrationService {
    /**
     * 查询阶段冻结角色。
     * 真实传参示例：{@code {stageId:"STAGE-1"}}。
     * 真实返回示例：{@code {roleId:"IMPLEMENTATION_ROLE",version:"1.0.0"}}。
     * 异常或副作用示例：未批准角色返回空数据；只读数据库。
     * @param query 阶段查询参数
     * @return 角色快照结果
     */
    CommonResult getStageRole(CommonParam query);

    /**
     * 解析角色唯一活动 Agent。
     * 真实传参示例：{@code {roleId:"IMPLEMENTATION_ROLE",roleVersion:"1.0.0"}}。
     * 真实返回示例：返回 LOCAL_CODEX 与 codex:// 逻辑地址。
     * 异常或副作用示例：没有唯一绑定时拒绝；Java 不连接或启动 Agent。
     * @param query 角色与版本参数
     * @return Agent 登记结果
     */
    CommonResult resolve(CommonParam query);

    /**
     * 登记 Python 上报的 Agent 状态事实。
     * 真实传参示例：{@code {runId:"RUN-1",agentId:"IMPLEMENTATION_AGENT",state:"STARTED",sequence:1}}。
     * 真实返回示例：{@code {acceptedSequence:1}}。
     * 异常或副作用示例：重复序号拒绝；仅写事实记录。
     * @param command Agent 状态事实
     * @return 接受序号结果
     */
    CommonResult reportState(CommonParam command);
}
