package com.sp.selplat.referencedata.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.referencedata.backend.provider.ReferenceDataProvider;
import com.sp.selplat.referencedata.backend.provider.ReferenceDataProviderRegistry;
import com.sp.selplat.referencedata.contract.model.ReferenceDataQuery;
import com.sp.selplat.referencedata.contract.model.TreeNode;
import com.sp.selplat.referencedata.contract.model.TypeOption;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 验证引用数据 Service 的 Provider 成功路由、未登记资源和重复登记边界。
 */
class DefaultReferenceDataQueryServiceTest {

    /**
     * 验证树和类型查询均路由到相同逻辑坐标的唯一 Provider。
     *
     * 执行结果示例：{@code uniauth/department} 分别返回“全部部门”根节点和“有效”选项。
     */
    @Test
    void shouldRouteTreeAndOptionsToRegisteredProvider() {
        // 已登记逻辑坐标 → 真实测试 Provider 和查询 Service。
        ReferenceDataQuery query = new ReferenceDataQuery("uniauth", "department", "10001", Map.of());
        DefaultReferenceDataQueryService service = new DefaultReferenceDataQueryService(
                new ReferenceDataProviderRegistry(List.of(new DepartmentProvider())));

        // 同一坐标的两种表达 → Provider 返回的树和选项原值。
        assertEquals("全部部门", service.getTree(query).getFirst().label());
        assertEquals("有效", service.getOptions(query).getFirst().label());
    }

    /**
     * 验证未登记资源是业务失败，重复登记是阻断启动的系统配置失败。
     *
     * 执行结果示例：缺失资源返回 {@code REFERENCE_DATA_RESOURCE_NOT_FOUND}，
     * 重复资源返回 {@code REFERENCE_DATA_DUPLICATE_RESOURCE}。
     */
    @Test
    void shouldRejectMissingAndDuplicateProviders() {
        // 空注册表和有效查询 → 未登记资源业务异常。
        ReferenceDataQuery query = new ReferenceDataQuery("uniauth", "department", null, Map.of());
        DefaultReferenceDataQueryService emptyService = new DefaultReferenceDataQueryService(
                new ReferenceDataProviderRegistry(List.of()));

        CommonBusinessException missing = assertThrows(
                CommonBusinessException.class, () -> emptyService.getTree(query));
        assertEquals("REFERENCE_DATA_RESOURCE_NOT_FOUND", missing.getErrorCode());
        assertEquals("未登记引用数据资源：uniauth/department", missing.getMessage());

        // 两个相同坐标 Provider → Host 启动前即可识别的系统配置异常。
        CommonSystemException duplicate = assertThrows(
                CommonSystemException.class,
                () -> new ReferenceDataProviderRegistry(List.of(new DepartmentProvider(), new DepartmentProvider())));
        assertEquals("REFERENCE_DATA_DUPLICATE_RESOURCE", duplicate.getErrorCode());
        assertEquals("重复登记引用数据资源：uniauth/department", duplicate.getMessage());
    }

    /**
     * 验证 Provider 违反非空返回契约时被包装为安全系统异常并保留原始原因。
     *
     * 执行结果示例：loadTree 返回 null 时抛出
     * {@code REFERENCE_DATA_PROVIDER_FAILED/引用数据读取失败，请稍后重试。}。
     */
    @Test
    void shouldWrapInvalidProviderResultAsSystemFailure() {
        // 返回 null 的故障 Provider → Service 技术异常边界。
        DefaultReferenceDataQueryService service = new DefaultReferenceDataQueryService(
                new ReferenceDataProviderRegistry(List.of(new NullResultProvider())));
        ReferenceDataQuery query = new ReferenceDataQuery("broken", "null-result", null, Map.of());

        // Provider 契约故障 → 对外安全系统异常，cause 保留原始 NullPointerException。
        CommonSystemException exception = assertThrows(
                CommonSystemException.class, () -> service.getTree(query));
        assertEquals("REFERENCE_DATA_PROVIDER_FAILED", exception.getErrorCode());
        assertEquals("引用数据读取失败，请稍后重试。", exception.getMessage());
        assertEquals(NullPointerException.class, exception.getCause().getClass());
    }

    private static final class DepartmentProvider implements ReferenceDataProvider {

        @Override
        public String getProjectCode() {
            return "uniauth";
        }

        @Override
        public String getResourceCode() {
            return "department";
        }

        @Override
        public List<TreeNode> loadTree(ReferenceDataQuery query) {
            return List.of(new TreeNode("root", null, "全部部门", "root", List.of(), Map.of()));
        }

        @Override
        public List<TypeOption> loadOptions(ReferenceDataQuery query) {
            return List.of(new TypeOption("ACTIVE", "有效", "department-status", 10, false, Map.of()));
        }
    }

    /**
     * 测试 Provider 故意返回 null，用于验证生产 Service 的系统异常包装边界。
     */
    private static final class NullResultProvider implements ReferenceDataProvider {

        @Override
        public String getProjectCode() {
            return "broken";
        }

        @Override
        public String getResourceCode() {
            return "null-result";
        }

        @Override
        public List<TreeNode> loadTree(ReferenceDataQuery query) {
            return null;
        }

        @Override
        public List<TypeOption> loadOptions(ReferenceDataQuery query) {
            return null;
        }
    }
}
