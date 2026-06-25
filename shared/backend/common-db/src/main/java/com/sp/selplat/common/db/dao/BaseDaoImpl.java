package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.domain.CommonEntity;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Autowired;

// 公共 DAO 基类直接桥接 BaseTemplateDao，让简单主数据模块只配置表信息就能复用通用 CRUD。
public abstract class BaseDaoImpl extends BaseDaoImplExtends {

    // dataSource 承接当前模块实际使用的数据源，供公共 DAO 直接读取目标表的真实字段结构。
    @Autowired
    private DataSource dataSource;

    // SELECT_COLUMNS_CACHE 缓存每个物理表已经解析完成的可查询字段串，避免每次列表查询都重复扫元数据。
    private static final Map<String, String> SELECT_COLUMNS_CACHE = new ConcurrentHashMap<>();

    // 子类必须明确当前公共 DAO 的主键列名，供更新和删除按唯一标识命中目标记录。
    protected String getId() {
        // 公共基类默认沿用通用实体主键字段定义，让简单单表 DAO 不必重复声明同一主键名。
        CommonEntity ce = new CommonEntity();
        // 返回平台约定的默认主键字段，供模板更新、删除和详情查询统一定位目标记录。
        return ce.getKey();
    }

    // 默认查询列清单改成从数据库元数据动态生成，避免业务 DAO 再把完整 select 字段写死在 Java 常量里。
    protected String getSelectColumns() {
        // 当前表已经缓存过列清单时直接复用，保证同一个 DAO 在一次进程生命周期内稳定复用同一份字段顺序。
        return SELECT_COLUMNS_CACHE.computeIfAbsent(getTableName(), this::loadSelectColumnsFromMetadata);
    }

    // 子类可按业务需要声明不允许对外查询的敏感字段，避免动态全字段方案把口令等列直接暴露出去。
    protected Set<String> getExcludedSelectColumns() {
        // 公共基类默认不过滤任何字段，交给需要保护敏感列的具体业务 DAO 按表补充排除规则。
        return Set.of();
    }

    // 从当前数据源的真实表结构中读取字段顺序，并组装成模板 DAO 可以直接拼接的 select 列串。
    private String loadSelectColumnsFromMetadata(String tableName) {
        // 没有注入数据源时直接拒绝处理，避免公共 DAO 在运行期静默退化成非法查询。
        if (dataSource == null) {
            throw new IllegalStateException("dataSource must not be null");
        }
        // excludedColumns 承接当前业务 DAO 明确声明的敏感字段排除清单，后续字段扫描会按同一口径过滤。
        Set<String> excludedColumns = getExcludedSelectColumns();
        // columnNames 保留数据库返回的字段顺序，保证列表输出列顺序与表定义顺序保持一致。
        List<String> columnNames = new ArrayList<>();
        // 通过当前真实数据源获取连接并读取 JDBC 元数据，保证字段清单来自实际运行数据库而不是代码常量。
        try (Connection connection = dataSource.getConnection()) {
            // 获取 JDBC 元数据对象，供后续按表扫描真实字段集合。
            DatabaseMetaData metaData = connection.getMetaData();
            // 按当前表名读取所有字段元数据，保证公共 DAO 只会拼接目标业务表真实存在的列。
            try (ResultSet resultSet = metaData.getColumns(connection.getCatalog(), connection.getSchema(), tableName, null)) {
                // 逐行读取字段名，并在进入列清单前统一套用业务 DAO 的敏感字段排除规则。
                while (resultSet.next()) {
                    // columnName 承接当前物理字段名，供后续过滤和最终 select 串拼接复用。
                    String columnName = resultSet.getString("COLUMN_NAME");
                    // 当前字段没有命中排除名单时才允许进入公共查询列清单，避免敏感列被默认 select 出去。
                    if (!excludedColumns.contains(columnName)) {
                        // 按数据库元数据原始顺序记录允许查询的字段名，保证前端列表列顺序稳定。
                        columnNames.add(columnName);
                    }
                }
            }
        } catch (SQLException exception) {
            // 读取字段元数据失败时统一中止，避免公共 DAO 在列清单不完整时继续执行查询。
            throw new IllegalStateException("failed to load select columns: " + tableName, exception);
        }
        // 数据库没有返回任何允许查询字段时直接拒绝处理，避免模板 DAO 拼出空 select 子句。
        if (columnNames.isEmpty()) {
            throw new IllegalStateException("no selectable columns found for table: " + tableName);
        }
        // 把字段集合按逗号拼成模板 DAO 需要的 select 列串，供后续列表和详情查询直接复用。
        return columnNames.stream().collect(Collectors.joining(", "));
    }
}
