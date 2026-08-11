package com.sp.selplat.referencedata.referencedatacontextmenuitem.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.List;
import java.util.Map;

/** 负责从 ReferenceDataContextMenuItem 表读取一个资源的启用菜单项。 */
public interface ReferenceDataContextMenuItemDao extends BaseDao {

    /**
     * 按项目与资源坐标查询已排序菜单项。
     *
     * @param projectCode 类型所属项目，例如 {@code "reference-data"}
     * @param resourceCode 项目内资源编码，例如 {@code "resource-kind"}
     * @return 平铺菜单，例如 {@code [{itemCode:"create",parentCode:null}]}
     */
    List<Map<String, Object>> findEnabledMenuItems(String projectCode, String resourceCode);
}
