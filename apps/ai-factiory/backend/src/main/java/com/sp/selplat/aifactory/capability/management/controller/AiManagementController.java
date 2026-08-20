package com.sp.selplat.aifactory.capability.management.controller;

import com.sp.selplat.aifactory.capability.management.service.AiManagementService;
import com.sp.selplat.common.util.JsonUtils;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 AI 工厂管理页面需要的只读树表聚合接口。 */
@RestController
@RequestMapping(value = "/api/v1/ai-factory/management", produces = MediaType.APPLICATION_JSON_VALUE)
public class AiManagementController {

    private final AiManagementService service;

    /**
     * 注入管理聚合 Service。
     * 真实传参示例：Spring 注入 {@code AiRoleServiceImpl}。
     * 真实返回示例：控制器可响应 {@code GET /dashboard}。
     * 异常或副作用示例：Service 缺失时启动失败；构造过程无数据库访问。
     *
     * @param service 管理聚合 Service
     */
    public AiManagementController(AiManagementService service) {
        this.service = service;
    }

    /**
     * 返回管理页当前树表快照。
     * 真实传参示例：浏览器访问 {@code GET /api/v1/ai-factory/management/dashboard}。
     * 真实返回示例：UTF-8 JSON 中包含 {@code AiRole} 对应角色记录和阶段耗时。
     * 异常或副作用示例：数据库异常由统一异常处理返回；本接口不写数据。
     *
     * @return 管理页聚合 JSON
     */
    @GetMapping("/dashboard")
    public String dashboard() {
        return JsonUtils.toJsonIgnoreNull(service.getDashboard());
    }
}
