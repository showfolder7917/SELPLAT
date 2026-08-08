package com.sp.selplat.mda.common.persistence;

import com.sp.selplat.mda.common.persistence.support.MdaControlSchemaTestVerifier;
import org.junit.jupiter.api.Test;

/**
 * MDA 控制库 SQL 测试验证新库初始化、重复执行和旧 identity 库升级均保持真实数据安全。
 */
class MdaControlSchemaMigrationTest {

    /**
     * freshInitialization Case 验证空数据库首次执行后形成普通主键和唯一 MDA 号段。
     */
    @Test
    void freshInitialization() {
        MdaControlSchemaTestVerifier.verifyFreshInitialization(
            "fixtures/MdaControlSchemaMigrationTest/freshInitialization.sql"
        );
    }

    /**
     * repeatedInitialization Case 验证 schema 与 data 脚本重复执行不会重置号段或产生重复配置。
     */
    @Test
    void repeatedInitialization() {
        MdaControlSchemaTestVerifier.verifyRepeatedInitialization(
            "fixtures/MdaControlSchemaMigrationTest/repeatedInitialization.sql"
        );
    }

    /**
     * legacyUpgrade Case 验证旧 identity 主键转换后保留原连接记录并补充 MDA 号段。
     */
    @Test
    void legacyUpgrade() {
        MdaControlSchemaTestVerifier.verifyLegacyUpgrade(
            "fixtures/MdaControlSchemaMigrationTest/legacyUpgrade.sql"
        );
    }
}
