package com.sp.selplat.common.util;

import java.time.LocalDateTime;

/**
 * 公共领域基类统一沉淀主键、审计时间、排序字段和分页字段。
 * 当前设计选择让 Domain 继承 Page，是为了让查询入参类在继承实体时顺带复用分页变量，减少重复定义和维护成本。
 */
public class Domain extends Page {

    // key 记录通用主键列名，供通用数据访问层在未单独指定主键时复用默认 id。
    private String key = "id";

    // id 作为通用主键字段，供大多数业务实体复用同一套主键定义。
    private Long id;
    // orderBy 作为通用排序表达式，供列表查询直接承接如 id desc 这类统一排序参数。
    private String orderBy;
    // status 作为通用假删除状态字段，默认值 1 表示启用，0 表示删除，便于查询默认只命中有效数据。
    private Integer status = 1;
    // createdAt 作为通用创建时间字段，供实体承接数据库审计创建时间。
    private LocalDateTime createdAt;
    // updatedAt 作为通用更新时间字段，供实体承接数据库最后修改时间。
    private LocalDateTime updatedAt;

    /**
     * 默认主键名称
     *
     * @return 通用主键
     */
    public String getKey() {
        return key;
    }

    /**
     * 设置默认主键名称。
     *
     * @param key 默认主键名称
     */
    public void setKey(String key) {
        this.key = key;
    }

    /**
     * 获取通用主键。
     *
     * @return 通用主键
     */
    public Long getId() {
        return id;
    }

    /**
     * 设置通用主键。
     *
     * @param id 通用主键
     */
    public void setId(Long id) {
        this.id = id;
    }

    /**
     * 获取排序表达式。
     *
     * @return 排序表达式
     */
    public String getOrderBy() {
        return orderBy;
    }

    /**
     * 设置排序表达式。
     *
     * @param orderBy 排序表达式
     */
    public void setOrderBy(String orderBy) {
        this.orderBy = orderBy;
    }

    /**
     * 获取假删除状态。
     *
     * @return 假删除状态
     */
    public Integer getStatus() {
        return status;
    }

    /**
     * 设置假删除状态。
     *
     * @param status 假删除状态，1 表示启用，0 表示删除
     */
    public void setStatus(Integer status) {
        // 调用方未传状态时，统一保持启用态默认值，避免列表查询误把逻辑删除数据带出来。
        this.status = status == null ? 1 : status;
    }

    /**
     * 获取创建时间。
     *
     * @return 创建时间
     */
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    /**
     * 设置创建时间。
     *
     * @param createdAt 创建时间
     */
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    /**
     * 获取最后更新时间。
     *
     * @return 最后更新时间
     */
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    /**
     * 设置最后更新时间。
     *
     * @param updatedAt 最后更新时间
     */
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
