package com.sp.selplat.common.db.support;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;

// 测试 JSON 工具统一负责读取类路径下的输入和期望资源，保持测试代码聚焦在模板行为断言上。
public final class BaseTemplateDaoTestJsonUtils {

    // ObjectMapper 统一开启整型转 Long，避免 JSON 里的主键和数据库返回值在类型上出现不必要差异。
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper()
        .configure(DeserializationFeature.USE_LONG_FOR_INTS, true);

    // 工具类不承载状态，不允许被实例化。
    private BaseTemplateDaoTestJsonUtils() {
    }

    // 读取指定 JSON 资源并映射成目标类型，供测试场景装载输入数据或期望结果。
    public static <T> T readJsonResource(String resourcePath, Class<T> clazz) {
        // 通过类加载器定位测试资源，确保测试运行时可以直接从 classpath 读取 JSON。
        try (InputStream inputStream = BaseTemplateDaoTestJsonUtils.class.getResourceAsStream(resourcePath)) {
            // 资源不存在时直接抛错，避免后续断言失败时难以定位是资源还是逻辑问题。
            if (inputStream == null) {
                throw new IllegalStateException("测试资源不存在: " + resourcePath);
            }
            // 把 JSON 内容映射成强类型对象，方便测试直接消费。
            return OBJECT_MAPPER.readValue(inputStream, clazz);
        } catch (IOException exception) {
            // JSON 解析失败时直接中断测试，并把具体资源路径带出来。
            throw new IllegalStateException("读取测试资源失败: " + resourcePath, exception);
        }
    }

    // 读取指定 JSON 资源并映射成泛型结构，供 Map 和 List 这类动态结果断言使用。
    public static <T> T readJsonResource(String resourcePath, TypeReference<T> typeReference) {
        // 通过类加载器定位测试资源，确保泛型结构读取和普通对象读取走同一条资源路径。
        try (InputStream inputStream = BaseTemplateDaoTestJsonUtils.class.getResourceAsStream(resourcePath)) {
            // 资源不存在时直接抛错，避免测试误把空资源当成空数据。
            if (inputStream == null) {
                throw new IllegalStateException("测试资源不存在: " + resourcePath);
            }
            // 把 JSON 内容映射成目标泛型结构，供列表结果和键值结果断言复用。
            return OBJECT_MAPPER.readValue(inputStream, typeReference);
        } catch (IOException exception) {
            // JSON 解析失败时带着资源路径抛出，方便快速定位出错文件。
            throw new IllegalStateException("读取测试资源失败: " + resourcePath, exception);
        }
    }
}
