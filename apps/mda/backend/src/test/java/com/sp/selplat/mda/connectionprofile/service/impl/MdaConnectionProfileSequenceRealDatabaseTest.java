package com.sp.selplat.mda.connectionprofile.service.impl;

import com.sp.selplat.mda.MdaBackendApplication;
import com.sp.selplat.mda.connectionprofile.service.MdaConnectionProfileService;
import com.sp.selplat.mda.connectionprofile.service.impl.support.MdaConnectionProfileSequenceTestVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.SqlConfig;

/**
 * 使用隔离 MDA 控制库验证单条与批量连接新增统一采用项目号段和公共 Base Service 链路。
 * 本测试不读取或写入 {@code apps/mda/db/mda.mv.db} 正式开发库。
 */
@SpringBootTest(
    classes = MdaBackendApplication.class,
    properties = {
        "mda.control.datasource.jdbc-url=jdbc:h2:mem:mda_sequence_real_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
        "mda.control.datasource.password="
    })
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class MdaConnectionProfileSequenceRealDatabaseTest {

    // 真实业务 Service 贯穿字段规范化、公共发号、Base DAO 与 MDA 控制库。
    @Autowired
    private MdaConnectionProfileService connectionProfileService;
    // 具名查询模板只读取当前隔离 MDA 控制库的最终状态。
    @Autowired
    @Qualifier("mdaControlJdbcTemplate")
    private JdbcTemplate controlJdbc;

    /**
     * singleAndBatchInsertUseMdaSequence Case 验证连续主键、游标推进和非 identity 表结构。
     */
    @Test
    @Sql(
        scripts = "/fixtures/MdaConnectionProfileSequenceRealDatabaseTest/singleAndBatchInsertUseMdaSequence.sql",
        config = @SqlConfig(
            dataSource = "mdaControlDataSource",
            transactionManager = "mdaTransactionManager"))
    void singleAndBatchInsertUseMdaSequence() {
        MdaConnectionProfileSequenceTestVerifier.verifySingleAndBatchInsert(
            connectionProfileService,
            controlJdbc
        );
    }
}
