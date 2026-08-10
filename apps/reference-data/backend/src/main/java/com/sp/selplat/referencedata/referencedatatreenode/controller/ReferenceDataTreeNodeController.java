package com.sp.selplat.referencedata.referencedatatreenode.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
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
}
