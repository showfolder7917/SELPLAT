package com.sp.selplat.aifactory.aigateresult.controller;

import com.sp.selplat.aifactory.aigateresult.service.AiGateResultService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布本地 Gate 证据登记入口。 */
@RestController
@RequestMapping(value = "/api/v1/ai-factory/gates", produces = MediaType.APPLICATION_JSON_VALUE)
public class AiGateResultController {
    private final AiGateResultService service;

    /**
     * 注入 Gate Service。
     * 真实传参示例：Spring 注入 AiGateResultServiceImpl。
     * 真实返回示例：控制器可响应 evidence.htm。
     * 异常或副作用示例：缺少 Service 时启动失败；不运行门禁。
     * @param service Gate 业务服务
     */
    public AiGateResultController(AiGateResultService service) { this.service = service; }

    /**
     * 登记 Gate 证据并只序列化 Service 返回。
     * 真实传参示例：{@code {gateId:"GATE_TASK_ROOT",result:"PASS"}}。
     * 真实返回示例：标准 Gate 登记 JSON。
     * 异常或副作用示例：Controller 不派生 Gate 结果。
     * @param command Gate 证据
     * @return Service 结果 JSON
     */
    @PostMapping("/evidence.htm")
    public String submitEvidence(@RequestBody CommonParam command) { return JsonUtils.toJsonIgnoreNull(service.submitEvidence(command)); }
}
