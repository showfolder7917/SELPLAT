package com.sp.selplat.common.support;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 为控制层、服务层和 DAO 层提供一致的空值、默认值与集合防御性复制能力。
 * 本类只处理通用值语义，不执行模块字段校验或数据库约束校验。
 */
public final class CommonValueSupport {

    /**
     * 阻止实例化无状态的通用值工具类。
     *
     * <p>执行结果示例：调用方使用 {@code CommonValueSupport.isBlank(" ")}，
     * 不创建工具对象。</p>
     */
    private CommonValueSupport() {
        // 这里不承接任何实例状态，强制所有方法都以静态方式复用。
    }

    /**
     * 判断文本是否没有可用业务内容。
     *
     * @param value 来自请求字段或配置项的文本，例如 {@code "  "}
     * @return {@code null}、空串或纯空格返回 {@code true}；例如输入 {@code " admin "} 返回 {@code false}
     */
    public static boolean isBlank(String value) {
        // 空值或去空格后为空都视为无有效文本。
        return value == null || value.trim().isEmpty();
    }

    /**
     * 把空文本替换为调用方指定的默认值，有效文本则去除首尾空格。
     *
     * @param value 来自请求字段或配置项的原始文本，例如 {@code " admin "}
     * @param defaultValue 当前字段为空时使用的业务默认值，例如 {@code "system"}
     * @return 规范化文本；例如 {@code blankToDefault(" admin ", "system")} 返回 {@code "admin"}
     */
    public static String blankToDefault(String value, String defaultValue) {
        // 当前值为空时返回调用方提供的默认值，否则返回去空格后的正式文本。
        return isBlank(value) ? defaultValue : value.trim();
    }

    /**
     * 把可空长整型转换为可直接参与业务判断的基础类型。
     *
     * @param value 来自主键或计数字段的可空值，例如 {@code 1001L}
     * @return 原长整型值；输入 {@code null} 时返回 {@code 0L}
     */
    public static long longValue(Long value) {
        // 调用方传空时统一兜底为 0，便于后续做显式存在性判断。
        return value == null ? 0L : value;
    }

    /**
     * 把可空列表转换为不可空的独立列表。
     *
     * @param source 来自查询结果或批量请求的列表，例如 {@code [1L, 2L]}
     * @param <T> 列表元素类型，例如 {@code Long}
     * @return 防御性复制后的列表，例如 {@code [1L, 2L]}；输入 {@code null} 时返回 {@code []}
     */
    public static <T> List<T> nullSafeList(List<T> source) {
        // 没有列表时返回空集合，有列表时复制成新列表避免调用方误改原对象。
        return source == null ? Collections.emptyList() : new ArrayList<>(source);
    }
}
