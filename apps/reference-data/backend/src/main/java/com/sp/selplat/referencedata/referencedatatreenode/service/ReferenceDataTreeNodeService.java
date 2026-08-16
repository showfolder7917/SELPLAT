package com.sp.selplat.referencedata.referencedatatreenode.service;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.service.BaseService;
import java.util.Map;

/** 声明 ReferenceDataTreeNode 表的树查询业务。 */
public interface ReferenceDataTreeNodeService extends BaseService {

    /**
     * 按根节点唯一 code 查询一棵独立父子树。
     * 真实传参示例：{@code rootCode=treeNode101007, locale=zh-CN}。
     * 真实返回示例：返回 {@code {"success":true,"data":{"id":"treeNode101007","children":[]}}}。
     * 异常或副作用示例：根 code 不存在时抛出
     *     {@code REFERENCE_DATA_TREE_ROOT_NOT_FOUND}；方法不修改数据库。
     *
     * @param rootCode ReferenceDataTreeNode 根节点的唯一 code
     * @param parameters locale 等查询参数
     * @return TREE 类型的层级节点结果
     */
    CommonResult getNodes(String rootCode, Map<String, String> parameters);
}
