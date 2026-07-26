package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.uniauth.user.service.impl.support.UniauthUserRealDatabaseTestVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

// 用户批量真实数据库测试按公开批量方法拆分 Case，数据目录和文件名直接对应当前测试类与方法。
class UniauthUserBatchRealDatabaseTest extends AbstractUniauthUserRealDatabaseTest {

    // getByIds Case 验证多主键通过公共 DAO 一次批量读取真实用户。
    @Test
    @Sql("/fixtures/UniauthUserBatchRealDatabaseTest/getByIds.sql")
    void getByIds() {
        // 当前方法只调用一次验证器，批量参数和数据库断言在验证器中完成。
        UniauthUserRealDatabaseTestVerifier.verifyBatchGetByIds(uniauthUserService);
    }

    // insertBatch Case 验证批量发号、密码摘要和真实 JDBC batch 新增。
    @Test
    @DirtiesContext(methodMode = DirtiesContext.MethodMode.AFTER_METHOD)
    @Sql("/fixtures/UniauthUserBatchRealDatabaseTest/insertBatch.sql")
    void insertBatch() {
        // 当前方法只调用一次验证器，保持 fixture 与 Case 一一对应。
        UniauthUserRealDatabaseTestVerifier.verifyBatchInsert(uniauthUserService, jdbcTemplate);
    }

    // insertBatchRollback Case 验证批量中任一记录违反真实唯一约束时整批事务回滚。
    @Test
    @DirtiesContext(methodMode = DirtiesContext.MethodMode.AFTER_METHOD)
    @Sql("/fixtures/UniauthUserBatchRealDatabaseTest/insertBatchRollback.sql")
    // 当前 Case 关闭测试外层事务，让生产 Service 自己开启并完成回滚后再检查数据库最终状态。
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void insertBatchRollback() {
        // 当前方法只调用一次验证器，异常触发和回滚后的表状态检查由验证器集中完成。
        UniauthUserRealDatabaseTestVerifier.verifyBatchInsertRollback(uniauthUserService, jdbcTemplate);
    }

    // updateBatch Case 验证不同更新字段结构仍进入真实 JDBC batch。
    @Test
    @Sql("/fixtures/UniauthUserBatchRealDatabaseTest/updateBatch.sql")
    void updateBatch() {
        // 当前方法只调用一次验证器，更新结果由独立 JDBC 查询核对。
        UniauthUserRealDatabaseTestVerifier.verifyBatchUpdate(uniauthUserService, jdbcTemplate);
    }

    // deleteBatch Case 验证批量入口只执行真实假删除。
    @Test
    @Sql("/fixtures/UniauthUserBatchRealDatabaseTest/deleteBatch.sql")
    void deleteBatch() {
        // 当前方法只调用一次验证器，状态与记录保留结果由数据库断言确认。
        UniauthUserRealDatabaseTestVerifier.verifyBatchDelete(uniauthUserService, jdbcTemplate);
    }
}
