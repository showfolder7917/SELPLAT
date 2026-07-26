package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.uniauth.user.service.impl.support.UniauthUserRealDatabaseTestVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.jdbc.Sql;

// update 真实数据库测试类分别验证不传密码和传入密码时的公共更新行为。
class UniauthUserUpdateRealDatabaseTest extends AbstractUniauthUserRealDatabaseTest {

    // withoutPassword Case 验证普通资料更新不会破坏原密码摘要。
    @Test
    @Sql("/fixtures/UniauthUserUpdateRealDatabaseTest/withoutPassword.sql")
    void withoutPassword() {
        UniauthUserRealDatabaseTestVerifier.verifyUpdateWithoutPassword(uniauthUserService, jdbcTemplate);
    }

    // withPassword Case 验证明文密码转换成摘要后写入真实数据库且不回传敏感字段。
    @Test
    @Sql("/fixtures/UniauthUserUpdateRealDatabaseTest/withPassword.sql")
    void withPassword() {
        UniauthUserRealDatabaseTestVerifier.verifyUpdateWithPassword(uniauthUserService, jdbcTemplate);
    }
}
