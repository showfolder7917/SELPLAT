package com.sp.selplat.referencedata.backend.common.persistence;

import java.util.function.Supplier;
import javax.sql.DataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 保存 reference-data 独立数据库的 JDBC 与事务入口。
 * 本对象不注册成平台主 {@code DataSource}，因此不会覆盖 Host 中 Uniauth 自己的数据源配置。
 */
public class ReferenceDataDatabase {

    // jdbcTemplate 只连接 reference-data 永久文件库，供本模块 Repository 执行受控 SQL。
    private final JdbcTemplate jdbcTemplate;
    private final DataSource dataSource;
    // transactionTemplate 只管理 reference-data 文件库事务，不影响 Host 中其他模块的事务管理器。
    private final TransactionTemplate transactionTemplate;

    /**
     * 建立 reference-data 独立数据库访问上下文。
     *
     * @param jdbcTemplate 已绑定永久文件库的 JDBC 模板，例如连接 {@code apps/reference-data/db/data/reference-data}
     * @param transactionTemplate 使用同一个文件库数据源的事务模板
     * 执行结果示例：Repository 查询和写入均进入 reference-data 数据库，不会进入 Uniauth 数据库。
     */
    public ReferenceDataDatabase(
            DataSource dataSource,
            JdbcTemplate jdbcTemplate,
            TransactionTemplate transactionTemplate) {
        this.dataSource = dataSource;
        // 同一数据源的查询与事务入口 → reference-data 模块稳定数据库上下文。
        this.jdbcTemplate = jdbcTemplate;
        this.transactionTemplate = transactionTemplate;
    }

    /**
     * 返回 reference-data 独立永久库数据源。
     *
     * @return 只连接 apps/reference-data/db/data/reference-data 的数据源
     */
    public DataSource dataSource() {
        return dataSource;
    }

    /**
     * 返回 reference-data 专用 JDBC 模板。
     *
     * @return 已绑定独立文件库的 {@link JdbcTemplate}
     */
    public JdbcTemplate jdbcTemplate() {
        // Repository 只取得已隔离的模板，不接触 Host 主 DataSource。
        return jdbcTemplate;
    }

    /**
     * 在 reference-data 独立数据库事务内执行一个完整业务动作。
     *
     * @param action Service 或 Repository 传入的数据库动作，例如新增类型后查询最终记录
     * @param <T> 业务动作最终返回类型，例如 {@code Map<String,Object>}
     * @return 事务提交后的实际结果，例如 {@code {"id":1,"projectCode":"cms"}}
     */
    public <T> T inTransaction(Supplier<T> action) {
        // 同一业务动作 → 由 reference-data 专用事务管理器统一提交或回滚。
        return transactionTemplate.execute(status -> action.get());
    }
}
