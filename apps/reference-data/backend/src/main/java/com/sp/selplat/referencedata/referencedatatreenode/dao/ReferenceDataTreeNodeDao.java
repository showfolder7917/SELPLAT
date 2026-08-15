package com.sp.selplat.referencedata.referencedatatreenode.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.List;
import java.util.Map;

/** 负责从 ReferenceDataTreeNode 表读取一个已登记资源的启用节点。 */
public interface ReferenceDataTreeNodeDao extends BaseDao {

    Map<String, Object> findTypeById(long typeId);

    /**
     * 按类型唯一 code 查询已排序树节点。
     *
     * @param typeCode ReferenceDataType 唯一 code，例如 {@code "type101001"}
     * @return 平铺节点，例如 {@code [{nodeCode:"resource-kind-root",parentCode:null,nodeValue:"ALL"}]}
     */
    List<Map<String, Object>> findEnabledNodes(String typeCode);
}
