package com.sp.selplat.referencedata.referencedatatreenode.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 发布 ReferenceDataTreeNode 表对应的树查询接口。 */
@RestController
@ModuleDescription(code = "reference-data-tree-node", name = "引用数据树节点", description = "查询数据库树节点")
@RequestMapping("/api/reference-data")
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
     * 查询数据库中的完整树。
     *
     * @param projectCode 项目编码，例如 {@code "reference-data"}
     * @param resourceCode 资源编码，例如 {@code "resource-kind"}
     * @param parameters 查询参数，例如 {@code {"locale":"zh-CN"}}
     * @return 树 JSON，例如 {@code {"success":true,"data":[{"id":"resource-kind-root"}]}}
     */
    @GetMapping(value = "/{projectCode}/{resourceCode}/tree", produces = MediaType.APPLICATION_JSON_VALUE)
    public String tree(
            @PathVariable("projectCode") String projectCode,
            @PathVariable("resourceCode") String resourceCode,
            @RequestParam Map<String, String> parameters) {
        return JsonUtils.toJsonIgnoreNull(service.getTree(projectCode, resourceCode, parameters));
    }

    /**
     * 分页查询树节点管理记录。
     *
     * @param queryIn 页码、容量和字段条件，例如 {@code {"pageNo":1,"pageSize":100,"typeId":1}}
     * @return 分页 JSON，例如 {@code {"records":[{"nodeCode":"root"}],"totalCount":1}}
     */
    @GetMapping(value = "/admin/tree-nodes/getStore.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getStore(CommonPageParam queryIn) {
        return JsonUtils.toJsonIgnoreNull(service.getStore(queryIn));
    }

    /**
     * 返回树节点管理表格的配置列或字段名后备列。
     *
     * @param viewCode 页面表格实例标识，例如 {@code "selGridTreeNodeManagementId"}
     * @param locale 当前语言，例如 {@code "zh-CN"}
     * @return Grid 列 JSON，例如 {@code {"success":true,"data":{"columns":[{"field":"nodeCode"}]}}}
     */
    @GetMapping(value = "/admin/tree-nodes/getGridColumn.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getGridColumn(
            @RequestParam(name = "viewCode", defaultValue = "default") String viewCode,
            @RequestParam(name = "locale", defaultValue = "zh-CN") String locale) {
        return JsonUtils.toJsonIgnoreNull(service.getGridColumn(viewCode, locale));
    }

    /**
     * 新增一条树节点记录。
     *
     * @param saveIn 树节点字段，例如 {@code {"typeId":1,"nodeCode":"root","nodeValue":"ROOT","labelZh":"根节点"}}
     * @return 新增结果，例如 {@code {"success":true,"data":{"id":101000}}}
     * 异常或副作用示例：唯一编码或父节点外键冲突时事务回滚并返回统一业务错误。
     */
    @PostMapping(value = "/admin/tree-nodes/create.htm", produces = MediaType.APPLICATION_JSON_VALUE)
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
    @PostMapping(value = "/admin/tree-nodes/update.htm", produces = MediaType.APPLICATION_JSON_VALUE)
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
    @PostMapping(value = "/admin/tree-nodes/delete.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String delete(CommonParam deleteIn) {
        return JsonUtils.toJsonIgnoreNull(service.delete(deleteIn));
    }
}
