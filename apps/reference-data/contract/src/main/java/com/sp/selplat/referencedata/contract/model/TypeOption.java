package com.sp.selplat.referencedata.contract.model;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * 通用类型列表和下拉选项使用的稳定返回结构。
 * 资源 Provider 决定选项内容，本类型统一值、显示名、分组、顺序和禁用状态。
 *
 * @param value 提交给业务接口的稳定值，例如 {@code "ACTIVE"}
 * @param label 页面显示文本，例如 {@code "有效"}
 * @param groupCode 可选分组编码，例如 {@code "user-status"}
 * @param sortOrder 同一资源内的升序排列值，例如 {@code 10}
 * @param disabled 当前选项是否只展示但不可选择
 * @param attributes 已登记的扩展属性，例如 {@code {"color":"green"}}
 */
public record TypeOption(
        String value,
        String label,
        String groupCode,
        int sortOrder,
        boolean disabled,
        Map<String, Object> attributes) {

    /**
     * 建立不可变类型选项，保证缓存和多个业务调用方看到同一份稳定内容。
     *
     * @param value 业务值，例如 {@code "ACTIVE"}
     * @param label 显示文本，例如 {@code "有效"}
     * @param groupCode 分组编码，例如 {@code "user-status"}
     * @param sortOrder 排列值，例如 {@code 10}
     * @param disabled 是否禁止选择，例如 {@code false}
     * @param attributes 扩展属性，例如 {@code {"color":"green"}}
     * @throws NullPointerException 当 value 或 label 为空时抛出，例如
     *     {@code NullPointerException("value")}
     */
    public TypeOption {
        // Provider 必填字段 → 页面提交值和显示文本的固定契约。
        value = Objects.requireNonNull(value, "value");
        label = Objects.requireNonNull(label, "label");
        // 外部可变 Map → 可安全进入共享缓存的不可变扩展属性快照。
        attributes = attributes == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(attributes));
    }
}
