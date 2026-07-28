package com.sp.selplat.common.util;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 公共领域基类统一沉淀主键、审计时间、排序字段和分页字段。
 * 当前设计选择让 Domain 继承 Page，是为了让查询入参类在继承实体时顺带复用分页变量，减少重复定义和维护成本。
 */
public class Domain extends Page {

    // id 作为通用主键字段，供大多数业务实体复用同一套主键定义。
    private Long id;
    // tenantId 作为通用租户字段，供多租户业务实体统一表达当前数据归属的租户边界。
    private Long tenantId;
    // lastOperateUserId 作为通用最近操作用户字段，供业务主表统一沉淀最后一次维护这条数据的操作人标识。
    private Long lastOperateUserId;
    // sortnum 保存人工排序号，数据库按两位小数精度持久化并供列表稳定排序。
    private BigDecimal sortnum;
    // status 作为通用假删除状态字段，默认值 1 表示启用，0 表示删除，便于查询默认只命中有效数据。
    private Integer status = 1;
    // createdAt 作为通用创建时间字段，供实体承接数据库审计创建时间。
    private LocalDateTime createdAt;
    // updatedAt 作为通用更新时间字段，供实体承接数据库最后修改时间。
    private LocalDateTime updatedAt;

    /**
     * 获取通用主键。
     *
     * @return 通用主键，例如 {@code 1001L}
     */
    public Long getId() {
        return id;
    }

    /**
     * 设置通用主键。
     *
     * @param id 来自数据库记录或发号服务的通用主键，例如 {@code 1001L}
     * 执行结果示例：实体主键保存为 {@code id=1001}。
     */
    public void setId(Long id) {
        this.id = id;
    }

    /**
     * 获取通用租户主键。
     *
     * @return 通用租户主键，例如 {@code 2001L}
     */
    public Long getTenantId() {
        return tenantId;
    }

    /**
     * 设置通用租户主键。
     *
     * @param tenantId 来自登录上下文或请求数据的租户主键，例如 {@code 2001L}
     * 执行结果示例：实体租户归属保存为 {@code tenantId=2001}。
     */
    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }

    /**
     * 获取通用最近操作用户主键。
     *
     * @return 最近操作用户主键，例如 {@code 3001L}
     */
    public Long getLastOperateUserId() {
        return lastOperateUserId;
    }

    /**
     * 设置通用最近操作用户主键。
     *
     * @param lastOperateUserId 来自登录上下文的操作用户主键，例如 {@code 3001L}
     * 执行结果示例：审计字段保存为 {@code lastOperateUserId=3001}。
     */
    public void setLastOperateUserId(Long lastOperateUserId) {
        this.lastOperateUserId = lastOperateUserId;
    }

    /**
     * 获取通用排序值。
     *
     * @return 通用排序值，例如 {@code 10.50}
     */
    public BigDecimal getSortnum() {
        return sortnum;
    }

    /**
     * 设置通用排序值。
     *
     * @param sortnum 来自前端或数据库的手工排序值，例如 {@code 10.50}
     * 执行结果示例：列表查询可按 {@code sortnum=10.50} 稳定排序。
     */
    public void setSortnum(BigDecimal sortnum) {
        this.sortnum = sortnum;
    }

    /**
     * 获取假删除状态。
     *
     * @return 假删除状态，例如有效记录返回 {@code 1}，已删除记录返回 {@code 0}
     */
    public Integer getStatus() {
        return status;
    }

    /**
     * 设置假删除状态。
     *
     * @param status 来自写入请求的假删除状态，例如 {@code 0}
     * 执行结果示例：输入 null 时保持启用态 {@code status=1}；输入 0 时保存为删除态。
     */
    public void setStatus(Integer status) {
        // 调用方未传状态时，统一保持启用态默认值，避免列表查询误把逻辑删除数据带出来。
        this.status = status == null ? 1 : status;
    }

    /**
     * 获取创建时间。
     *
     * @return 数据库创建时间，例如 {@code 2026-07-28T10:30:00}
     */
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    /**
     * 设置创建时间。
     *
     * @param createdAt 来自数据库审计字段的创建时间，例如 {@code 2026-07-28T10:30:00}
     * 执行结果示例：实体创建时间保存为相同的 {@code LocalDateTime}。
     */
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    /**
     * 获取最后更新时间。
     *
     * @return 数据库最后更新时间，例如 {@code 2026-07-28T11:00:00}
     */
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    /**
     * 设置最后更新时间。
     *
     * @param updatedAt 来自数据库审计字段的最后更新时间，例如 {@code 2026-07-28T11:00:00}
     * 执行结果示例：实体更新时间保存为相同的 {@code LocalDateTime}。
     */
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
