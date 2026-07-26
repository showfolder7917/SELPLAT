package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.dao.support.BaseDaoImplRealDatabaseTestVerifier;
import org.junit.jupiter.api.Test;

// BaseDaoImpl 真实数据库测试按公开生产方法拆分 Case，每个测试方法只调用一次验证器。
class BaseDaoImplRealDatabaseTest {

    // getIdSequenceDefinitionSingleId Case 验证真实主键元数据生成独立号段定义。
    @Test
    void getIdSequenceDefinitionSingleId() {
        BaseDaoImplRealDatabaseTestVerifier.verifyGetIdSequenceDefinition("fixtures/BaseDaoImplRealDatabaseTest/getIdSequenceDefinitionSingleId.sql");
    }

    // getPageListDefaultSortnum Case 验证默认分页执行真实 sortnum 倒序 SQL。
    @Test
    void getPageListDefaultSortnum() {
        BaseDaoImplRealDatabaseTestVerifier.verifyGetPageList("fixtures/BaseDaoImplRealDatabaseTest/getPageListDefaultSortnum.sql");
    }

    // getByIdFound Case 验证公共主键查询不添加业务状态条件。
    @Test
    void getByIdFound() {
        BaseDaoImplRealDatabaseTestVerifier.verifyGetById("fixtures/BaseDaoImplRealDatabaseTest/getByIdFound.sql");
    }

    // getByIdCompositeKey Case 验证同一个 CommonParam 中的复合主键共同进入真实 SQL。
    @Test
    void getByIdCompositeKey() {
        BaseDaoImplRealDatabaseTestVerifier.verifyGetByIdComposite("fixtures/BaseDaoImplRealDatabaseTest/getByIdCompositeKey.sql");
    }

    // getByQueryFound Case 验证 CommonParam 条件真实进入公共查询 SQL。
    @Test
    void getByQueryFound() {
        BaseDaoImplRealDatabaseTestVerifier.verifyGetByQuery("fixtures/BaseDaoImplRealDatabaseTest/getByQueryFound.sql");
    }

    // insertNormal Case 验证 CommonParam 通过真实注解式模板 SQL 新增记录。
    @Test
    void insertNormal() {
        BaseDaoImplRealDatabaseTestVerifier.verifyInsert("fixtures/BaseDaoImplRealDatabaseTest/insertNormal.sql");
    }

    // updateNormal Case 验证主键和更新字段通过真实注解式模板 SQL 正确分离。
    @Test
    void updateNormal() {
        BaseDaoImplRealDatabaseTestVerifier.verifyUpdate("fixtures/BaseDaoImplRealDatabaseTest/updateNormal.sql");
    }

    // softDeleteNormal Case 验证公共逻辑删除真实更新状态和审计字段。
    @Test
    void softDeleteNormal() {
        BaseDaoImplRealDatabaseTestVerifier.verifySoftDelete("fixtures/BaseDaoImplRealDatabaseTest/softDeleteNormal.sql");
    }

    // batchCrudInThousandItemGroups Case 使用一千零一条真实记录验证查询、新增、更新和假删除跨越两个分组。
    @Test
    void batchCrudInThousandItemGroups() {
        BaseDaoImplRealDatabaseTestVerifier.verifyBatchCrudInThousandItemGroups("fixtures/BaseDaoImplRealDatabaseTest/batchCrudInThousandItemGroups.sql");
    }

    // emptyInput Case 验证主键和动态查询空参数在 SQL 前被公共门面安全收口。
    @Test
    void emptyInput() {
        BaseDaoImplRealDatabaseTestVerifier.verifyEmptyInput("fixtures/BaseDaoImplRealDatabaseTest/emptyInput.sql");
    }

    // queryNotFound Case 验证真实分页没有记录时动态单条查询返回空。
    @Test
    void queryNotFound() {
        BaseDaoImplRealDatabaseTestVerifier.verifyQueryNotFound("fixtures/BaseDaoImplRealDatabaseTest/queryNotFound.sql");
    }
}
