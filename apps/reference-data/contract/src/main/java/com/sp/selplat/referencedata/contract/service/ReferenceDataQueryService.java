package com.sp.selplat.referencedata.contract.service;

import com.sp.selplat.referencedata.contract.model.ReferenceDataQuery;
import com.sp.selplat.referencedata.contract.model.TreeNode;
import com.sp.selplat.referencedata.contract.model.TypeOption;
import java.util.List;

/**
 * 定义同一 platform-runtime 内跨项目查询通用树和类型列表的公开 Service 契约。
 * 调用方只依赖本接口；Provider 路由、数据库访问、缓存和未来 HTTP 适配均由 backend 实现。
 */
public interface ReferenceDataQueryService {

    /**
     * 查询一个已登记资源的完整树结构。
     *
     * @param query 业务 Service 提供的逻辑资源坐标，例如
     *     {@code {projectCode:"uniauth",resourceCode:"department",tenantId:"10001"}}
     * @return 已排序的根节点列表，例如
     *     {@code [{id:"department-root",label:"全部部门",value:"root",children:[]}]}
     * @throws IllegalArgumentException 当资源未登记或重复登记时抛出，例如
     *     {@code IllegalArgumentException("未登记引用数据资源：uniauth/department")}
     */
    List<TreeNode> getTree(ReferenceDataQuery query);

    /**
     * 查询一个已登记资源的类型选项。
     *
     * @param query 业务 Service 提供的逻辑资源坐标，例如
     *     {@code {projectCode:"uniauth",resourceCode:"user-status",tenantId:"10001"}}
     * @return 已排序类型列表，例如
     *     {@code [{value:"ACTIVE",label:"有效",sortOrder:10,disabled:false}]}
     * @throws IllegalArgumentException 当资源未登记或重复登记时抛出，例如
     *     {@code IllegalArgumentException("未登记引用数据资源：uniauth/user-status")}
     */
    List<TypeOption> getOptions(ReferenceDataQuery query);
}
