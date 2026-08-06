package com.sp.selplat.referencedata.contract.model;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 通用树查询对外返回的稳定节点结构。
 * 数据所属项目负责产生节点，本类型只统一层级、显示值和扩展属性，不包含数据库表信息。
 *
 * @param id 资源范围内唯一的节点标识，例如 {@code "department-100"}
 * @param parentId 父节点标识，例如 {@code "department-root"}；根节点可以为空
 * @param label 页面显示文本，例如 {@code "研发部"}
 * @param value 业务提交值，例如 {@code "100"}
 * @param children 已按业务顺序排列的子节点
 * @param attributes 调用方明确登记的扩展属性，例如 {@code {"status":1}}
 */
public record TreeNode(
        String id,
        String parentId,
        String label,
        String value,
        List<TreeNode> children,
        Map<String, Object> attributes) {

    /**
     * 建立不可变树节点，避免 Provider 返回后被页面装配流程意外改写。
     *
     * @param id 节点唯一标识，例如 {@code "department-100"}
     * @param parentId 父节点标识，例如 {@code "department-root"}
     * @param label 显示文本，例如 {@code "研发部"}
     * @param value 业务值，例如 {@code "100"}
     * @param children 子节点，例如 {@code [TreeNode("department-101",...)]}
     * @param attributes 扩展属性，例如 {@code {"status":1}}
     * @throws NullPointerException 当 id、label 或 value 为空时抛出，例如
     *     {@code NullPointerException("id")}
     */
    public TreeNode {
        // Provider 必填字段 → 可跨前端和后端稳定识别的节点主体。
        id = Objects.requireNonNull(id, "id");
        label = Objects.requireNonNull(label, "label");
        value = Objects.requireNonNull(value, "value");
        // 外部可变集合 → 节点创建后保持稳定的子节点与扩展属性快照。
        children = children == null ? List.of() : List.copyOf(children);
        attributes = attributes == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(attributes));
    }
}
