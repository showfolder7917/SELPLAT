package com.sp.selplat.common.util;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.text.DateFormat;
import java.text.SimpleDateFormat;

/**
 * 公共 JSON 工具，统一承接后端对象与 JSON 字符串之间的转换规则。
 */
public final class JsonUtils {

    // 标准映射器用于常规 JSON 输出，保持日期格式统一并兼容 Java 时间类型。
    private static final ObjectMapper OBJECT_MAPPER = buildDefaultMapper();

    // 扩展映射器用于接口层宽松输出，空 bean 场景下不抛异常，并忽略值为 null 的字段。
    private static final ObjectMapper OBJECT_MAPPER_EXT = buildExtendedMapper();

    /**
     * 私有构造器阻止外部实例化，避免把工具类误当成有状态组件使用。
     */
    private JsonUtils() {
    }

    /**
     * 构建标准映射器，统一注册时间模块和日期格式。
     *
     * @return 标准 JSON 映射器
     */
    private static ObjectMapper buildDefaultMapper() {
        // 统一使用同一份日期格式，避免各接口输出的时间字符串口径不一致。
        DateFormat dateFormat = new SimpleDateFormat("yyyy/MM/dd HH:mm:ss");
        // 新建标准映射器，供普通 toJson 和 fromJson 共享。
        ObjectMapper objectMapper = new ObjectMapper();
        // 注册 Java 时间模块，保证 LocalDate 和 LocalDateTime 等类型可以稳定序列化。
        objectMapper.registerModule(new JavaTimeModule());
        // 设置传统日期类型的输出格式，兼容 Date 和 Timestamp 等历史类型。
        objectMapper.setDateFormat(dateFormat);
        // 关闭时间戳输出，确保接口默认返回可读的文本日期。
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return objectMapper;
    }

    /**
     * 构建扩展映射器，专门处理接口层宽松序列化场景。
     *
     * @return 扩展 JSON 映射器
     */
    private static ObjectMapper buildExtendedMapper() {
        // 基于标准映射器复制扩展映射器，保证日期和时间模块行为与普通输出保持一致。
        ObjectMapper objectMapper = buildDefaultMapper().copy();
        // 空值字段不输出，减少接口响应里无业务意义的 null 字段噪声。
        objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        // 空 bean 关闭失败开关，避免控制器返回轻量对象时因为无属性而直接抛异常。
        objectMapper.disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);
        return objectMapper;
    }

    /**
     * 按标准规则把对象转成 JSON 字符串。
     *
     * @param object 待序列化对象
     * @return 标准 JSON 字符串
     */
    public static String toJson(Object object) {
        try {
            // 使用标准映射器输出，适合需要完整字段和统一日期格式的普通序列化场景。
            return OBJECT_MAPPER.writeValueAsString(object);
        } catch (JsonProcessingException exception) {
            // 序列化失败时抛出运行时异常，让上层能明确感知响应构建失败。
            throw new IllegalStateException("JSON 序列化失败: " + object, exception);
        }
    }

    /**
     * 按忽略空值的规则把对象转成 JSON 字符串，空 bean 场景下不抛出异常。
     *
     * @param object 待序列化对象
     * @return 忽略空值后的 JSON 字符串
     */
    public static String toJsonIgnoreNull(Object object) {
        try {
            // 使用忽略空值的映射器输出，接口层可以省略 null 字段并兼容空 bean 返回。
            return OBJECT_MAPPER_EXT.writeValueAsString(object);
        } catch (JsonProcessingException exception) {
            // 忽略空值输出仍视为响应构建失败，但空 bean 本身不会再触发该分支。
            throw new IllegalStateException("忽略空值 JSON 序列化失败: " + object, exception);
        }
    }

    /**
     * 把 JSON 字符串按目标类型解析成对象。
     *
     * @param jsonString JSON 字符串
     * @param clazz 目标类型
     * @param <T> 目标泛型
     * @return 解析后的对象
     */
    public static <T> T fromJson(String jsonString, Class<T> clazz) {
        // 空字符串不参与解析，直接返回 null 让上层按“无输入”语义处理。
        if (jsonString == null) {
            return null;
        }
        try {
            // 使用标准映射器解析固定类型对象，服务于 DTO、实体和配置读取场景。
            return OBJECT_MAPPER.readValue(jsonString, clazz);
        } catch (JsonProcessingException exception) {
            // 解析失败时抛出运行时异常，避免错误 JSON 在业务链路中静默传播。
            throw new IllegalStateException("JSON 解析失败: " + jsonString, exception);
        }
    }

    /**
     * 把 JSON 字符串按泛型类型描述解析成对象。
     *
     * @param jsonString JSON 字符串
     * @param typeReference 泛型类型描述
     * @param <T> 目标泛型
     * @return 解析后的对象
     */
    public static <T> T fromJson(String jsonString, TypeReference<T> typeReference) {
        // 空字符串不参与解析，直接返回 null 让上层自行决定默认行为。
        if (jsonString == null) {
            return null;
        }
        try {
            // 使用泛型类型描述解析集合或复杂嵌套结构，避免类型擦除导致的数据丢失。
            return OBJECT_MAPPER.readValue(jsonString, typeReference);
        } catch (JsonProcessingException exception) {
            // 泛型解析失败时统一抛出运行时异常，便于快速定位非法 JSON 输入。
            throw new IllegalStateException("JSON 泛型解析失败: " + jsonString, exception);
        }
    }
}
