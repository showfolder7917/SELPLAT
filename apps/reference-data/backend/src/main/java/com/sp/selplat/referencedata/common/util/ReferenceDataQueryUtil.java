package com.sp.selplat.referencedata.common.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.JsonUtils;
import java.util.Map;

/**
 * 为各引用数据表 Service 提供无状态的本地化、JSON 属性和统一成功结果转换方法。
 * 本工具不访问数据库、不拥有业务流程，也不替代表业务 Service。
 */
public final class ReferenceDataQueryUtil {

    /** 私有构造器阻止把无状态方法集合误当成 Spring 业务组件。 */
    private ReferenceDataQueryUtil() {
    }

    /**
     * 从请求参数读取受支持语言并提供中文回退。
     *
     * @param parameters Controller 传入的查询参数，例如 {@code {"locale":"ja-JP"}}
     * @return 规范语言，例如 {@code "ja-JP"}；未知语言返回 {@code "zh-CN"}
     */
    public static String locale(Map<String, String> parameters) {
        String value = parameters == null ? null : parameters.get("locale");
        if ("ja-JP".equalsIgnoreCase(value)) return "ja-JP";
        if ("en-US".equalsIgnoreCase(value)) return "en-US";
        return "zh-CN";
    }

    /**
     * 按语言选择数据库记录中的三语标签。
     *
     * @param row DAO 返回的记录，例如 {@code {labelZh:"树形资源",labelJa:"ツリーリソース"}}
     * @param locale 已规范化语言，例如 {@code "ja-JP"}
     * @return 对应显示文本，例如 {@code "ツリーリソース"}
     */
    public static String label(Map<String, Object> row, String locale) {
        String field = "ja-JP".equals(locale) ? "labelJa" : "en-US".equals(locale) ? "labelEn" : "labelZh";
        Object localized = row.get(field);
        return localized == null || String.valueOf(localized).isBlank()
                ? String.valueOf(row.get("labelZh"))
                : String.valueOf(localized);
    }

    /**
     * 按引用数据语言回退顺序选择三语名称，最终回退稳定 valueCode。
     * 真实传参示例：{@code {nameZh:"工程师",nameJa:"エンジニア",valueCode:"ENGINEER"}} 与 {@code ja-JP}。
     * 真实返回示例：返回 {@code エンジニア}。
     * 异常或副作用示例：三语名称均为空时返回 {@code ENGINEER}；不修改原记录。
     *
     * @param row DAO 返回的类型记录
     * @param locale 已规范化为 zh-CN、ja-JP 或 en-US 的语言
     * @return 当前语言可显示名称
     */
    public static String name(Map<String, Object> row, String locale) {
        String[] fields = "ja-JP".equals(locale)
                ? new String[] {"nameJa", "nameZh", "nameEn"}
                : "en-US".equals(locale)
                        ? new String[] {"nameEn", "nameZh", "nameJa"}
                        : new String[] {"nameZh", "nameEn", "nameJa"};
        for (String field : fields) {
            Object value = row.get(field);
            if (value != null && !String.valueOf(value).isBlank()) {
                return String.valueOf(value);
            }
        }
        return String.valueOf(row.get("valueCode"));
    }

    /**
     * 将数据库 JSON 扩展字段解析为公共不可变映射输入。
     *
     * @param value DAO 返回的 JSON 字段，例如 {@code {"resourceKind":"TREE"}}
     * @return 属性映射，例如 {@code {"resourceKind":"TREE"}}；空值返回空映射
     */
    public static Map<String, Object> attributes(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return Map.of();
        Map<String, Object> attributes = JsonUtils.fromJson(
                String.valueOf(value), new TypeReference<Map<String, Object>>() { });
        return attributes == null ? Map.of() : Map.copyOf(attributes);
    }

    /**
     * 构建表查询 Controller 使用的统一成功结果。
     *
     * @param data 表 Service 产生的树、选项或菜单列表，例如 {@code [{"value":"TREE"}]}
     * @param requestPath 当前真实接口路径，例如 {@code "/api/reference-data/trees/treeNode101007"}
     * @param message 查询完成说明，例如 {@code "引用数据选项查询完成。"}
     * @return 完整成功结果，例如
     *     {@code {"success":true,"moduleCode":"reference-data","data":[{"value":"TREE"}],"msg":"引用数据选项查询完成。"}}
     */
    public static CommonResult success(Object data, String requestPath, String message) {
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setModuleCode("reference-data");
        result.setRequestPath(requestPath);
        result.setData(data);
        result.setMsg(message);
        return result;
    }
}
