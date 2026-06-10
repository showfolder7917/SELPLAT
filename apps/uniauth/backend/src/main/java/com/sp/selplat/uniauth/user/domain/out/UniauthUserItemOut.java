package com.sp.selplat.uniauth.user.domain.out;

import java.time.LocalDateTime;

// 用户输出对象同时服务列表、详情和保存后回显，避免字段口径漂移。
public class UniauthUserItemOut {

    // id 让前端在更新和删除时能稳定指向目标账号。
    private Long id;
    // tenantId 表达当前账号归属租户。
    private Long tenantId;
    // loginName 作为权限系统稳定登录标识返回给前端。
    private String loginName;
    // displayName 用于界面展示账号名称。
    private String displayName;
    // displayNameKana 用于假名展示场景。
    private String displayNameKana;
    // locale 表达当前账号默认语言。
    private String locale;
    // email 返回账号邮箱信息。
    private String email;
    // phone 返回账号联系电话。
    private String phone;
    // userStatus 返回账号当前状态。
    private String userStatus;
    // lockedFlag 返回账号是否已锁定。
    private Boolean lockedFlag;
    // expiredAt 返回账号失效时间。
    private LocalDateTime expiredAt;
    // createdAt 返回账号创建时间。
    private LocalDateTime createdAt;
    // updatedAt 返回账号最后更新时间。
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }

    public String getLoginName() {
        return loginName;
    }

    public void setLoginName(String loginName) {
        this.loginName = loginName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayNameKana() {
        return displayNameKana;
    }

    public void setDisplayNameKana(String displayNameKana) {
        this.displayNameKana = displayNameKana;
    }

    public String getLocale() {
        return locale;
    }

    public void setLocale(String locale) {
        this.locale = locale;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getUserStatus() {
        return userStatus;
    }

    public void setUserStatus(String userStatus) {
        this.userStatus = userStatus;
    }

    public Boolean getLockedFlag() {
        return lockedFlag;
    }

    public void setLockedFlag(Boolean lockedFlag) {
        this.lockedFlag = lockedFlag;
    }

    public LocalDateTime getExpiredAt() {
        return expiredAt;
    }

    public void setExpiredAt(LocalDateTime expiredAt) {
        this.expiredAt = expiredAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
