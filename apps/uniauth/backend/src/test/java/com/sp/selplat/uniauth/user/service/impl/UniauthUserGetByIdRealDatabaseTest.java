package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.uniauth.user.service.impl.support.UniauthUserRealDatabaseTestVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.jdbc.Sql;

/**
 * getById 真实数据库测试类集中覆盖 CommonParam 数字主键、字符串主键、未命中和非法前端参数。
 */
class UniauthUserGetByIdRealDatabaseTest extends AbstractUniauthUserRealDatabaseTest {

    /**
     * foundNumber Case 验证数字主键直接进入真实 DAO 并返回对应详情。
     */
    @Test
    @Sql("/fixtures/UniauthUserGetByIdRealDatabaseTest/foundNumber.sql")
    void foundNumber() {
        UniauthUserRealDatabaseTestVerifier.verifyGetByIdFoundNumber(uniauthUserService, jdbcTemplate);
    }

    /**
     * foundString Case 验证前端字符串主键直接透传后命中真实数据库记录。
     */
    @Test
    @Sql("/fixtures/UniauthUserGetByIdRealDatabaseTest/foundString.sql")
    void foundString() {
        UniauthUserRealDatabaseTestVerifier.verifyGetByIdFoundString(uniauthUserService, jdbcTemplate);
    }

    /**
     * notFound Case 验证真实表中不存在主键时服务返回明确业务异常。
     */
    @Test
    @Sql("/fixtures/UniauthUserGetByIdRealDatabaseTest/notFound.sql")
    void notFound() {
        UniauthUserRealDatabaseTestVerifier.verifyGetByIdNotFound(uniauthUserService);
    }

    /**
     * missing-id Case 验证空 CommonParam 不会形成无条件主键查询。
     */
    @Test
    void missingId() {
        UniauthUserRealDatabaseTestVerifier.verifyGetByIdMissingId(uniauthUserService);
    }

    /**
     * null-input Case 验证控制层极端未传对象时仍返回明确未命中异常。
     */
    @Test
    void nullInput() {
        UniauthUserRealDatabaseTestVerifier.verifyGetByIdNullInput(uniauthUserService);
    }

    /**
     * invalid-id Case 验证非法字符串进入真实 DAO 后不会被当作成功主键查询。
     */
    @Test
    void invalidId() {
        UniauthUserRealDatabaseTestVerifier.verifyGetByIdInvalidId(uniauthUserService);
    }
}
