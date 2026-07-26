package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.uniauth.UniauthBackendApplication;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

// 用户真实数据库测试基类只提供完整 Spring 上下文、事务隔离和真实业务依赖，具体 Case 仍按生产方法拆到独立测试类。
@SpringBootTest(classes = UniauthBackendApplication.class)
@Transactional
abstract class AbstractUniauthUserRealDatabaseTest {

    // 真实用户服务贯穿 Service、BaseDao、注解式模板 SQL 与数据库链路，所有方法 Case 共用这一生产入口。
    @Autowired
    protected UniauthUserService uniauthUserService;
    // 真实 JdbcTemplate 独立读取数据库最终状态，避免测试验证器复制被测 DAO 的返回结果。
    @Autowired
    protected JdbcTemplate jdbcTemplate;
}
