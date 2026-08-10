package com.sp.selplat.referencedata.referencedatatreenode.dao;

import java.util.List;
import java.util.Map;

/** 负责从 ReferenceDataTreeNode 表读取一个已登记资源的启用节点。 */
public interface ReferenceDataTreeNodeDao {

    /**
     * 按项目与资源坐标查询已排序树节点。
     *
     * @param projectCode 类型所属项目，例如 {@code "reference-data"}
     * @param resourceCode 项目内资源编码，例如 {@code "resource-kind"}
     * @return 平铺节点，例如 {@code [{nodeCode:"resource-kind-root",parentCode:null,nodeValue:"ALL"}]}
     */
    List<Map<String, Object>> findEnabledNodes(String projectCode, String resourceCode);
}
