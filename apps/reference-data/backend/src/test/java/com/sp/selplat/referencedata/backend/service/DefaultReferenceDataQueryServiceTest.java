package com.sp.selplat.referencedata.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

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

    @Test
    void shouldRouteTreeAndOptionsToRegisteredProvider() {
        ReferenceDataQuery query = new ReferenceDataQuery("uniauth", "department", "10001", Map.of());
        DefaultReferenceDataQueryService service = new DefaultReferenceDataQueryService(
                new ReferenceDataProviderRegistry(List.of(new DepartmentProvider())));

        assertEquals("全部部门", service.getTree(query).getFirst().label());
        assertEquals("有效", service.getOptions(query).getFirst().label());
    }

    @Test
    void shouldRejectMissingAndDuplicateProviders() {
        ReferenceDataQuery query = new ReferenceDataQuery("uniauth", "department", null, Map.of());
        DefaultReferenceDataQueryService emptyService = new DefaultReferenceDataQueryService(
                new ReferenceDataProviderRegistry(List.of()));

        IllegalArgumentException missing = assertThrows(
                IllegalArgumentException.class, () -> emptyService.getTree(query));
        assertEquals("未登记引用数据资源：uniauth/department", missing.getMessage());

        IllegalStateException duplicate = assertThrows(
                IllegalStateException.class,
                () -> new ReferenceDataProviderRegistry(List.of(new DepartmentProvider(), new DepartmentProvider())));
        assertEquals("重复登记引用数据资源：uniauth/department", duplicate.getMessage());
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
}
