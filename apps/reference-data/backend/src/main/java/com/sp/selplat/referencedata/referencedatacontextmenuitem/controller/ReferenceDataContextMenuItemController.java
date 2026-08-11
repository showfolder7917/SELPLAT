package com.sp.selplat.referencedata.referencedatacontextmenuitem.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedatacontextmenuitem.service.ReferenceDataContextMenuItemService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 发布 ReferenceDataContextMenuItem 表对应的多级右键菜单查询接口。 */
@RestController
@ModuleDescription(code = "reference-data-context-menu-item", name = "引用数据右键菜单项", description = "查询数据库右键菜单")
@RequestMapping("/api/reference-data")
public class ReferenceDataContextMenuItemController {

    private final ReferenceDataContextMenuItemService service;

    /**
     * 创建右键菜单项 Controller。
     *
     * @param service ReferenceDataContextMenuItem 表 Service，例如 {@code ReferenceDataContextMenuItemServiceImpl}
     */
    public ReferenceDataContextMenuItemController(ReferenceDataContextMenuItemService service) {
        this.service = service;
    }

    /**
     * 查询数据库中的多级右键菜单。
     *
     * @param projectCode 项目编码，例如 {@code "reference-data"}
     * @param resourceCode 资源编码，例如 {@code "resource-kind"}
     * @param parameters 查询参数，例如 {@code {"locale":"zh-CN"}}
     * @return 菜单 JSON，例如 {@code {"success":true,"data":[{"code":"create","children":[]}]}}
     */
    @GetMapping(value = "/{projectCode}/{resourceCode}/context-menu", produces = MediaType.APPLICATION_JSON_VALUE)
    public String contextMenu(
            @PathVariable("projectCode") String projectCode,
            @PathVariable("resourceCode") String resourceCode,
            @RequestParam Map<String, String> parameters) {
        return JsonUtils.toJsonIgnoreNull(service.getContextMenu(projectCode, resourceCode, parameters));
    }

    /**
     * 分页查询菜单项管理记录。
     *
     * @param queryIn 页码、容量和字段条件，例如 {@code {"pageNo":1,"pageSize":100,"typeId":1}}
     * @return 分页 JSON，例如 {@code {"records":[{"itemCode":"create"}],"totalCount":1}}
     */
    @GetMapping(value = "/admin/context-menu-items/getStore.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String getStore(CommonPageParam queryIn) {
        return JsonUtils.toJsonIgnoreNull(service.getStore(queryIn));
    }

    /**
     * 新增一条菜单项。
     *
     * @param saveIn 菜单字段，例如 {@code {"typeId":1,"itemCode":"create","labelZh":"新建"}}
     * @return 新增结果，例如 {@code {"success":true,"data":{"id":100000}}}
     * 异常或副作用示例：同一类型菜单编码重复时数据库拒绝写入。
     */
    @PostMapping(value = "/admin/context-menu-items/create.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String create(CommonParam saveIn) {
        return JsonUtils.toJsonIgnoreNull(service.insert(saveIn));
    }

    /**
     * 更新一条菜单项。
     *
     * @param saveIn 主键和待更新字段，例如 {@code {"id":100000,"command":"CREATE"}}
     * @return 更新结果，例如 {@code {"success":true,"data":{"id":100000}}}
     * 异常或副作用示例：父菜单或所属类型外键无效时不产生部分更新。
     */
    @PostMapping(value = "/admin/context-menu-items/update.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String update(CommonParam saveIn) {
        return JsonUtils.toJsonIgnoreNull(service.update(saveIn));
    }

    /**
     * 假删除一条菜单项。
     *
     * @param deleteIn 主键参数，例如 {@code {"id":100000}}
     * @return 删除结果，例如 {@code {"success":true,"data":{"id":100000,"status":0}}}
     * 异常或副作用示例：菜单仍有子项时页面应先处理子项，数据库关系不会被物理删除。
     */
    @PostMapping(value = "/admin/context-menu-items/delete.htm", produces = MediaType.APPLICATION_JSON_VALUE)
    public String delete(CommonParam deleteIn) {
        return JsonUtils.toJsonIgnoreNull(service.delete(deleteIn));
    }
}
