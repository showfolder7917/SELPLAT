package com.sp.selplat.referencedata.backend.provider;

import com.sp.selplat.referencedata.contract.model.ReferenceDataQuery;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 在 platform-runtime 启动时登记全部 ReferenceDataProvider，并按项目和资源编码提供唯一查询入口。
 * 重复资源在启动阶段直接失败，未登记资源在调用阶段明确失败，避免错误地返回空树或空类型列表。
 */
@Component
public class ReferenceDataProviderRegistry {

    // 稳定逻辑坐标 → 唯一 Provider，供每次树和类型查询直接定位数据所有者。
    private final Map<ResourceKey, ReferenceDataProvider> providerByResource;

    /**
     * 根据 Spring 当前发现的 Provider 建立不可变注册表。
     *
     * @param providers 各业务项目注册的 Provider，例如
     *     {@code [UniauthDepartmentReferenceDataProvider]}
     * @throws IllegalStateException 当两个 Provider 使用同一逻辑坐标时抛出，例如
     *     {@code IllegalStateException("重复登记引用数据资源：uniauth/department")}
     */
    public ReferenceDataProviderRegistry(List<ReferenceDataProvider> providers) {
        Map<ResourceKey, ReferenceDataProvider> registrations = new LinkedHashMap<>();
        // Spring Provider 列表 → 逐项校验并形成唯一逻辑资源注册表。
        for (ReferenceDataProvider provider : providers) {
            ReferenceDataQuery coordinate = new ReferenceDataQuery(
                    provider.getProjectCode(), provider.getResourceCode(), null, Map.of());
            ResourceKey key = new ResourceKey(coordinate.projectCode(), coordinate.resourceCode());
            if (registrations.putIfAbsent(key, provider) != null) {
                throw new IllegalStateException("重复登记引用数据资源：" + key.display());
            }
        }
        providerByResource = Map.copyOf(registrations);
    }

    /**
     * 返回查询逻辑坐标对应的唯一 Provider。
     *
     * @param query 业务调用方提交的逻辑资源查询，例如
     *     {@code {projectCode:"uniauth",resourceCode:"department"}}
     * @return 已登记 Provider，例如 {@code UniauthDepartmentReferenceDataProvider}
     * @throws IllegalArgumentException 当资源尚未登记时抛出，例如
     *     {@code IllegalArgumentException("未登记引用数据资源：uniauth/department")}
     */
    public ReferenceDataProvider getProvider(ReferenceDataQuery query) {
        ResourceKey key = new ResourceKey(query.projectCode(), query.resourceCode());
        ReferenceDataProvider provider = providerByResource.get(key);
        if (provider == null) {
            throw new IllegalArgumentException("未登记引用数据资源：" + key.display());
        }
        return provider;
    }

    private record ResourceKey(String projectCode, String resourceCode) {

        private String display() {
            return projectCode + "/" + resourceCode;
        }
    }
}
