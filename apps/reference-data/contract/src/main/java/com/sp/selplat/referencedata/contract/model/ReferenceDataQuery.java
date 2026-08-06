package com.sp.selplat.referencedata.contract.model;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 表达业务项目对一个已登记引用数据资源的查询条件。
 * 本对象只传递稳定逻辑编码和业务过滤参数，不允许调用方直接提交物理表名或 SQL。
 *
 * @param projectCode 资源所属项目的稳定编码，例如 {@code "uniauth"}
 * @param resourceCode 项目内资源的稳定编码，例如 {@code "department"}
 * @param tenantId 当前调用租户标识，例如 {@code "10001"}；平台级公共资源可以为空
 * @param parameters Provider 允许消费的附加过滤条件，例如 {@code {"status":1}}
 */
public record ReferenceDataQuery(
        String projectCode,
        String resourceCode,
        String tenantId,
        Map<String, Object> parameters) {

    /**
     * 校验资源逻辑坐标并建立不可变参数快照。
     *
     * @param projectCode 调用方提供的项目编码，例如 {@code "order"}
     * @param resourceCode 调用方提供的资源编码，例如 {@code "product-category"}
     * @param tenantId 当前请求的租户标识，例如 {@code "10001"}
     * @param parameters 调用方提供的过滤条件，例如 {@code {"status":1}}
     * @throws IllegalArgumentException 当项目编码或资源编码为空时抛出，例如
     *     {@code IllegalArgumentException("projectCode 不能为空。")}
     */
    public ReferenceDataQuery {
        // 外部逻辑坐标 → 去除首尾空格后的稳定注册表键。
        projectCode = requiredCode(projectCode, "projectCode");
        resourceCode = requiredCode(resourceCode, "resourceCode");
        // 外部可变 Map → 保留原顺序且不可被调用方在查询期间修改的参数快照。
        parameters = parameters == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(parameters));
    }

    private static String requiredCode(String value, String fieldName) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(fieldName + " 不能为空。");
        }
        return value.trim();
    }
}
