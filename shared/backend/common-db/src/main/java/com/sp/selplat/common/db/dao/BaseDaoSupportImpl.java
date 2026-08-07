package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.datasource.CommonDbSource;
import com.sp.selplat.common.db.datasource.CommonDbSourceResolver;
import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import com.sp.selplat.common.db.datasource.dialect.DatabaseDialectFactory;
import com.sp.selplat.common.db.metadata.model.ColumnMetadata;
import com.sp.selplat.common.db.metadata.DatabaseMetadataReader;
import com.sp.selplat.common.db.metadata.DefaultDatabaseMetadataReader;
import com.sp.selplat.common.db.query.CommonQueryExecutor;
import com.sp.selplat.common.db.query.CommonQuerySqlBuilder;
import com.sp.selplat.common.db.query.CommonQueryValidator;
import com.sp.selplat.common.db.query.DefaultCommonQueryExecutor;
import com.sp.selplat.common.db.query.DefaultCommonQuerySqlBuilder;
import com.sp.selplat.common.db.query.DefaultCommonQueryValidator;
import com.sp.selplat.common.db.sequence.model.IdSequenceDefinition;
import com.sp.selplat.common.db.template.BaseTemplateDao;
import com.sp.selplat.common.util.CommonParam;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.util.ClassUtils;

/**
 * 为基础 DAO 继承链提供受控表名、真实数据库元数据、主键号段和动态查询组件。
 * 本层不公开业务 CRUD，也不允许前端直接提供 SQL 表名或列名。
 */
public abstract class BaseDaoSupportImpl {

    // COMMON_DB_SOURCE_RESOLVER 复用 config 层的数据源上下文解析能力，让 DAO 不再自己识别数据库类型。
    private static final CommonDbSourceResolver COMMON_DB_SOURCE_RESOLVER = new CommonDbSourceResolver();
    // METADATA_READER 复用 common-db 已有的元数据读取实现，让支撑层不再旁路新建一套字段查询逻辑。
    private static final DatabaseMetadataReader METADATA_READER = new DefaultDatabaseMetadataReader();
    // COMMON_QUERY_VALIDATOR 统一校验动态查询对象，避免分页、排序和条件字段绕开受控边界。
    private static final CommonQueryValidator COMMON_QUERY_VALIDATOR = new DefaultCommonQueryValidator(METADATA_READER);
    // COMMON_QUERY_SQL_BUILDER 统一生成多数据库动态查询 SQL，让分页逻辑继续收口在方言查询链路里。
    private static final CommonQuerySqlBuilder COMMON_QUERY_SQL_BUILDER =
        new DefaultCommonQuerySqlBuilder(COMMON_QUERY_VALIDATOR, new DatabaseDialectFactory());
    // COMMON_QUERY_EXECUTOR 统一执行动态查询 SQL，供分页和方言差异查询复用同一 JDBC 执行链路。
    private static final CommonQueryExecutor COMMON_QUERY_EXECUTOR = new DefaultCommonQueryExecutor(COMMON_QUERY_SQL_BUILDER);

    /**
     * 由当前业务项目返回已经绑定的数据源上下文。
     *
     * @return 项目上下文，例如 Uniauth 返回
     *     {@code new BaseDataSourceContext(uniauthDataSource, uniauthBaseTemplateDao)}
     */
    protected abstract BaseDataSourceContext getDataSourceContext();

    /**
     * 返回当前项目上下文中的真实数据源。
     *
     * @return 当前项目数据源，例如 {@code HikariDataSource}
     * @throws IllegalStateException 项目没有提供上下文时抛出，例如
     *     {@code IllegalStateException("BaseDataSourceContext must be provided by project DAO")}
     */
    protected final DataSource getDataSource() {
        // 先要求业务项目显式提供上下文，公共层不再回退到宿主默认数据源。
        BaseDataSourceContext context = requireDataSourceContext();
        // 返回上下文绑定的数据源，供元数据和动态 JDBC 查询使用。
        return context.getDataSource();
    }

    /**
     * 返回与当前项目数据源成对绑定的模板 DAO。
     *
     * @return 当前项目模板 DAO，例如 Uniauth 的公共模板 DAO 实例
     */
    protected final BaseTemplateDao getBaseTemplateDao() {
        // 从同一个项目上下文读取模板 DAO，防止 Mapper 和元数据访问不同数据库。
        return requireDataSourceContext().getBaseTemplateDao();
    }

