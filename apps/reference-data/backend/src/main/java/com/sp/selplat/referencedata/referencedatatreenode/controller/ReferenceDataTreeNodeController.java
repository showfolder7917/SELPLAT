package com.sp.selplat.referencedata.referencedatatreenode.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 发布 ReferenceDataTreeNode 表对应的树查询接口。 */
@RestController
@ModuleDescription(code = "reference-data-tree-node", name = "引用数据树节点", description = "查询数据库树节点")
@RequestMapping("/api/reference-data/admin/tree-nodes")
public class ReferenceDataTreeNodeController {

    private final ReferenceDataTreeNodeService service;

    /**
     * 创建树节点 Controller。
     *
     * @param service ReferenceDataTreeNode 表 Service，例如 {@code ReferenceDataTreeNodeServiceImpl}
     */
    public ReferenceDataTreeNodeController(ReferenceDataTreeNodeService service) {
        this.service = service;
    }

    /**
     * 分页查询树节点管理记录。
     *
     * @param queryIn 页码、容量和字段条件，例如 {@code {"pageNo":1,"pageSize":100,"status":1}}
     * @return 分页 JSON，例如 {@code {"records":[{"code":"treeNode101007"}],"totalCount":1}}
     */
    @GetMapping(value = "/getStore.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getStore(CommonPageParam queryIn) {
        return JsonUtils.toJsonIgnoreNull(service.getStore(queryIn));
    }

    /**
     * 返回树节点管理表格的配置列或字段名后备列。
     * 真实传参示例：{@code tableCode=table101020&locale=zh-CN}。
     * 真实返回示例：返回 {@code {"tableCode":"table101020","columns":[{"field":"code"}]}}。
     * 异常或副作用示例：tableCode 为空时返回统一业务异常；方法不修改数据库。
     *
     * @param tableCode ReferenceDataTable 唯一 code，例如 {@code "table101020"}
     * @param locale 当前语言，例如 {@code "zh-CN"}
     * @return 使用 tableCode 坐标的 Grid 列 JSON
     */
    @GetMapping(value = "/getGridColumn.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getGridColumn(
            @RequestParam(name = "tableCode") String tableCode,
            @RequestParam(name = "locale", defaultValue = "zh-CN") String locale) {
        CommonResult result = service.getGridColumn(tableCode, locale);
        if (result.getData() instanceof Map<?, ?> original) {
            Map<String, Object> data = new LinkedHashMap<>();
            original.forEach((key, value) -> data.put(String.valueOf(key), value));
            data.remove("viewCode");
            data.put("tableCode", tableCode);
            result.setData(data);
        }
        return JsonUtils.toJsonIgnoreNull(result);
    }

    /**
     * 新增一条树节点记录。
     *
     * @param saveIn 树节点字段，例如
     *     {@code {"projectCode":"reference-data","pageCode":"page101017","parentId":1,"nodeValue":"READING","labelZh":"阅读"}}
     * @return 新增结果，例如 {@code {"success":true,"data":{"id":101000}}}
     * 异常或副作用示例：唯一编码或父节点外键冲突时事务回滚并返回统一业务错误。
     */
    @PostMapping(value = "/create.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String create(CommonParam saveIn) {
        return JsonUtils.toJsonIgnoreNull(service.insert(saveIn));
    }

    /**
     * 更新一条树节点记录。
     *
     * @param saveIn 主键和待更新字段，例如 {@code {"id":101000,"labelZh":"新名称"}}
     * @return 更新结果，例如 {@code {"success":true,"data":{"id":101000}}}
     * 异常或副作用示例：主键不存在或字段违反数据库约束时不产生部分更新。
     */
    @PostMapping(value = "/update.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String update(CommonParam saveIn) {
        return JsonUtils.toJsonIgnoreNull(service.update(saveIn));
    }

    /**
     * 假删除一条树节点记录。
     *
     * @param deleteIn 主键参数，例如 {@code {"id":101000}}
     * @return 删除结果，例如 {@code {"success":true,"data":{"id":101000,"status":0}}}
     * 异常或副作用示例：存在子节点或外键保护时数据库拒绝危险删除。
     */
    @PostMapping(value = "/delete.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String delete(CommonParam deleteIn) {
        return JsonUtils.toJsonIgnoreNull(service.delete(deleteIn));
    }
}
