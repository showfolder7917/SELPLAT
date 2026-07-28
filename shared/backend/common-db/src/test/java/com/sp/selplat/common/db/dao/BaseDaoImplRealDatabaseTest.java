package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.dao.support.BaseDaoImplRealDatabaseTestVerifier;
import org.junit.jupiter.api.Test;

/**
 * BaseDaoImpl 真实数据库测试按公开生产方法拆分 Case，每个测试方法只调用一次验证器。
 */
class BaseDaoImplRealDatabaseTest {

    /**
     * getIdSequenceDefinitionSingleId Case 验证真实主键元数据生成独立号段定义。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void getIdSequenceDefinitionSingleId() {
        BaseDaoImplRealDatabaseTestVerifier.verifyGetIdSequenceDefinition("fixtures/BaseDaoImplRealDatabaseTest/getIdSequenceDefinitionSingleId.sql");
    }

    /**
     * getPageListDefaultSortnum Case 验证默认分页执行真实 sortnum 倒序 SQL。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void getPageListDefaultSortnum() {
        BaseDaoImplRealDatabaseTestVerifier.verifyGetPageList("fixtures/BaseDaoImplRealDatabaseTest/getPageListDefaultSortnum.sql");
    }

    /**
     * getByIdFound Case 验证公共主键查询不添加业务状态条件。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void getByIdFound() {
        BaseDaoImplRealDatabaseTestVerifier.verifyGetById("fixtures/BaseDaoImplRealDatabaseTest/getByIdFound.sql");
    }

    /**
     * getByIdCompositeKey Case 验证同一个 CommonParam 中的复合主键共同进入真实 SQL。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void getByIdCompositeKey() {
        BaseDaoImplRealDatabaseTestVerifier.verifyGetByIdComposite("fixtures/BaseDaoImplRealDatabaseTest/getByIdCompositeKey.sql");
    }

    /**
     * getByQueryFound Case 验证 CommonParam 条件真实进入公共查询 SQL。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void getByQueryFound() {
        BaseDaoImplRealDatabaseTestVerifier.verifyGetByQuery("fixtures/BaseDaoImplRealDatabaseTest/getByQueryFound.sql");
    }

    /**
     * insertNormal Case 验证 CommonParam 通过真实注解式模板 SQL 新增记录。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void insertNormal() {
        BaseDaoImplRealDatabaseTestVerifier.verifyInsert("fixtures/BaseDaoImplRealDatabaseTest/insertNormal.sql");
    }

    /**
     * databaseColumnsAndWriteFieldSafety Case 验证写入字段只来自真实数据库 Map，缺省列保留数据库默认值。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void databaseColumnsAndWriteFieldSafety() {
        BaseDaoImplRealDatabaseTestVerifier.verifyDatabaseColumnsAndWriteFieldSafety(
            "fixtures/BaseDaoImplRealDatabaseTest/databaseColumnsAndWriteFieldSafety.sql"
        );
    }

    /**
     * updateNormal Case 验证主键和更新字段通过真实注解式模板 SQL 正确分离。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void updateNormal() {
        BaseDaoImplRealDatabaseTestVerifier.verifyUpdate("fixtures/BaseDaoImplRealDatabaseTest/updateNormal.sql");
    }

    /**
     * softDeleteNormal Case 验证公共逻辑删除真实更新状态和审计字段。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void softDeleteNormal() {
        BaseDaoImplRealDatabaseTestVerifier.verifySoftDelete("fixtures/BaseDaoImplRealDatabaseTest/softDeleteNormal.sql");
    }

    /**
     * compositeKeyWriteChain Case 验证复合主键单条更新、批量更新和批量假删除均使用全部主键。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void compositeKeyWriteChain() {
        BaseDaoImplRealDatabaseTestVerifier.verifyCompositeKeyWriteChain(
            "fixtures/BaseDaoImplRealDatabaseTest/compositeKeyWriteChain.sql"
        );
    }

    /**
     * batchCrudInThousandItemGroups Case 使用一千零一条真实记录验证查询、新增、更新和假删除跨越两个分组。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void batchCrudInThousandItemGroups() {
        BaseDaoImplRealDatabaseTestVerifier.verifyBatchCrudInThousandItemGroups(
            "fixtures/BaseDaoImplRealDatabaseTest/batchCrudInThousandItemGroups.sql"
        );
    }

    /**
     * emptyInput Case 验证主键和动态查询空参数在 SQL 前被公共门面安全收口。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void emptyInput() {
        BaseDaoImplRealDatabaseTestVerifier.verifyEmptyInput("fixtures/BaseDaoImplRealDatabaseTest/emptyInput.sql");
    }

    /**
     * queryNotFound Case 验证真实分页没有记录时动态单条查询返回空。
     *
     * <p>执行结果示例：当前真实数据库或结构 Case 的全部验证通过。</p>
     */
    @Test
    void queryNotFound() {
        BaseDaoImplRealDatabaseTestVerifier.verifyQueryNotFound("fixtures/BaseDaoImplRealDatabaseTest/queryNotFound.sql");
    }
}