    /**
     * 校验项目 DAO 是否已经提供数据源上下文。
     *
     * @return 非空项目上下文
     * @throws IllegalStateException 子类返回空上下文时抛出，例如
     *     {@code IllegalStateException("BaseDataSourceContext must be provided by project DAO")}
     */
    private BaseDataSourceContext requireDataSourceContext() {
        // 调用项目实现取得上下文，Base 层不感知具体 Bean 名称或配置属性。
        BaseDataSourceContext context = getDataSourceContext();
        // 空上下文表示项目没有完成数据源边界装配，必须在执行 SQL 前阻断。
        if (context == null) {
            throw new IllegalStateException("BaseDataSourceContext must be provided by project DAO");
        }
        // 返回经过校验的项目上下文。
        return context;
    }

    /**
     * 解析当前 DAO 使用的数据库上下文。
     *
     * @return 实际返回示例：
     *     {@code {"sourceKey":"H2","databaseType":"H2","dataSource":"org.h2.jdbcx.JdbcDataSource",}
     *     {@code "catalogName":"运行时随机UUID","schemaName":"PUBLIC"}}
     */
    protected CommonDbSource resolveCurrentDbSource() {
        // 解析注入的数据源 → 可供元数据、方言和查询链路复用的数据库上下文。
        return COMMON_DB_SOURCE_RESOLVER.resolve(getDataSource());
    }

    /**
     * 读取当前 DAO 对应表的主键字段。
     *
     * @return 真实主键列，例如单主键 {@code ["id"]} 或复合主键 {@code ["id","tenantId"]}
     * @throws IllegalStateException 当当前表没有主键元数据时抛出，例如
     *     {@code IllegalStateException("no primary keys found for table: UniauthUser")}
     */
    protected List<String> getPrimaryKeyColumnNameList() {
        // 解析当前表名 → "UniauthUser"。
        String tableName = getTableName();
        // 解析当前数据库上下文 → H2、运行时 catalog 和 PUBLIC schema 等真实连接信息。
        CommonDbSource commonDbSource = COMMON_DB_SOURCE_RESOLVER.resolve(getDataSource());
        // 读取 "UniauthUser" 的主键列名 → ["id", "tenantId"]。
        List<String> idColumnList = METADATA_READER.listPrimaryKeys(commonDbSource, tableName);
        // 表没有主键时停止，防止后续更新或删除缺少主键条件。
        if (idColumnList == null || idColumnList.isEmpty()) {
            throw new IllegalStateException("no primary keys found for table: " + tableName);
        }
        // 输出主键列名列表 → ["id", "tenantId"]，供查询、更新和删除构造条件。
        return idColumnList;
    }

    /**
     * 按 DAO 实现类命名约定解析当前表名。
     *
     * @return 表名，例如 {@code "UniauthUser"}
     * @throws IllegalStateException 当 DAO 类名不以 {@code DaoImpl} 结尾时抛出，例如
     *     {@code IllegalStateException("DAO类名不符合约定: InvalidDao")}
     */
    protected String getTableName() {
        // 获取代理背后的 DAO 实现类 → "UniauthUserDaoImpl"。
        Class<?> userClass = ClassUtils.getUserClass(this);
        // 读取 DAO 简类名 → "UniauthUserDaoImpl"。
        String simpleName = userClass.getSimpleName();
        // DAO 类名不以 "DaoImpl" 结尾时停止，防止 SQL 指向错误表。
        if (!simpleName.endsWith("DaoImpl")) {
            throw new IllegalStateException("DAO类名不符合约定: " + simpleName);
        }
        // 去除 "DaoImpl" 后缀 → "UniauthUser"。
        return simpleName.substring(0, simpleName.length() - "DaoImpl".length());
    }

