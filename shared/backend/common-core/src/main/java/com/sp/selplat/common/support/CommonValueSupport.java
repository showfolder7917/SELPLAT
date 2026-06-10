package com.sp.selplat.common.support;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

// 通用值支撑类统一沉淀跨模块都会用到的空值、默认值和集合兜底逻辑。
public final class CommonValueSupport {

    // 私有构造器用于阻止把纯工具类当成业务对象实例化。
    private CommonValueSupport() {
        // 这里不承接任何实例状态，强制所有方法都以静态方式复用。
    }

    // 文本判空统一收口，避免每个模块重复写 trim 判空逻辑。
    public static boolean isBlank(String value) {
        // 空值或去空格后为空都视为无有效文本。
        return value == null || value.trim().isEmpty();
    }

    // 文本默认值统一收口，供服务层在字段缺失时补最小可用值。
    public static String blankToDefault(String value, String defaultValue) {
        // 当前值为空时返回调用方提供的默认值，否则返回去空格后的正式文本。
        return isBlank(value) ? defaultValue : value.trim();
    }

    // 长整型默认值统一收口，供主键、租户主键等可选字段做兜底转换。
    public static long longValue(Long value) {
        // 调用方传空时统一兜底为 0，便于后续做显式存在性判断。
        return value == null ? 0L : value;
    }

    // 列表空值兜底统一收口，避免业务层直接遍历空集合时报空指针。
    public static <T> List<T> nullSafeList(List<T> source) {
        // 没有列表时返回空集合，有列表时复制成新列表避免调用方误改原对象。
        return source == null ? Collections.emptyList() : new ArrayList<>(source);
    }
}
