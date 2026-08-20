package com.sp.selplat.referencedata.capability.resourcequery.service.impl;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.capability.resourcequery.service.ReferenceDataResourceQueryService;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import com.sp.selplat.referencedata.referencedatatype.service.ReferenceDataTypeService;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 分别编排类型目录与独立树 Service，不建立任何跨表依赖。 */
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
    public CommonResult getOptions(String optionSetCode, Map<String, String> parameters) {
        // 稳定选项组坐标 → 由类型表业务服务统一完成精确查询、状态过滤和多语言回退。
        return typeService.getOptionsByOptionSetCode(optionSetCode, parameters);
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getNodes(String rootCode, Map<String, String> parameters) {
        return treeNodeService.getNodes(rootCode, parameters);
    }
}
