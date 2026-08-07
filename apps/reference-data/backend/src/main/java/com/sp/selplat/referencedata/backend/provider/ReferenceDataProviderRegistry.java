package com.sp.selplat.referencedata.backend.provider;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
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
     * @throws CommonSystemException 当 Provider 坐标无效或重复时抛出，例如
     *     {@code CommonSystemException("REFERENCE_DATA_DUPLICATE_RESOURCE", "重复登记引用数据资源：uniauth/department", cause)}
     */
    public ReferenceDataProviderRegistry(List<ReferenceDataProvider> providers) {
        Map<ResourceKey, ReferenceDataProvider> registrations = new LinkedHashMap<>();
        // Spring Provider 列表 → 逐项校验并形成唯一逻辑资源注册表。
        for (ReferenceDataProvider provider : providers) {
            // Provider 声明坐标 → 经过公共查询契约归一化后的注册表键。
            ResourceKey key = registrationKey(provider);
            if (registrations.putIfAbsent(key, provider) != null) {
                // 重复项目/资源坐标 → 阻断 Host 启动，避免运行时随机选择数据来源。
                IllegalStateException cause = new IllegalStateException("重复登记引用数据资源：" + key.display());
                throw new CommonSystemException(
                        "REFERENCE_DATA_DUPLICATE_RESOURCE",
                        "重复登记引用数据资源：" + key.display(),
                        cause);
            }
        }
        // 启动期登记结果 → 后续查询只读的不可变 Provider 路由表。
        providerByResource = Map.copyOf(registrations);
    }

    /**
     * 返回查询逻辑坐标对应的唯一 Provider。
     *
     * @param query 业务调用方提交的逻辑资源查询，例如
     *     {@code {projectCode:"uniauth",resourceCode:"department"}}
     * @return 已登记 Provider，例如 {@code UniauthDepartmentReferenceDataProvider}
     * @throws CommonBusinessException 当资源尚未登记时抛出，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_RESOURCE_NOT_FOUND", "未登记引用数据资源：uniauth/department")}
     */
    public ReferenceDataProvider getProvider(ReferenceDataQuery query) {
        ResourceKey key = new ResourceKey(query.projectCode(), query.resourceCode());
        ReferenceDataProvider provider = providerByResource.get(key);
        if (provider == null) {
            // 未登记逻辑坐标 → 明确业务失败，禁止把配置错误伪装成空树或空选项。
            throw new CommonBusinessException(
                    "REFERENCE_DATA_RESOURCE_NOT_FOUND",
                    "未登记引用数据资源：" + key.display());
        }
        // 唯一注册项 → 返回数据所属项目的 Provider。
        return provider;
    }

    /**
     * 把一个 Provider 声明转换成经过公共契约校验的注册表键。
     *
     * @param provider Spring 扫描到的业务 Provider，例如 {@code BuiltInResourceKindProvider}
     * @return 唯一逻辑坐标，例如 {@code ResourceKey("reference-data", "resource-kind")}
     * @throws CommonSystemException 当 Provider 为空或坐标缺失时抛出，例如
     *     {@code CommonSystemException("REFERENCE_DATA_PROVIDER_CONFIGURATION_INVALID", "引用数据 Provider 配置无效。", cause)}
     */
    private ResourceKey registrationKey(ReferenceDataProvider provider) {
        try {
            // Provider 声明 → 复用 ReferenceDataQuery 的坐标去空格和必填校验。
            ReferenceDataQuery coordinate = new ReferenceDataQuery(
                    provider.getProjectCode(), provider.getResourceCode(), null, Map.of());
            // 已归一化查询坐标 → 注册表不可变键。
            return new ResourceKey(coordinate.projectCode(), coordinate.resourceCode());
        } catch (RuntimeException exception) {
            // Provider 自身配置错误 → 系统异常保留原始原因，避免误判成调用方业务错误。
            throw new CommonSystemException(
                    "REFERENCE_DATA_PROVIDER_CONFIGURATION_INVALID",
                    "引用数据 Provider 配置无效。",
                    exception);
        }
    }

    private record ResourceKey(String projectCode, String resourceCode) {

        private String display() {
            return projectCode + "/" + resourceCode;
        }
    }
}
