package com.sp.selplat.referencedata.referencedatacontextmenuitem.service;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.service.BaseService;
import java.util.Map;

/** 声明 ReferenceDataContextMenuItem 表的多级右键菜单查询业务。 */
public interface ReferenceDataContextMenuItemService extends BaseService {

    /**
     * 查询一个资源的多级右键菜单。
     *
     * @param projectCode URL 项目编码，例如 {@code "reference-data"}
     * @param resourceCode URL 资源编码，例如 {@code "resource-kind"}
     * @param parameters URL 参数，例如 {@code {"locale":"zh-CN"}}
     * @return 菜单结果，例如 {@code {"success":true,"data":[{"code":"create","children":[]}]}}
     */
    CommonResult getContextMenu(String projectCode, String resourceCode, Map<String, String> parameters);
}
