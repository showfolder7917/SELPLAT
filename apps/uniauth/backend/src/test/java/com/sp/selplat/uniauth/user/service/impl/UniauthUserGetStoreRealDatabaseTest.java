package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.uniauth.user.service.impl.support.UniauthUserRealDatabaseTestVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.jdbc.Sql;

// getStore 真实数据库测试类让测试类名目录和测试方法名 fixture 文件保持一一对应。
class UniauthUserGetStoreRealDatabaseTest extends AbstractUniauthUserRealDatabaseTest {

    // defaultSortnum Case 验证公共分页默认按 sortnum 倒序返回真实用户数据。
    @Test
    @Sql("/fixtures/UniauthUserGetStoreRealDatabaseTest/defaultSortnum.sql")
    void defaultSortnum() {
        UniauthUserRealDatabaseTestVerifier.verifyGetStoreDefaultSortnum(uniauthUserService, jdbcTemplate);
    }

    // filter Case 验证前端 Like 查询条件进入真实 SQL 后只返回匹配用户。
    @Test
    @Sql("/fixtures/UniauthUserGetStoreRealDatabaseTest/filter.sql")
    void filter() {
        UniauthUserRealDatabaseTestVerifier.verifyGetStoreFilter(uniauthUserService, jdbcTemplate);
    }

    // emptyPage Case 验证越过最后一页时列表为空但真实总数仍然准确。
    @Test
    @Sql("/fixtures/UniauthUserGetStoreRealDatabaseTest/emptyPage.sql")
    void emptyPage() {
        UniauthUserRealDatabaseTestVerifier.verifyGetStoreEmptyPage(uniauthUserService);
    }
}
