package com.sp.selplat.common.util;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 通用分页参数对象统一承接动态查询字段和分页入参。
 * 这里把原先散落在各模块专用 In/Out 实体里的分页查询通用能力收口成一个对象，
 * 让控制层、服务层和 DAO 层都可以直接围绕同一套分页入参与动态条件传递查询语义。
 */
public class CommonPageParam extends Page {

    // paramMap 承接动态查询字段，供控制层把任意请求参数透传给 service 和 common-db 分页能力。
    private Map<String, Object> paramMap = new LinkedHashMap<>();

    /**
     * 获取动态查询字段映射。
     *
     * @return 动态查询字段映射
     */
    public Map<String, Object> getParamMap() {
        return paramMap;
    }

    /**
     * 设置动态查询字段映射。
     *
     * @param paramMap 动态查询字段映射
     */
    public void setParamMap(Map<String, Object> paramMap) {
        // 调用方未传动态字段时，统一回落为空有序映射，保证后续分页查询和结果序列化都能稳定执行。
        this.paramMap = paramMap == null ? new LinkedHashMap<>() : new LinkedHashMap<>(paramMap);
    }

    /**
     * 写入单个动态字段。
     *
     * @param key 字段名
     * @param value 字段值
     */
    public void putParam(String key, Object value) {
        // 字段名为空时直接忽略，避免把无意义 key 写入动态查询映射。
        if (key == null || key.trim().isEmpty()) {
            return;
        }
        // 逐个写入业务字段，供控制层把请求参数增量灌入通用分页对象。
        paramMap.put(key, value);
    }

    /**
     * 把 JSON 里未声明成固定字段的业务属性统一回收到动态参数映射。
     *
     * @param key JSON 字段名
     * @param value JSON 字段值
     */
    @JsonAnySetter
    public void putJsonParam(String key, Object value) {
        // Jackson 反序列化 JSON 时，凡是不属于分页或结果固定字段的业务属性，都统一沉淀到动态参数映射里。
        putParam(key, value);
    }
}
