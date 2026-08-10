package com.sp.selplat.referencedata.referencedataoption.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedataoption.service.ReferenceDataOptionService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 发布 ReferenceDataOption 表对应的下拉选项查询接口。 */
@RestController
@ModuleDescription(code = "reference-data-option", name = "引用数据下拉选项", description = "查询数据库下拉选项")
@RequestMapping("/api/reference-data")
public class ReferenceDataOptionController {

    private final ReferenceDataOptionService service;

    /**
     * 创建下拉选项 Controller。
     *
     * @param service ReferenceDataOption 表 Service，例如 {@code ReferenceDataOptionServiceImpl}
     */
    public ReferenceDataOptionController(ReferenceDataOptionService service) {
        this.service = service;
    }

    /**
     * 查询数据库中的下拉选项。
     *
     * @param projectCode 项目编码，例如 {@code "reference-data"}
     * @param resourceCode 资源编码，例如 {@code "resource-kind"}
     * @param parameters 查询参数，例如 {@code {"locale":"ja-JP"}}
     * @return 选项 JSON，例如 {@code {"success":true,"data":[{"value":"TREE"}]}}
     */
    @GetMapping(value = "/{projectCode}/{resourceCode}/options", produces = MediaType.APPLICATION_JSON_VALUE)
    public String options(
            @PathVariable("projectCode") String projectCode,
            @PathVariable("resourceCode") String resourceCode,
            @RequestParam Map<String, String> parameters) {
        return JsonUtils.toJsonIgnoreNull(service.getOptions(projectCode, resourceCode, parameters));
    }
}
