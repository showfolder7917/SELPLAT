package com.sp.selplat.referencedata.backend.type.controller;

import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.referencedata.backend.type.service.ReferenceDataTypeAdminService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 发布引用数据类型管理 API。
 * Controller 只绑定 HTTP 参数并序列化 Service 已完成的公共结果，不执行校验、SQL 或响应包装。
 */
@RestController
@RequestMapping(value = "/api/reference-data/admin/types", produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferenceDataTypeAdminController {

    // service 拥有类型管理业务返回结构，Controller 不修改其任何字段。
    private final ReferenceDataTypeAdminService service;

    /**
     * 装配类型管理 Controller。
     *
     * @param service Spring 注入的类型管理 Service
     * 执行结果示例：HTTP 请求参数绑定完成后直接委托 Service 并序列化结果。
     */
    public ReferenceDataTypeAdminController(ReferenceDataTypeAdminService service) {
        // 强类型 Service → 当前 Controller 全部管理动作。
        this.service = service;
    }

    /**
     * 查询类型管理分页列表。
     *
     * @param queryIn 查询串解析的分页和筛选参数，例如
     *     {@code pageNo=1&pageSize=20&keyword=resource&status=1}
     * @return 分页 JSON，例如
     *     {@code {"records":[{"id":1,"projectCode":"reference-data"}],"totalCount":1,"pageNo":1,"pageSize":20}}
     */
    @GetMapping
    public String getStore(CommonPageParam queryIn) {
        // Service 公共分页结果 → 原样 JSON 序列化。
        return JsonUtils.toJsonIgnoreNull(service.getStore(queryIn));
    }

    /**
     * 查询类型详情。
     *
     * @param id URL 中的数据库主键，例如 {@code 1}
     * @return 详情 JSON，例如
     *     {@code {"success":true,"data":{"id":1,"resourceCode":"resource-kind"},"msg":"类型详情查询完成。"}}
     */
    @GetMapping("/{id}")
    public String getById(@PathVariable("id") long id) {
        // URL 主键 → Service 完整详情结果 → 原样 JSON。
        return JsonUtils.toJsonIgnoreNull(service.getById(id));
    }

    /**
     * 新增引用数据类型。
     *
     * @param saveIn 表单参数，例如
     *     {@code projectCode=cms&resourceCode=article-category&nameZh=文章分类&status=1}
     * @return 新增 JSON，例如
     *     {@code {"success":true,"data":{"id":2,"projectCode":"cms"},"affectedRows":1,"msg":"类型新增完成。"}}
     */
    @PostMapping
    public String insert(CommonParam saveIn) {
        // 前端表单动态字段 → Service 新增结果 → 原样 JSON。
        return JsonUtils.toJsonIgnoreNull(service.insert(saveIn));
    }

    /**
     * 更新引用数据类型。
     *
     * @param id URL 中的数据库主键，例如 {@code 2}
     * @param saveIn 表单最新字段，例如 {@code nameZh=内容分类&status=2}
     * @return 更新 JSON，例如
     *     {@code {"success":true,"data":{"id":2,"status":2},"affectedRows":1,"msg":"类型更新完成。"}}
     */
    @PostMapping("/{id}")
    public String update(@PathVariable("id") long id, CommonParam saveIn) {
        // URL 主键和表单字段 → Service 更新结果 → 原样 JSON。
        return JsonUtils.toJsonIgnoreNull(service.update(id, saveIn));
    }

    /**
     * 逻辑删除引用数据类型。
     *
     * @param id URL 中的数据库主键，例如 {@code 2}
     * @return 删除 JSON，例如
     *     {@code {"success":true,"data":{"id":2,"status":0},"affectedRows":1,"msg":"类型删除完成。"}}
     */
    @PostMapping("/{id}/delete")
    public String delete(@PathVariable("id") long id) {
        // URL 主键 → Service 逻辑删除结果 → 原样 JSON。
        return JsonUtils.toJsonIgnoreNull(service.delete(id));
    }
}
