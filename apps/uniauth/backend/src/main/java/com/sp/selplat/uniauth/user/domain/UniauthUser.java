package com.sp.selplat.uniauth.user.domain;

import com.sp.selplat.common.util.Domain;
import java.time.LocalDateTime;

/**
 * UniauthUser 实体用于承接统一认证用户主表的业务字段。
 * 这里让实体继承公共 Domain，是为了少写 id、createdAt、updatedAt 和分页变量，降低后续字段维护成本。
 */
public class UniauthUser extends Domain {

    // tenantId 对应用户所属租户主键，表示该账号归属哪个租户。
    private Long tenantId;
    // loginName 对应登录账号字段，供认证入口按唯一账号检索用户。
    private String loginName;
    // passwordHash 对应加密口令摘要字段，避免系统保存明文密码。
    private String passwordHash;
    // displayName 对应默认展示姓名，供列表、详情和界面抬头直接显示。
    private String displayName;
    // displayNameKana 对应日文假名字段，兼容日语环境下的人名展示与检索。
    private String displayNameKana;
    // locale 对应用户默认语言区域，控制后续界面或通知的语言偏好。
    private String locale;
    // email 对应用户邮箱，供账号资料和通知场景使用。
    private String email;
    // phone 对应用户联系电话，供资料展示和通知补充使用。
    private String phone;
    // userStatus 对应账号状态字段，表示该账号当前是否处于可用状态。
    private String userStatus;
    // lockedFlag 对应锁定标记字段，表示账号是否被锁定禁止登录，也方便查询入参直接复用这个筛选变量。
    private Boolean lockedFlag;
    // expiredAt 对应账号到期时间，供临时账号或合同到期控制使用。
    private LocalDateTime expiredAt;

    /**
     * 获取租户主键。
     *
     * @return 用户所属租户主键，例如 {@code 1L}
     */
    public Long getTenantId() {
        return tenantId;
    }

    /**
     * 设置租户主键。
     *
     * @param tenantId 租户主键
     */
    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }

    /**
     * 获取登录账号。
     *
     * @return 登录账号，例如 {@code admin}
     */
    public String getLoginName() {
        return loginName;
    }

    /**
     * 设置登录账号。
     *
     * @param loginName 登录账号
     */
    public void setLoginName(String loginName) {
        this.loginName = loginName;
    }

    /**
     * 获取密码摘要。
     *
     * @return SHA-256 密码摘要，例如 {@code 2bb80d537b1da3e38bd30361aa855686bde0ba...}
     */
    public String getPasswordHash() {
        return passwordHash;
    }

    /**
     * 设置密码摘要。
     *
     * @param passwordHash 密码摘要
     */
    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    /**
     * 获取展示姓名。
     *
     * @return 用户展示姓名，例如 {@code 系统管理员}
     */
    public String getDisplayName() {
        return displayName;
    }

    /**
     * 设置展示姓名。
     *
     * @param displayName 展示姓名
     */
    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    /**
     * 获取假名展示姓名。
     *
     * @return 日文假名展示姓名，例如 {@code システムカンリシャ}
     */
    public String getDisplayNameKana() {
        return displayNameKana;
    }

    /**
     * 设置假名展示姓名。
     *
     * @param displayNameKana 假名展示姓名
     */
    public void setDisplayNameKana(String displayNameKana) {
        this.displayNameKana = displayNameKana;
    }

    /**
     * 获取语言区域。
     *
     * @return 用户默认语言区域，例如 {@code ja-JP}
     */
    public String getLocale() {
        return locale;
    }

    /**
     * 设置语言区域。
     *
     * @param locale 语言区域
     */
    public void setLocale(String locale) {
        this.locale = locale;
    }

    /**
     * 获取邮箱。
     *
     * @return 用户邮箱，例如 {@code admin@example.com}
     */
    public String getEmail() {
        return email;
    }

    /**
     * 设置邮箱。
     *
     * @param email 邮箱
     */
    public void setEmail(String email) {
        this.email = email;
    }

    /**
     * 获取联系电话。
     *
     * @return 用户联系电话，例如 {@code 09012345678}
     */
    public String getPhone() {
        return phone;
    }

    /**
     * 设置联系电话。
     *
     * @param phone 联系电话
     */
    public void setPhone(String phone) {
        this.phone = phone;
    }

    /**
     * 获取账号状态。
     *
     * @return 账号状态，例如 {@code ACTIVE}
     */
    public String getUserStatus() {
        return userStatus;
    }

    /**
     * 设置账号状态。
     *
     * @param userStatus 账号状态
     */
    public void setUserStatus(String userStatus) {
        this.userStatus = userStatus;
    }

    /**
     * 获取锁定标记。
     *
     * @return 账号锁定时返回 {@code true}，正常可登录时返回 {@code false}
     */
    public Boolean getLockedFlag() {
        return lockedFlag;
    }

    /**
     * 设置锁定标记。
     *
     * @param lockedFlag 锁定标记
     */
    public void setLockedFlag(Boolean lockedFlag) {
        this.lockedFlag = lockedFlag;
    }

    /**
     * 获取账号到期时间。
     *
     * @return 账号到期时间，例如 {@code 2026-12-31T23:59:59}
     */
    public LocalDateTime getExpiredAt() {
        return expiredAt;
    }

    /**
     * 设置账号到期时间。
     *
     * @param expiredAt 账号到期时间
     */
    public void setExpiredAt(LocalDateTime expiredAt) {
        this.expiredAt = expiredAt;
    }

}
