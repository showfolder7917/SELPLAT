package com.sp.selplat.uniauth.user.domain.in;

import java.time.LocalDateTime;

// 用户保存输入对象统一承接新增和修改账号时需要落库的字段。
public class UniauthUserSaveIn {

    // id 有值表示更新现有账号，没有值表示创建新账号。
    private Long id;
    // tenantId 决定账号归属的租户边界。
    private Long tenantId;
    // loginName 是权限系统稳定登录标识。
    private String loginName;
    // password 只在新增或显式重置密码时由服务层重新计算哈希。
    private String password;
    // displayName 用于后台和业务页面展示当前账号。
    private String displayName;
    // displayNameKana 用于日语场景下补充假名展示。
    private String displayNameKana;
    // locale 决定当前账号默认语言区域。
    private String locale;
    // email 记录账号联系邮箱。
    private String email;
    // phone 记录账号联系电话。
    private String phone;
    // userStatus 控制账号是否可用。
    private String userStatus;
    // lockedFlag 控制账号是否被锁定。
    private Boolean lockedFlag;
    // expiredAt 表达账号到期时间。
    private LocalDateTime expiredAt;

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

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
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
}
