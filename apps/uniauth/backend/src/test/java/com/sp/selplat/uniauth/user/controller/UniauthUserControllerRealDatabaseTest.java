package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.uniauth.UniauthBackendApplication;
import com.sp.selplat.uniauth.user.controller.support.UniauthUserControllerTestVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

// 用户控制器真实数据库测试启动完整应用上下文，验证 Controller、Service、DAO、SQL 与数据库完整生产链路。
@SpringBootTest(classes = UniauthBackendApplication.class)
@Transactional
class UniauthUserControllerRealDatabaseTest {

    /**
     * 注入容器中的真实用户控制器，禁止创建控制器实例或替换业务 Service。
     */
    @Autowired
    private UniauthUserController uniauthUserController;
    /**
     * 独立数据库查询用于核对控制器调用后的真实表状态。
     */
    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * publicMethodResponses Case 使用一个隔离 fixture 覆盖十个公开入口的真实响应和数据库变化。
     */
    @Test
    @DirtiesContext(methodMode = DirtiesContext.MethodMode.AFTER_METHOD)
    @Sql("/fixtures/UniauthUserControllerRealDatabaseTest/publicMethodResponses.sql")
    void publicMethodResponses() {
        // 当前测试方法只调用一次验证器，所有业务输入和数据库断言集中在同类验证器中。
        UniauthUserControllerTestVerifier.verifyRealPublicMethodResponses(uniauthUserController, jdbcTemplate);
    }
}
