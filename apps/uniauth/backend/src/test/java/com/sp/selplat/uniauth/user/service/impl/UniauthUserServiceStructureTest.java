package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.uniauth.user.service.impl.support.UniauthUserRealDatabaseTestVerifier;
import org.junit.jupiter.api.Test;

// 用户 Service 结构测试只声明基础 DAO 入口 Case，具体继承、字段和构造函数断言由验证器统一维护。
class UniauthUserServiceStructureTest {

    // base-dao-access Case 验证用户 Service 不再声明 DAO 字段或带参构造函数。
    @Test
    void baseDaoAccess() {
        // 当前方法只调用结构验证器，保持测试 Case 与生产职责一一对应。
        UniauthUserRealDatabaseTestVerifier.verifyServiceDaoAccessStructure();
    }
}
