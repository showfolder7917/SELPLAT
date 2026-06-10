package com.sp.selplat.uniauth.user.domain.in;

// 用户查询输入对象用于承接列表筛选条件，避免控制层直接散落零碎查询参数。
public class UniauthUserQueryIn {

    // tenantId 用于限定查询某个租户下的账号。
    private Long tenantId;
    // loginName 用于按登录名做模糊或精确筛选。
    private String loginName;
    // displayName 用于按显示名称筛选账号。
    private String displayName;
    // userStatus 用于按账号状态筛选，例如 ACTIVE 或 DISABLED。
    private String userStatus;
    // lockedFlag 用于筛选已锁定或未锁定账号。
    private Boolean lockedFlag;

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
}
