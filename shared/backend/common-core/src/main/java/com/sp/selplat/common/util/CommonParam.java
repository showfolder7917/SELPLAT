package com.sp.selplat.common.util;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 通用入参对象统一承接非分页接口和分页接口都可能复用的动态业务参数。
 * 这里把各模块原先零散的 xxxIn 查询对象、保存对象和删除对象先收口到同一套参数容器，
 * 让控制层、服务层都围绕同一套动态参数传递约定演进。
 */
public class CommonParam {

    // paramMap 统一承接控制层解析出来的业务字段，供后续服务层按字段名读取主键、状态和业务属性。
    private Map<String, Object> paramMap = new LinkedHashMap<>();

    /**
     * 获取动态业务参数映射。
     *
     * @return 动态业务参数映射
     */
    public Map<String, Object> getParamMap() {
        return paramMap;
    }

    /**
     * 设置动态业务参数映射。
     *
     * @param paramMap 动态业务参数映射
     */
    public void setParamMap(Map<String, Object> paramMap) {
        // 调用方未传动态字段时统一回落为空有序映射，保证服务层取值时不必反复判空。
        this.paramMap = paramMap == null ? new LinkedHashMap<>() : new LinkedHashMap<>(paramMap);
    }

    /**
     * 写入单个动态业务字段。
     *
     * @param key 字段名
     * @param value 字段值
     */
    public void putParam(String key, Object value) {
        // 字段名为空时直接忽略，避免把空 key 写入共通参数对象污染后续业务判断。
        if (key == null || key.trim().isEmpty()) {
            return;
        }
        // 动态写入业务字段，让控制层可以按最小成本把 JSON、表单和 query string 参数统一灌入参数容器。
        paramMap.put(key, value);
    }

    /**
     * 读取单个动态业务字段。
     *
     * @param key 字段名
     * @return 字段值
     */
    public Object getParam(String key) {
        // 未初始化动态字段映射时直接返回空，保证服务层在极端场景下也能按“未传值”处理。
        if (paramMap == null || key == null) {
            return null;
        }
        // 直接按字段名读取当前业务值，供服务层统一完成类型转换和业务校验。
        return paramMap.get(key);
    }

    /**
     * 把 JSON 里未声明成固定字段的业务属性统一回收到动态参数映射。
     *
     * @param key JSON 字段名
     * @param value JSON 字段值
     */
    @JsonAnySetter
    public void putJsonParam(String key, Object value) {
        // Jackson 反序列化时遇到未声明固定属性的字段，统一落到动态参数映射，避免每个模块都重复声明大量入参类。
        putParam(key, value);
    }
}