    /**
     * 为当前表的每个主键列构建独立号段编码。
     *
     * @return 单主键例如 {@code {"id":"UniauthUserId"}}；复合主键例如
     *     {@code {"id":"UniauthUserId","tenantId":"UniauthUserTenantId"}}
     * @throws IllegalStateException 当表名或任一主键列为空时抛出，例如
     *     {@code IllegalStateException("DAO table name must not be blank")}
     */
    protected IdSequenceDefinition buildIdSequenceDefinition() {
        // 读取主键列名 → ["id", "tenantId"]。
        List<String> idColumns = getPrimaryKeyColumnNameList();
        // 读取表名 → "UniauthUser"，作为号段编码前缀。
        String tableName = getTableName();
        // 表名为空时停止，防止生成无法匹配数据库记录的号段编码。
        if (tableName == null || tableName.trim().isEmpty()) {
            throw new IllegalStateException("DAO table name must not be blank");
        }
        // 创建有序号段映射 → {}。
        Map<String, String> idSequenceCodeMap = new LinkedHashMap<>();
        // 遍历每个主键列 → 为每列生成独立号段编码。
        for (String idColumn : idColumns) {
            // 主键列名为空时停止，防止生成值无法回填。
            if (idColumn == null || idColumn.trim().isEmpty()) {
                throw new IllegalStateException("DAO id column must not be blank");
            }
            // 去除列名首尾空格 → "tenantId"。
            String normalizedColumn = idColumn.trim();
            // 拆分列名 → ["tenantId"] 或 ["tenant", "id"]。
            String[] nameParts = normalizedColumn.split("[_\\-\\s]+");
            // 初始化号段编码 → "UniauthUser"。
            StringBuilder sequenceCode = new StringBuilder(tableName.trim());
            // 遍历列名片段 → 拼接 UpperCamelCase 编码。
            for (String namePart : nameParts) {
                // 空片段跳过，避免编码出现无意义字符。
                if (namePart.isEmpty()) {
                    continue;
                }
                // 首字母大写后拼接 → "UniauthUserTenant"。
                sequenceCode.append(Character.toUpperCase(namePart.charAt(0)));
                // 拼接剩余字符 → "UniauthUserTenantId"。
                sequenceCode.append(namePart.substring(1));
            }
            // 保存列名和独立号段编码 → {"tenantId":"UniauthUserTenantId"}。
            idSequenceCodeMap.put(normalizedColumn, sequenceCode.toString());
        }
        // 输出主键列到号段编码的定义 → {"id":"UniauthUserId","tenantId":"UniauthUserTenantId"}。
        return new IdSequenceDefinition(idSequenceCodeMap);
    }

    /**
     * 按数据库返回顺序读取当前表的真实字段元数据。
     *
     * @return 真实字段元数据，例如
     *     {@code {"id":{"columnName":"id","dataType":"BIGINT","primaryKey":true},}
     *     {@code "loginName":{"columnName":"loginName","dataType":"VARCHAR","primaryKey":false}}}
     * @throws IllegalStateException 当字段元数据为空、字段名为空或字段重复时抛出，例如
     *     {@code IllegalStateException("duplicate database column found: id")}
     */
    protected Map<String, ColumnMetadata> getDbColumnsMap() {
        // 解析当前表名 → "UniauthUser"。
        String tableName = getTableName();
        // 解析数据库上下文 → {"databaseType":"H2","schemaName":"PUBLIC"}。
        CommonDbSource commonDbSource = COMMON_DB_SOURCE_RESOLVER.resolve(getDataSource());
        // 读取表字段元数据 → ["id", "tenantId", "loginName", "status"]。
        List<ColumnMetadata> columnMetadataList = METADATA_READER.listColumns(commonDbSource, tableName);
        // 元数据为空时停止，防止查询和写入链路生成没有真实字段的 SQL。
        if (columnMetadataList == null || columnMetadataList.isEmpty()) {
            throw new IllegalStateException("no selectable columns found for table: " + tableName);
        }
        // 使用有序映射保持数据库字段顺序，供查询字段和写入参数使用同一可信来源。
        Map<String, ColumnMetadata> dbColumnsMap = new LinkedHashMap<>();
        // 逐个登记数据库真实字段，任何空名或重复名都表示元数据不可安全用于 SQL。
        for (ColumnMetadata columnMetadata : columnMetadataList) {
            // 当前元数据对象或字段名为空时停止，避免动态 SQL 出现无效标识符。
            if (columnMetadata == null || columnMetadata.getColumnName() == null
                || columnMetadata.getColumnName().trim().isEmpty()) {
                throw new IllegalStateException("blank database column found for table: " + tableName);
            }
            // 使用数据库返回的真实字段名作为唯一键，不接受前端自行声明 SQL 字段。
            String columnName = columnMetadata.getColumnName().trim();
            // 同一真实字段重复出现时停止，避免字段和值的映射关系不确定。
            if (dbColumnsMap.putIfAbsent(columnName, columnMetadata) != null) {
                throw new IllegalStateException("duplicate database column found: " + columnName);
            }
        }
        // 输出真实字段有序映射 → {"id":ColumnMetadata,"loginName":ColumnMetadata}。
        return dbColumnsMap;
    }

