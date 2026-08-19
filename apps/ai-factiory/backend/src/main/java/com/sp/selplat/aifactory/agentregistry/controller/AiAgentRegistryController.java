package com.sp.selplat.aifactory.agentregistry.controller;

import com.sp.selplat.aifactory.agentregistry.service.AiAgentRegistryService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 Agent 解析和状态事实登记入口。 */
@RestController
@RequestMapping(value = "/api/v1/ai-factory/agents", produces = MediaType.APPLICATION_JSON_VALUE)
public class AiAgentRegistryController {
    private final AiAgentRegistryService service;

    /**
     * 注入 Agent 登记 Service。
     * 真实传参示例：Spring 注入 AiAgentRegistryServiceImpl。
     * 真实返回示例：控制器可响应 resolve/state。
     * 异常或副作用示例：缺少 Service 时启动失败；不启动 Agent。
     * @param service Agent 登记服务
     */
    public AiAgentRegistryController(AiAgentRegistryService service) { this.service = service; }

    /**
     * 解析活动 Agent 并只序列化 Service 返回。
     * 真实传参示例：{@code {roleId:"IMPLEMENTATION_ROLE",roleVersion:"1.0.0"}}。
     * 真实返回示例：包含 codex:// 逻辑地址的标准 JSON。
     * 异常或副作用示例：Controller 不连接 Agent。
     * @param query 角色参数
     * @return Service 结果 JSON
     */
    @PostMapping("/resolve.htm")
    public String resolve(@RequestBody CommonParam query) { return JsonUtils.toJsonIgnoreNull(service.resolve(query)); }

    /**
     * 登记 Agent 状态事实并只序列化 Service 返回。
     * 真实传参示例：{@code {runId:"RUN-1",state:"STARTED",sequence:1}}。
     * 真实返回示例：{@code {success:true,data:{acceptedSequence:1}}}。
     * 异常或副作用示例：Controller 不修改状态机。
     * @param command 状态事实
     * @return Service 结果 JSON
     */
    @PostMapping("/state.htm")
    public String reportState(@RequestBody CommonParam command) { return JsonUtils.toJsonIgnoreNull(service.reportState(command)); }
}

