package com.sp.selplat.uniauth.user.domain.in;

import com.sp.selplat.uniauth.user.domain.UniauthUser;

/**
 * 用户查询输入对象继承用户实体，是为了直接复用 tenantId、loginName、displayName、userStatus、lockedFlag 等主表字段。
 * 同时因为实体继承了 Domain/Page，这里还能顺带复用 pageNo 和 pageSize，减少查询类重复声明变量的维护成本。
 */
public class UniauthUserIn extends UniauthUser {
}
