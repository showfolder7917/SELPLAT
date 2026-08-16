package com.sp.selplat.referencedata.referencedatatreenode.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.util.CommonPageResult;
import java.util.List;
import java.util.Map;

/** 负责读取完全独立的 ReferenceDataTreeNode 树节点。 */
public interface ReferenceDataTreeNodeDao extends BaseDao {

    /**
     * 分页读取树节点，不依赖类型目录或其他业务表。
     * 真实传参示例：关键词 {@code 阅读}、状态 {@code 1}、第一页 20 条。
     * 真实返回示例：{@code {records:[{code:"treeNode101007",nodeValue:"ROOT"}],totalCount:1}}。
     * 异常或副作用示例：没有树节点时返回空分页；方法不修改数据库。
     *
     * @param keyword 节点 code 或父节点 id 关键词
     * @param status 可选启停状态
     * @param pageNo 一基页码
     * @param pageSize 每页条数
     * @return 独立树节点分页结果
     */
    CommonPageResult findTreePage(String keyword, Integer status, int pageNo, int pageSize);

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
