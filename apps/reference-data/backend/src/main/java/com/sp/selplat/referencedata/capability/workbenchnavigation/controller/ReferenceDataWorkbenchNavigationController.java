package com.sp.selplat.referencedata.capability.workbenchnavigation.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.capability.workbenchnavigation.service.ReferenceDataWorkbenchNavigationService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 reference-data.html 首次加载使用的不落库公共导航接口。 */
@RestController
@ModuleDescription(
        code = "reference-data-workbench-navigation",
        name = "引用数据工作台导航",
        description = "提供五个一级模块及表格字段下钻方式")
@RequestMapping(value = "/api/reference-data/workbench/", produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferenceDataWorkbenchNavigationController {

    private final ReferenceDataWorkbenchNavigationService service;

    /**
     * 创建工作台导航 Controller。
     *
     * @param service 不落库导航服务，例如 {@code ReferenceDataWorkbenchNavigationServiceImpl}
     */
    public ReferenceDataWorkbenchNavigationController(ReferenceDataWorkbenchNavigationService service) {
        this.service = service;
    }

    /**
     * 返回原 reference-data.html 页面使用的一级导航定义。
     *
     * 真实传参示例：{@code GET /api/reference-data/workbench/navigation.htm}，无查询参数。
     * 真实返回示例：JSON 中包含五个模块且不包含 {@code columns} 一级节点。
     * 异常或副作用示例：接口不访问数据库；序列化失败时由公共异常处理器返回系统错误。
     *
     * @return 工作台导航 JSON，例如 {@code {"success":true,"data":{"initialKey":"types"}}}
     */
    @GetMapping("navigation.htm")
    public String navigation() {
        return JsonUtils.toJsonIgnoreNull(service.navigation());
    }
}
