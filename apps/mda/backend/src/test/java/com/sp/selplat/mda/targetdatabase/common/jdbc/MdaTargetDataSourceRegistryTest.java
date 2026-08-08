package com.sp.selplat.mda.targetdatabase.common.jdbc;

import static org.assertj.core.api.Assertions.assertThat;

import com.sp.selplat.mda.targetdatabase.common.config.MdaTargetPoolProperties;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import org.junit.jupiter.api.Test;

/**
 * 使用真实 H2 连接验证同一目标定义复用物理连接，并在注册表闲置后关闭整个池。
 */
class MdaTargetDataSourceRegistryTest {

    @Test
    void shouldReuseTargetPoolAndDisposeItAfterIdleTimeout() throws Exception {
        MdaTargetPoolProperties properties = new MdaTargetPoolProperties();
        properties.setMaximumPoolSize(1);
        properties.setRegistryIdleTimeoutMs(0L);
        MdaTargetDataSourceRegistry registry = new MdaTargetDataSourceRegistry(
                new JdbcDriverRegistry(), properties);
        MdaConnectionDefinition definition = new MdaConnectionDefinition(
                "H2", null, null, "mem:mda_pool_reuse;DB_CLOSE_DELAY=-1",
                "PUBLIC", "sa", "", null, null, true);

        try (registry) {
            long firstSessionId;
            try (Connection connection = registry.borrow(definition);
                    Statement statement = connection.createStatement();
                    ResultSet resultSet = statement.executeQuery("CALL SESSION_ID()")) {
                resultSet.next();
                firstSessionId = resultSet.getLong(1);
            }

            long secondSessionId;
            try (Connection connection = registry.borrow(definition);
                    Statement statement = connection.createStatement();
                    ResultSet resultSet = statement.executeQuery("CALL SESSION_ID()")) {
                resultSet.next();
                secondSessionId = resultSet.getLong(1);
            }

            assertThat(secondSessionId).isEqualTo(firstSessionId);
            assertThat(registry.activePoolCount()).isEqualTo(1);
            assertThat(registry.closeIdlePools()).isEqualTo(1);
            assertThat(registry.activePoolCount()).isZero();
        }
    }
}