    /**
     * 生成当前表可用于 SELECT 的列名字符串。
     *
     * @return SELECT 列名字符串，例如 {@code "id, tenantId, loginName, status"}
     */
    protected String getSelectColumns() {
        // SELECT 字段只允许来自数据库真实字段映射，保持查询和写入字段口径一致。
        String selectColumns = String.join(", ", getDbColumnsMap().keySet());
        // 输出 SELECT 列名字符串 → "id, tenantId, loginName, status"。
        return selectColumns;
    }

    /**
     * 按数据库真实字段匹配前端写入参数，并保持数据库字段顺序。
     *
     * @param saveIn 前端通用参数，例如 {@code {"id":1,"displayName":"新名称"}}
     * @return 已匹配字段值，例如 {@code {"id":1,"displayName":"新名称"}}
     * @throws IllegalArgumentException 当参数为空或含当前表不存在的字段时抛出，例如
     *     {@code IllegalArgumentException("unknown write column: debugFlag")}
     */
    protected Map<String, Object> buildDbColumnValueMap(CommonParam saveIn) {
        // 空参数无法形成明确写入动作，必须在生成 SQL 前终止。
        if (saveIn == null || saveIn.getParamMap() == null) {
            throw new IllegalArgumentException("saveIn must not be null");
        }
        // 获取当前物理表真实字段 → 后续 SQL 标识符只从该映射产生。
        Map<String, ColumnMetadata> dbColumnsMap = getDbColumnsMap();
        // 前端出现数据库不存在的字段时立即阻断，防止字段被忽略或成为动态 SQL 标识符。
        for (String inputColumnName : saveIn.getParamMap().keySet()) {
            // null 字段名和未知字段都不属于当前表真实结构。
            if (inputColumnName == null || !dbColumnsMap.containsKey(inputColumnName)) {
                throw new IllegalArgumentException("unknown write column: " + inputColumnName);
            }
        }
        // 使用有序映射保存实际提供的字段，不把未提供的数据库字段补成 null。
        Map<String, Object> columnValueMap = new LinkedHashMap<>();
        // 按数据库真实字段顺序匹配前端已提供字段。
        for (String dbColumnName : dbColumnsMap.keySet()) {
            // 未提供字段由数据库默认值或原值处理，不进入当前写入 SQL。
            if (!saveIn.getParamMap().containsKey(dbColumnName)) {
                continue;
            }
            // 值仍从原 CommonParam 按真实字段名读取，避免 Service 再次封装。
            columnValueMap.put(dbColumnName, saveIn.getParam(dbColumnName));
        }
        // 返回仅含真实且实际提供字段的有序映射。
        return columnValueMap;
    }

    /**
     * 获取公共动态查询执行器。
     *
     * @return 全部基础 DAO 共享的 {@code DefaultCommonQueryExecutor} 实例
     */
    protected CommonQueryExecutor getCommonQueryExecutor() {
        // 输出统一查询执行器 → 分页和动态查询共用同一条 SQL 构建与执行链路。
        return COMMON_QUERY_EXECUTOR;
    }

    /**
     * 复制字段和值的有序映射，避免修改调用方原始参数。
     *
     * @param sourceColumnValueMap 来自调用方的原字段映射，例如 {@code {"id":1,"status":"ENABLE"}}
     * @return 独立有序映射，例如 {@code {"id":1,"status":"ENABLE"}}；输入为空时返回 {@code {}}
     */
    protected Map<String, Object> copyColumnValueMap(Map<String, Object> sourceColumnValueMap) {
        // 输入为空映射时输出 {}，避免模板层出现空指针。
        if (sourceColumnValueMap == null || sourceColumnValueMap.isEmpty()) {
            return new LinkedHashMap<>();
        }
        // 复制字段映射 → 保持字段顺序且不改写调用方原对象。
        return new LinkedHashMap<>(sourceColumnValueMap);
    }
}
