package com.sp.selplat.common.util;

import java.time.LocalDateTime;

/**
 * 公共领域基类统一沉淀主键、审计时间和分页字段。
 * 当前设计选择让 Domain 继承 Page，是为了让查询入参类在继承实体时顺带复用分页变量，减少重复定义和维护成本。
 */
public class Domain extends Page {

    //默认主键名称
    private String key="id";

    // id 作为通用主键字段，供大多数业务实体复用同一套主键定义。
    private Long id;
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
