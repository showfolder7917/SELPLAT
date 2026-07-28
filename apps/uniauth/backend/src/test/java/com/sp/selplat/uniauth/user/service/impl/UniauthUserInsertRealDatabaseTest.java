package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.uniauth.user.service.impl.support.UniauthUserRealDatabaseTestVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.jdbc.Sql;

/**
 * insert 真实数据库测试类验证发号、密码摘要和公共 BaseDao 新增在同一真实事务中完成。
 */
class UniauthUserInsertRealDatabaseTest extends AbstractUniauthUserRealDatabaseTest {

    /**
     * normal Case 验证前端新增参数经过生产链路后形成真实用户记录。
     */
    @Test
    @DirtiesContext(methodMode = DirtiesContext.MethodMode.AFTER_METHOD)
    @Sql("/fixtures/UniauthUserInsertRealDatabaseTest/normal.sql")
    void normal() {
        UniauthUserRealDatabaseTestVerifier.verifyInsertNormal(uniauthUserService, jdbcTemplate);
    }
}
