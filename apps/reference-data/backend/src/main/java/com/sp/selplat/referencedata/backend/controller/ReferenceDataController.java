package com.sp.selplat.referencedata.backend.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.backend.service.ReferenceDataApiService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 对外提供已登记引用数据资源的树和类型选项查询接口。
 * Controller 不访问 Provider、不构建响应字段，只绑定 HTTP 参数并序列化 Service 返回的 CommonResult。
 */
@RestController
@ModuleDescription(
        code = "reference-data-query",
        name = "引用数据查询",
        description = "按项目和资源编码查询公共树与类型选项")
@RequestMapping("/api/reference-data")
public class ReferenceDataController {

    // API 结果编排 Service → 参数转换、Provider 查询和 CommonResult 构建的唯一入口。
    private final ReferenceDataApiService service;

    /**
     * 创建引用数据 HTTP Controller。
     *
     * @param service Spring 注入的 API Service，例如 {@code DefaultReferenceDataApiService}
     */
    public ReferenceDataController(ReferenceDataApiService service) {
        // 单一 API Service → Controller 不跨层依赖 Provider 或注册表。
        this.service = service;
    }

    /**
     * 查询一个已登记资源的完整树。
     *
     * @param projectCode 路径中的项目编码，例如 {@code "reference-data"}
     * @param resourceCode 路径中的资源编码，例如 {@code "resource-kind"}
     * @param tenantId 查询参数中的租户标识，例如 {@code "10001"}；平台资源可以为空
     * @param parameters 全部查询参数，例如 {@code {"locale":"en-US"}}
     * @return 树查询 JSON，例如
     *     {@code {"success":true,"moduleCode":"reference-data","data":[{"id":"resource-kind-root","children":[{"value":"TREE"}]}],"msg":"引用数据树查询完成。"}}
     */
    @GetMapping(
            value = "/{projectCode}/{resourceCode}/tree",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public String tree(
            @PathVariable("projectCode") String projectCode,
            @PathVariable("resourceCode") String resourceCode,
            @RequestParam(name = "tenantId", required = false) String tenantId,
            @RequestParam Map<String, String> parameters) {
        // HTTP 路径与查询参数 → Service 完整结果 → 忽略 null 字段的稳定 JSON。
        return JsonUtils.toJsonIgnoreNull(service.getTree(projectCode, resourceCode, tenantId, parameters));
    }

    /**
     * 查询一个已登记资源的类型选项。
     *
     * @param projectCode 路径中的项目编码，例如 {@code "reference-data"}
     * @param resourceCode 路径中的资源编码，例如 {@code "resource-kind"}
     * @param tenantId 查询参数中的租户标识，例如 {@code "10001"}；平台资源可以为空
     * @param parameters 全部查询参数，例如 {@code {"locale":"ja-JP"}}
     * @return 类型选项 JSON，例如
     *     {@code {"success":true,"moduleCode":"reference-data","data":[{"value":"TREE","label":"ツリーリソース"}],"msg":"引用数据选项查询完成。"}}
     */
    @GetMapping(
            value = "/{projectCode}/{resourceCode}/options",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public String options(
            @PathVariable("projectCode") String projectCode,
            @PathVariable("resourceCode") String resourceCode,
            @RequestParam(name = "tenantId", required = false) String tenantId,
            @RequestParam Map<String, String> parameters) {
        // HTTP 路径与查询参数 → Service 完整结果 → 忽略 null 字段的稳定 JSON。
        return JsonUtils.toJsonIgnoreNull(service.getOptions(projectCode, resourceCode, tenantId, parameters));
    }
}
