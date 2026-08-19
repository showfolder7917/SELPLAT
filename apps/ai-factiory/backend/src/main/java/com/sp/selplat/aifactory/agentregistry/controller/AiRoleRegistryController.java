package com.sp.selplat.aifactory.agentregistry.controller;

import com.sp.selplat.aifactory.agentregistry.service.AiAgentRegistryService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布阶段冻结角色查询入口。 */
@RestController
@RequestMapping(value = "/api/v1/ai-factory/roles", produces = MediaType.APPLICATION_JSON_VALUE)
public class AiRoleRegistryController {
    private final AiAgentRegistryService service;

    /**
     * 注入登记 Service。
     * 真实传参示例：Spring 注入 AiAgentRegistryServiceImpl。
     * 真实返回示例：控制器可响应 stage.htm。
     * 异常或副作用示例：缺少 Service 时启动失败；无数据库写入。
     * @param service Agent 登记服务
     */
    public AiRoleRegistryController(AiAgentRegistryService service) { this.service = service; }

    /**
     * 查询阶段冻结角色并只序列化 Service 返回。
     * 真实传参示例：{@code {stageId:"STAGE-1"}}。
     * 真实返回示例：{@code {success:true,data:{roleId:"IMPLEMENTATION_ROLE"}}}。
     * 异常或副作用示例：只读；Controller 不解析 Agent。
     * @param query 阶段参数
     * @return Service 结果 JSON
     */
    @PostMapping("/stage.htm")
    public String getStageRole(@RequestBody CommonParam query) { return JsonUtils.toJsonIgnoreNull(service.getStageRole(query)); }
}

