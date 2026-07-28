package com.sp.selplat.common.db.sequence.model;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 主键号段定义保存每个主键字段各自对应的号段编码，供单主键和复合主键分别取号并准确回填。
 *
 * <p>返回示例：
 * <pre>
 * 单主键定义 = {"id": "UniauthUserId"}
 *         发号结果 = {"id": 100001L}
 *
 * 复合主键定义 = {
 *     "tenantId": "UniauthUserTenantId",
 *     "orderId": "UniauthUserOrderId"
 * }
 * 复合主键发号结果 = {"tenantId": 100001L, "orderId": 200001L}
 * </pre>
 *
 * <p>每个号段编码均由 DAO 对应表名加当前主键字段的 UpperCamelCase 名称组成，不把多个
 * 主键字段合并为一个数据库号段编码。
 */
public final class IdSequenceDefinition {

    // idSequenceCodeMap 按 DAO 主键顺序保存字段名与独立号段编码，让复合主键的每个字段分别查询数据库号段。
    private final Map<String, String> idSequenceCodeMap;

    /**
     * 创建不可变的主键号段定义。
     *
     * @param idSequenceCodeMap DAO 元数据顺序下的主键字段到独立号段编码映射，例如
     *     {@code {"tenantId":"UniauthUserTenantId","orderId":"UniauthUserOrderId"}}
     * @throws IllegalArgumentException 当映射为空、主键字段为空或号段编码为空时抛出，例如
     *     {@code IllegalArgumentException("idSequenceCodeMap must not be empty")}
     */
    public IdSequenceDefinition(Map<String, String> idSequenceCodeMap) {
        // 主键字段和号段编码缺失时无法分别查询数据库并回填对应字段，因此禁止创建空定义。
        if (idSequenceCodeMap == null || idSequenceCodeMap.isEmpty()) {
            throw new IllegalArgumentException("idSequenceCodeMap must not be empty");
        }
        // 使用有序映射复制 DAO 元数据结果，保证复合主键定义和发号结果采用相同字段顺序。
        Map<String, String> normalizedMap = new LinkedHashMap<>();
        // 逐项校验字段与号段编码，避免任意一个复合主键分量失去数据库查询条件。
        idSequenceCodeMap.forEach((idColumn, sequenceCode) -> {
            // 主键字段为空时无法确定生成值回填到哪个数据库列。
            if (idColumn == null || idColumn.trim().isEmpty()) {
                throw new IllegalArgumentException("id column must not be blank");
            }
            // 独立号段编码为空时无法查询该主键字段对应的数据库号段。
            if (sequenceCode == null || sequenceCode.trim().isEmpty()) {
                throw new IllegalArgumentException("sequence code must not be blank");
            }
            // 保存规范化后的字段名和号段编码，同时保持调用方提供的复合主键顺序。
            normalizedMap.put(idColumn.trim(), sequenceCode.trim());
        });
        // 保存不可变有序副本，既防止调用方修改，也保留复合主键的 DAO 元数据顺序。
        this.idSequenceCodeMap = Collections.unmodifiableMap(normalizedMap);
    }

    /**
     * 返回每个主键字段需要查询的独立数据库号段编码。
     *
     * @return 不可变有序映射；单主键例如 {@code {"id":"UniauthUserId"}}，复合主键例如
     *     {@code {"tenantId":"UniauthUserTenantId","orderId":"UniauthUserOrderId"}}
     */
    public Map<String, String> getIdSequenceCodeMap() {
        // 返回字段与号段的一一对应关系，让发号器逐个查询并按相同字段名返回 Long。
        return idSequenceCodeMap;
    }
}
