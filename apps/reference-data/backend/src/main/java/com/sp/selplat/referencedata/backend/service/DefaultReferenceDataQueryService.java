package com.sp.selplat.referencedata.backend.service;

import com.sp.selplat.referencedata.backend.provider.ReferenceDataProvider;
import com.sp.selplat.referencedata.backend.provider.ReferenceDataProviderRegistry;
import com.sp.selplat.referencedata.contract.model.ReferenceDataQuery;
import com.sp.selplat.referencedata.contract.model.TreeNode;
import com.sp.selplat.referencedata.contract.model.TypeOption;
import com.sp.selplat.referencedata.contract.service.ReferenceDataQueryService;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

/**
 * 实现 platform-runtime 内部的引用数据查询入口。
 * 本类只选择已登记 Provider 并冻结返回集合，不访问其他项目 DAO，也不解释物理表结构。
 */
@Service
public class DefaultReferenceDataQueryService implements ReferenceDataQueryService {

    // Provider 注册表 → 每次查询的唯一项目资源路由入口。
    private final ReferenceDataProviderRegistry providerRegistry;

    /**
     * 创建引用数据查询 Service。
     *
     * @param providerRegistry platform-runtime 启动时形成的 Provider 注册表，例如包含
     *     {@code uniauth/department}
     */
    public DefaultReferenceDataQueryService(ReferenceDataProviderRegistry providerRegistry) {
        this.providerRegistry = providerRegistry;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public List<TreeNode> getTree(ReferenceDataQuery query) {
        // 逻辑资源查询 → 数据所属项目 Provider → 不可变根节点列表。
        ReferenceDataProvider provider = providerRegistry.getProvider(query);
        List<TreeNode> nodes = Objects.requireNonNull(
                provider.loadTree(query), "ReferenceDataProvider.loadTree 不得返回 null。");
        return List.copyOf(nodes);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public List<TypeOption> getOptions(ReferenceDataQuery query) {
        // 逻辑资源查询 → 数据所属项目 Provider → 不可变类型选项列表。
        ReferenceDataProvider provider = providerRegistry.getProvider(query);
        List<TypeOption> options = Objects.requireNonNull(
                provider.loadOptions(query), "ReferenceDataProvider.loadOptions 不得返回 null。");
        return List.copyOf(options);
    }
}
