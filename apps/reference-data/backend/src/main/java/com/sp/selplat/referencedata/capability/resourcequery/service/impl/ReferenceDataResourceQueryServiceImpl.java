package com.sp.selplat.referencedata.capability.resourcequery.service.impl;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.capability.resourcequery.service.ReferenceDataResourceQueryService;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import com.sp.selplat.referencedata.referencedatatype.service.ReferenceDataTypeService;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 只编排两个表业务 Service，不跨表访问 DAO，也不建立第二套持久化逻辑。 */
@Service
public class ReferenceDataResourceQueryServiceImpl implements ReferenceDataResourceQueryService {

    private final ReferenceDataTypeService typeService;
    private final ReferenceDataTreeNodeService treeNodeService;

    /**
     * 创建 code 资源查询编排服务。
     * 真实传参示例：Spring 注入 TypeService 与 TreeNodeService 的事务代理。
     * 真实返回示例：返回可同时查询类型元数据与节点表现的无状态服务实例。
     * 异常或副作用示例：依赖缺失时 Spring 启动失败；构造过程不访问数据库。
     *
     * @param typeService 类型表业务服务
     * @param treeNodeService 树节点表业务服务
     */
    public ReferenceDataResourceQueryServiceImpl(
            ReferenceDataTypeService typeService,
            ReferenceDataTreeNodeService treeNodeService) {
        this.typeService = typeService;
        this.treeNodeService = treeNodeService;
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getType(String typeCode) {
        return typeService.getTypeByCode(typeCode);
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getNodes(String typeCode, Map<String, String> parameters) {
        return treeNodeService.getNodes(typeCode, parameters);
    }
}
