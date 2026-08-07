package com.sp.selplat.referencedata.contract.service;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
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
     * @throws CommonBusinessException 当资源未登记时抛出，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_RESOURCE_NOT_FOUND", "未登记引用数据资源：uniauth/department")}
     * @throws CommonSystemException 当 Provider 返回空集合或执行失败时抛出，例如
     *     {@code CommonSystemException("REFERENCE_DATA_PROVIDER_FAILED", "引用数据读取失败，请稍后重试。", cause)}
     */
    List<TreeNode> getTree(ReferenceDataQuery query);

    /**
     * 查询一个已登记资源的类型选项。
     *
     * @param query 业务 Service 提供的逻辑资源坐标，例如
     *     {@code {projectCode:"uniauth",resourceCode:"user-status",tenantId:"10001"}}
     * @return 已排序类型列表，例如
     *     {@code [{value:"ACTIVE",label:"有效",sortOrder:10,disabled:false}]}
     * @throws CommonBusinessException 当资源未登记时抛出，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_RESOURCE_NOT_FOUND", "未登记引用数据资源：uniauth/user-status")}
     * @throws CommonSystemException 当 Provider 返回空集合或执行失败时抛出，例如
     *     {@code CommonSystemException("REFERENCE_DATA_PROVIDER_FAILED", "引用数据读取失败，请稍后重试。", cause)}
     */
    List<TypeOption> getOptions(ReferenceDataQuery query);
}
