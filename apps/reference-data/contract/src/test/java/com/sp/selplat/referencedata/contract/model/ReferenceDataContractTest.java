package com.sp.selplat.referencedata.contract.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sp.selplat.common.exception.CommonBusinessException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * 验证跨项目契约对象不会被调用方在创建后继续修改。
 */
class ReferenceDataContractTest {

    /**
     * 验证外部可变参数和子节点集合不会在对象创建后改变公共查询快照。
     *
     * 执行结果示例：原参数从 {@code status=1} 改成 {@code status=0} 后，查询仍返回 {@code status=1}。
     */
    @Test
    void shouldCreateImmutableQueryAndTreeNodeSnapshots() {
        // 调用方可变参数 → ReferenceDataQuery 创建时保存独立不可变副本。
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("status", 1);
        ReferenceDataQuery query = new ReferenceDataQuery(" uniauth ", " department ", "10001", parameters);
        parameters.put("status", 0);

        List<TreeNode> children = new ArrayList<>();
        TreeNode root = new TreeNode("root", null, "全部部门", "root", children, Map.of("status", 1));
        children.add(new TreeNode("child", "root", "研发部", "100", List.of(), Map.of()));

        // 创建后的查询和树节点 → 保持去空格后的坐标及创建时集合内容。
        assertEquals("uniauth", query.projectCode());
        assertEquals(1, query.parameters().get("status"));
        assertEquals(0, root.children().size());
        assertThrows(UnsupportedOperationException.class, () -> query.parameters().put("status", 2));
    }

    /**
     * 验证缺少项目逻辑编码时使用公共业务异常和稳定错误编码。
     *
     * 执行结果示例：空白 projectCode 返回
     * {@code REFERENCE_DATA_PROJECT_CODE_REQUIRED/projectCode 不能为空。}。
     */
    @Test
    void shouldRejectMissingLogicalResourceCoordinates() {
        // 空白项目编码 → 可由公共 Web 层映射为 HTTP 400 的业务异常。
        CommonBusinessException exception = assertThrows(
                CommonBusinessException.class,
                () -> new ReferenceDataQuery(" ", "department", null, Map.of()));

        // 稳定错误编码和安全中文提示 → 前端无需解析异常类型或英文消息。
        assertEquals("REFERENCE_DATA_PROJECT_CODE_REQUIRED", exception.getErrorCode());
        assertEquals("projectCode 不能为空。", exception.getMessage());
    }
}
