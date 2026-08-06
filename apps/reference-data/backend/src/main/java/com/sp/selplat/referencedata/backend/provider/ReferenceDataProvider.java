package com.sp.selplat.referencedata.backend.provider;

import com.sp.selplat.referencedata.contract.model.ReferenceDataQuery;
import com.sp.selplat.referencedata.contract.model.TreeNode;
import com.sp.selplat.referencedata.contract.model.TypeOption;
import java.util.List;

/**
 * 定义数据所属项目向 reference-data 注册一个逻辑资源的扩展点。
 * Provider 负责自己的数据库和业务规则，reference-data 只按逻辑坐标完成路由。
 */
public interface ReferenceDataProvider {

    /**
     * 返回资源所属项目编码。
     *
     * @return 稳定项目编码，例如 {@code "uniauth"}
     */
    String getProjectCode();

    /**
     * 返回项目内资源编码。
     *
     * @return 稳定资源编码，例如 {@code "department"}
     */
    String getResourceCode();

    /**
     * 从资源所属项目加载完整树结构。
     *
     * @param query reference-data 透传的租户和过滤参数，例如
     *     {@code {projectCode:"uniauth",resourceCode:"department",tenantId:"10001"}}
     * @return 根节点列表，例如
     *     {@code [{id:"root",label:"全部部门",value:"root",children:[]}]}
     */
    List<TreeNode> loadTree(ReferenceDataQuery query);

    /**
     * 从资源所属项目加载类型选项。
     *
     * @param query reference-data 透传的租户和过滤参数，例如
     *     {@code {projectCode:"uniauth",resourceCode:"user-status",tenantId:"10001"}}
     * @return 类型列表，例如
     *     {@code [{value:"ACTIVE",label:"有效",sortOrder:10,disabled:false}]}
     */
    List<TypeOption> loadOptions(ReferenceDataQuery query);
}
