package com.sp.selplat.referencedata.capability.resourcequery.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.capability.resourcequery.service.ReferenceDataResourceQueryService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 发布只接受 ReferenceDataType.code 的类型与节点公共只读接口。 */
@RestController
@ModuleDescription(code = "reference-data-resource-query", name = "引用数据资源查询", description = "按唯一 code 查询类型和节点")
@RequestMapping("/api/reference-data/types")
public class ReferenceDataResourceQueryController {

    private final ReferenceDataResourceQueryService service;

    /**
     * 创建唯一 code 查询 Controller。
     * 真实传参示例：Spring 注入 {@code ReferenceDataResourceQueryServiceImpl}。
     * 真实返回示例：返回可发布两个只读 GET 地址的 Controller 实例。
     * 异常或副作用示例：依赖缺失时 Spring 启动失败；构造过程不访问数据库。
     *
     * @param service code 查询编排服务
     */
    public ReferenceDataResourceQueryController(ReferenceDataResourceQueryService service) {
        this.service = service;
    }

    /**
     * 按唯一 code 查询启用类型。
     * 真实传参示例：{@code GET /api/reference-data/types/type101001}。
     * 真实返回示例：{@code {"success":true,"data":{"type":"DROPDOWN"}}}。
     * 异常或副作用示例：code 不存在时返回统一业务错误；不写数据库。
     *
     * @param typeCode 类型唯一 code
     * @return 类型详情 JSON
     */
    @GetMapping(value = "/{typeCode}", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getType(@PathVariable("typeCode") String typeCode) {
        return JsonUtils.toJsonIgnoreNull(service.getType(typeCode));
    }

    /**
     * 按唯一类型 code 查询节点表现。
     * 真实传参示例：{@code GET /api/reference-data/types/type101001/nodes?locale=zh-CN}。
     * 真实返回示例：DROPDOWN 类型返回 {@code {"success":true,"data":[{"value":"TREE"}]}}。
     * 异常或副作用示例：没有启用节点时返回统一业务错误；不写数据库。
     *
     * @param typeCode 类型唯一 code
     * @param parameters locale 等查询参数
     * @return 类型化节点 JSON
     */
    @GetMapping(value = "/{typeCode}/nodes", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getNodes(
            @PathVariable("typeCode") String typeCode,
            @RequestParam Map<String, String> parameters) {
        return JsonUtils.toJsonIgnoreNull(service.getNodes(typeCode, parameters));
    }
}
