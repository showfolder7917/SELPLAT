package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.uniauth.user.service.impl.support.UniauthUserRealDatabaseTestVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.jdbc.Sql;

// delete 真实数据库测试类验证生产方法只执行逻辑删除并保留可审计记录。
class UniauthUserDeleteRealDatabaseTest extends AbstractUniauthUserRealDatabaseTest {

    // softDelete Case 验证 status、updatedAt 和最近操作用户通过真实 BaseDao 更新落库。
    @Test
    @Sql("/fixtures/UniauthUserDeleteRealDatabaseTest/softDelete.sql")
    void softDelete() {
        UniauthUserRealDatabaseTestVerifier.verifySoftDelete(uniauthUserService, jdbcTemplate);
    }
}
