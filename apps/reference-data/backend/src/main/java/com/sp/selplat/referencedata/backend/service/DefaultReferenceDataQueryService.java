package com.sp.selplat.referencedata.backend.service;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
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
        // 逻辑资源查询 → 数据所属项目 Provider。
        ReferenceDataProvider provider = providerRegistry.getProvider(requiredQuery(query));
        try {
            // Provider 原始根节点 → 拒绝 null 并冻结为跨项目不可变列表。
            List<TreeNode> nodes = Objects.requireNonNull(
                    provider.loadTree(query), "ReferenceDataProvider.loadTree 不得返回 null。");
            return List.copyOf(nodes);
        } catch (CommonBusinessException | CommonSystemException exception) {
            // Provider 已按公共异常契约表达失败 → 保留稳定编码和原始 cause。
            throw exception;
        } catch (RuntimeException exception) {
            // Provider 未包装的技术失败 → 统一转换为安全系统异常，禁止暴露实现细节。
            throw providerFailure(exception);
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public List<TypeOption> getOptions(ReferenceDataQuery query) {
        // 逻辑资源查询 → 数据所属项目 Provider。
        ReferenceDataProvider provider = providerRegistry.getProvider(requiredQuery(query));
        try {
            // Provider 原始选项 → 拒绝 null 并冻结为跨项目不可变列表。
            List<TypeOption> options = Objects.requireNonNull(
                    provider.loadOptions(query), "ReferenceDataProvider.loadOptions 不得返回 null。");
            return List.copyOf(options);
        } catch (CommonBusinessException | CommonSystemException exception) {
            // Provider 已按公共异常契约表达失败 → 保留稳定编码和原始 cause。
            throw exception;
        } catch (RuntimeException exception) {
            // Provider 未包装的技术失败 → 统一转换为安全系统异常，禁止暴露实现细节。
            throw providerFailure(exception);
        }
    }

    /**
     * 校验内部调用方必须提供完整查询对象。
     *
     * @param query 业务 Service 传入的查询，例如
     *     {@code {projectCode:"reference-data",resourceCode:"resource-kind"}}
     * @return 原查询对象，例如 {@code ReferenceDataQuery("reference-data", "resource-kind", null, {})}
     * @throws CommonBusinessException 当查询为空时抛出，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_QUERY_REQUIRED", "引用数据查询不能为空。")}
     */
    private ReferenceDataQuery requiredQuery(ReferenceDataQuery query) {
        if (query == null) {
            // 空查询无法确定 Provider → 可安全展示的调用参数错误。
            throw new CommonBusinessException("REFERENCE_DATA_QUERY_REQUIRED", "引用数据查询不能为空。");
        }
        // 已完成构造校验的查询 → 继续用于 Provider 路由和参数透传。
        return query;
    }

    /**
     * 将 Provider 未处理的运行时异常包装成公共系统异常。
     *
     * @param cause Provider 读取数据时产生的原始异常，例如 {@code NullPointerException("loadTree result")}
     * @return 带安全提示并保留 cause 的系统异常，例如
     *     {@code CommonSystemException("REFERENCE_DATA_PROVIDER_FAILED", "引用数据读取失败，请稍后重试。", cause)}
     */
    private CommonSystemException providerFailure(RuntimeException cause) {
        // 原始 Provider 故障 → 对外安全提示与服务端可追踪 cause 链。
        return new CommonSystemException(
                "REFERENCE_DATA_PROVIDER_FAILED",
                "引用数据读取失败，请稍后重试。",
                cause);
    }
}
