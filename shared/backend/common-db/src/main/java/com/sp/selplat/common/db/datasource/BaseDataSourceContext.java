package com.sp.selplat.common.db.datasource;

import com.sp.selplat.common.db.template.BaseTemplateDao;
import java.util.Objects;
import javax.sql.DataSource;

/**
 * 绑定基础 DAO 一次数据库访问所需的数据源与模板 DAO。
 * 每个业务项目负责创建自己的上下文，公共 DAO 不再猜测或自动注入宿主默认数据源。
 */
public final class BaseDataSourceContext {

    // dataSource 提供当前项目真实连接，供元数据、动态查询和 JDBC 批处理使用。
    private final DataSource dataSource;
    // baseTemplateDao 必须绑定同一数据源对应的 Mapper 与 JDBC 模板，避免 SQL 和元数据跨库。
    private final BaseTemplateDao baseTemplateDao;

    /**
     * 创建同一项目、同一数据库的基础访问上下文。
     *
     * @param dataSource 当前项目数据源，例如 Uniauth 使用的 H2 或生产业务数据源
     * @param baseTemplateDao 使用同一数据源和 MyBatis 会话创建的公共模板 DAO
     * 执行结果示例：{@code new BaseDataSourceContext(uniauthDataSource, uniauthBaseTemplateDao)}
     * @throws NullPointerException 任一依赖为空时抛出，例如 {@code NullPointerException("dataSource must not be null")}
     */
    public BaseDataSourceContext(DataSource dataSource, BaseTemplateDao baseTemplateDao) {
        // 数据源不能为空，防止公共 DAO 在首次查询时才出现难以定位的连接错误。
        this.dataSource = Objects.requireNonNull(dataSource, "dataSource must not be null");
        // 模板 DAO 不能为空，并由项目装配层保证它和 dataSource 属于同一个数据库上下文。
        this.baseTemplateDao = Objects.requireNonNull(baseTemplateDao, "baseTemplateDao must not be null");
    }

    /**
     * 返回当前项目数据源。
     *
     * @return 项目注入的数据源，例如 {@code HikariDataSource}
     */
    public DataSource getDataSource() {
        // 返回构造时已经校验的数据源，供元数据和 JDBC 查询复用。
        return dataSource;
    }

    /**
     * 返回与当前项目数据源绑定的模板 DAO。
     *
     * @return 项目模板 DAO，例如使用 Uniauth MyBatis 会话的 {@code BaseTemplateDao}
     */
    public BaseTemplateDao getBaseTemplateDao() {
        // 返回构造时已经校验的模板 DAO，供公共单条和批量写入复用。
        return baseTemplateDao;
    }
}
