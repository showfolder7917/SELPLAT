package com.sp.selplat.host.controller;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.referencedata.contract.service.ReferenceDataQueryService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 提供 platform-runtime 自身的运行状态，不承载任何业务模块数据。
 * 健康响应同时验证 reference-data 查询 Service 已由宿主成功装配。
 */
@RestController
@RequestMapping("/api/platform/runtime")
public class PlatformRuntimeController {

    // 引用数据查询契约 → 宿主已成功导入 reference-data backend 的装配证据。
    private final ReferenceDataQueryService referenceDataQueryService;

    /**
     * 创建平台运行状态 Controller。
     *
     * @param referenceDataQueryService host 装配的引用数据查询 Service，例如
     *     {@code DefaultReferenceDataQueryService}
     */
    public PlatformRuntimeController(ReferenceDataQueryService referenceDataQueryService) {
        this.referenceDataQueryService = referenceDataQueryService;
    }

    /**
     * 返回统一宿主与当前已装配模块状态。
     *
     * @return 固定成功结构，例如
     *     {@code {"success":true,"data":{"status":"READY","runtime":"platform-runtime",}}
     *     {@code "modules":["host","reference-data","uniauth"],"referenceDataServiceReady":true},}
     *     {@code "msg":"平台宿主已启动。"}}
     */
    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public String health() {
        Map<String, Object> data = new LinkedHashMap<>();
        // 当前 Spring 上下文事实 → 平台状态、运行时身份和已装配模块清单。
        data.put("status", "READY");
        data.put("runtime", "platform-runtime");
        data.put("modules", List.of("host", "reference-data", "uniauth"));
        data.put("referenceDataServiceReady", referenceDataQueryService != null);

        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setData(data);
        result.setMsg("平台宿主已启动。");
        // 完整 CommonResult → host 健康检查使用的 application/json 文本。
        return JsonUtils.toJsonIgnoreNull(result);
    }
}
