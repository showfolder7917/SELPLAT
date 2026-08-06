package com.sp.selplat.referencedata.contract.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 验证跨项目契约对象不会被调用方在创建后继续修改。
 */
class ReferenceDataContractTest {

    @Test
    void shouldCreateImmutableQueryAndTreeNodeSnapshots() {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("status", 1);
        ReferenceDataQuery query = new ReferenceDataQuery(" uniauth ", " department ", "10001", parameters);
        parameters.put("status", 0);

        List<TreeNode> children = new ArrayList<>();
        TreeNode root = new TreeNode("root", null, "全部部门", "root", children, Map.of("status", 1));
        children.add(new TreeNode("child", "root", "研发部", "100", List.of(), Map.of()));

        assertEquals("uniauth", query.projectCode());
        assertEquals(1, query.parameters().get("status"));
        assertEquals(0, root.children().size());
        assertThrows(UnsupportedOperationException.class, () -> query.parameters().put("status", 2));
    }

    @Test
    void shouldRejectMissingLogicalResourceCoordinates() {
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> new ReferenceDataQuery(" ", "department", null, Map.of()));

        assertEquals("projectCode 不能为空。", exception.getMessage());
    }
}
