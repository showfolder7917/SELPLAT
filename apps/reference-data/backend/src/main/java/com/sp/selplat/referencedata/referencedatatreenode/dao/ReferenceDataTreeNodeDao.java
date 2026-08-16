package com.sp.selplat.referencedata.referencedatatreenode.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.List;
import java.util.Map;

/** 负责读取完全独立的 ReferenceDataTreeNode 树节点。 */
public interface ReferenceDataTreeNodeDao extends BaseDao {

    /**
     * 读取全部启用节点，供业务层按根节点 code 截取一棵树。
     * 真实传参示例：无参数。
     * 真实返回示例：{@code [{id:101007,code:"treeNode101007",parentId:null}]}。
     * 异常或副作用示例：没有启用节点时返回空列表；方法不修改数据库。
     *
     * @return 按父节点、排序值稳定输出的平铺节点
     */
    List<Map<String, Object>> findEnabledNodes();
}
