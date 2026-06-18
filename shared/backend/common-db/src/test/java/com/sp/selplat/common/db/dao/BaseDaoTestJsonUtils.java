package com.sp.selplat.common.db.dao;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;

// BaseDaoTestJsonUtils 专门服务 BaseDaoTest，负责把测试资源里的 JSON 映射成断言所需对象。
public final class BaseDaoTestJsonUtils {

    // ObjectMapper 统一把 JSON 里的整型主键映射成 Long，避免和 JDBC/H2 回查结果类型不一致。
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper()
        .configure(DeserializationFeature.USE_LONG_FOR_INTS, true);

    // 工具类只提供静态读取能力，不承载状态，因此不允许被实例化。
    private BaseDaoTestJsonUtils() {
    }

    // 读取指定 JSON 资源并映射成强类型对象，供测试入参或期望结果装载复用。
    public static <T> T readJsonResource(String resourcePath, Class<T> clazz) {
        // 通过当前测试工具类的类加载器定位资源，保证 IDE 和 Gradle 都从同一条 classpath 读取。
        try (InputStream inputStream = BaseDaoTestJsonUtils.class.getResourceAsStream(resourcePath)) {
            // 找不到资源时直接抛错，避免后续断言把资源问题误判成业务逻辑问题。
            if (inputStream == null) {
                throw new IllegalStateException("测试资源不存在: " + resourcePath);
            }
            // 把 JSON 内容转换成目标类型，让测试代码聚焦在断言而不是解析细节。
            return OBJECT_MAPPER.readValue(inputStream, clazz);
        } catch (IOException exception) {
            // 解析失败时把资源路径带出来，方便快速定位出错文件。
            throw new IllegalStateException("读取测试资源失败: " + resourcePath, exception);
        }
    }

    // 读取指定 JSON 资源并映射成泛型结构，供 Map 和 List 这类动态断言结果复用。
    public static <T> T readJsonResource(String resourcePath, TypeReference<T> typeReference) {
        // 通过类加载器定位当前泛型资源，保证读取路径和强类型对象保持一致。
        try (InputStream inputStream = BaseDaoTestJsonUtils.class.getResourceAsStream(resourcePath)) {
            // 找不到资源时直接中断测试，避免测试在空数据上继续执行。
            if (inputStream == null) {
                throw new IllegalStateException("测试资源不存在: " + resourcePath);
            }
            // 把 JSON 内容转换成目标泛型结构，供列表结果和键值结果断言直接使用。
            return OBJECT_MAPPER.readValue(inputStream, typeReference);
        } catch (IOException exception) {
            // 解析失败时直接抛出异常并保留根因，方便定位 JSON 结构问题。
            throw new IllegalStateException("读取测试资源失败: " + resourcePath, exception);
        }
    }
}
