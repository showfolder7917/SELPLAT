package com.sp.selplat.referencedata.referencedataoption.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedataoption.service.ReferenceDataOptionService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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

    /**
     * 分页查询下拉选项管理记录。
     *
     * @param queryIn 页码、容量和字段条件，例如 {@code {"pageNo":1,"pageSize":100,"typeId":1}}
     * @return 分页 JSON，例如 {@code {"records":[{"optionValue":"TREE"}],"totalCount":1}}
     */
    @GetMapping(value = "/admin/options/getStore.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getStore(CommonPageParam queryIn) {
        return JsonUtils.toJsonIgnoreNull(service.getStore(queryIn));
    }

    /**
     * 新增一条下拉选项。
     *
     * @param saveIn 选项字段，例如 {@code {"typeId":1,"optionValue":"TREE","labelZh":"树形资源"}}
     * @return 新增结果，例如 {@code {"success":true,"data":{"id":101000}}}
     * 异常或副作用示例：同一类型选项值重复时数据库拒绝写入。
     */
    @PostMapping(value = "/admin/options/create.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String create(CommonParam saveIn) {
        return JsonUtils.toJsonIgnoreNull(service.insert(saveIn));
    }

    /**
     * 更新一条下拉选项。
     *
     * @param saveIn 主键和待更新字段，例如 {@code {"id":101000,"labelZh":"树资源"}}
     * @return 更新结果，例如 {@code {"success":true,"data":{"id":101000}}}
     * 异常或副作用示例：字段违反长度、唯一键或外键约束时不产生部分更新。
     */
    @PostMapping(value = "/admin/options/update.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String update(CommonParam saveIn) {
        return JsonUtils.toJsonIgnoreNull(service.update(saveIn));
    }

    /**
     * 假删除一条下拉选项。
     *
     * @param deleteIn 主键参数，例如 {@code {"id":101000}}
     * @return 删除结果，例如 {@code {"success":true,"data":{"id":101000,"status":0}}}
     * 异常或副作用示例：记录不存在时公共 CRUD 返回统一未命中结果。
     */
    @PostMapping(value = "/admin/options/delete.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String delete(CommonParam deleteIn) {
        return JsonUtils.toJsonIgnoreNull(service.delete(deleteIn));
    }
}
