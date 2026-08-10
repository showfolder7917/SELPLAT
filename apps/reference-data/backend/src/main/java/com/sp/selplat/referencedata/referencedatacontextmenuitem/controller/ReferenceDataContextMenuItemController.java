package com.sp.selplat.referencedata.referencedatacontextmenuitem.controller;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.referencedata.referencedatacontextmenuitem.service.ReferenceDataContextMenuItemService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
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
}
