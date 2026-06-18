package com.sp.selplat.common.db.dialect;

import com.sp.selplat.common.db.config.DatabaseType;
import java.util.EnumMap;
import java.util.Map;

/**
 * 数据库方言工厂统一维护数据库类型到方言实现的固定映射关系。
 * 这里把方言选择逻辑集中收口，是为了避免执行器、校验器和 SQL 构建器各自重复判断数据库类型。
 */
public class DatabaseDialectFactory {

    // DIALECT_MAP 固定缓存系统内置支持的数据库方言，避免每次查询时重复创建方言对象。
    private static final Map<DatabaseType, DatabaseDialect> DIALECT_MAP = buildDialectMap();

    /**
     * 根据数据库类型获取方言实现。
     *
     * @param databaseType 数据库类型
     * @return 数据库方言
     */
    public DatabaseDialect getDialect(DatabaseType databaseType) {
        // 没有数据库类型时直接拒绝继续处理，避免底层在 SQL 方言上出现不确定行为。
        if (databaseType == null) {
            throw new IllegalArgumentException("databaseType must not be null");
        }
        // 先从固定映射里获取方言，保证所有调用方都复用同一套类型到实现的绑定关系。
        DatabaseDialect dialect = DIALECT_MAP.get(databaseType);
        // 当前类型没有内置方言时直接报错，提醒调用方补齐支持实现而不是静默降级。
        if (dialect == null) {
            throw new IllegalArgumentException("unsupported databaseType: " + databaseType);
        }
        // 返回命中的方言实现，供上层统一生成分页、计数和 like 规则。
        return dialect;
    }

    /**
     * 构建数据库方言固定映射。
     *
     * @return 数据库方言固定映射
     */
    private static Map<DatabaseType, DatabaseDialect> buildDialectMap() {
        // 使用枚举映射承接固定数据库类型集合，保证方言缓存结构清晰且访问开销较低。
        Map<DatabaseType, DatabaseDialect> dialectMap = new EnumMap<>(DatabaseType.class);
        // H2 方言用于本地联调和内存库场景，先注册到固定映射中。
        dialectMap.put(DatabaseType.H2, new H2Dialect());
        // MySQL 方言用于常见业务库场景，注册后供运行期统一分发。
        dialectMap.put(DatabaseType.MYSQL, new MySqlDialect());
        // SQL Server 方言用于微软数据库生态场景，注册后供分页和 like 规则复用。
        dialectMap.put(DatabaseType.SQLSERVER, new SqlServerDialect());
        // Oracle 方言用于传统企业数据库场景，注册后供通用查询链路分发。
        dialectMap.put(DatabaseType.ORACLE, new OracleDialect());
        // PostgreSQL 方言用于 PostgreSQL 生态数据库场景，注册后供运行期统一选择。
        dialectMap.put(DatabaseType.POSTGRESQL, new PostgreSqlDialect());
        // 返回固定映射结果，供静态缓存字段在类加载时完成一次性初始化。
        return dialectMap;
    }
}
