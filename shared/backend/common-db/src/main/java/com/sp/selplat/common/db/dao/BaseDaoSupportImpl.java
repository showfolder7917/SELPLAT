package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.datasource.CommonDbSource;
import com.sp.selplat.common.db.datasource.CommonDbSourceResolver;
import com.sp.selplat.common.db.datasource.dialect.DatabaseDialectFactory;
import com.sp.selplat.common.db.metadata.model.ColumnMetadata;
import com.sp.selplat.common.db.metadata.DatabaseMetadataReader;
import com.sp.selplat.common.db.metadata.DefaultDatabaseMetadataReader;
import com.sp.selplat.common.db.metadata.MetadataSelectColumnBuilder;
import com.sp.selplat.common.db.query.CommonQueryExecutor;
import com.sp.selplat.common.db.query.CommonQuerySqlBuilder;
import com.sp.selplat.common.db.query.CommonQueryValidator;
import com.sp.selplat.common.db.query.DefaultCommonQueryExecutor;
import com.sp.selplat.common.db.query.DefaultCommonQuerySqlBuilder;
import com.sp.selplat.common.db.query.DefaultCommonQueryValidator;
import com.sp.selplat.common.db.sequence.model.IdSequenceDefinition;
import com.sp.selplat.common.db.template.BaseTemplateDao;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.ClassUtils;
import org.springframework.util.StringUtils;

/**
 * 提供公共 DAO 的表名、元数据、主键号段和查询支撑能力。
 */
public abstract class BaseDaoSupportImpl {

    // 模板 DAO 门面由 Spring 在实例化具体 DAO 子类后统一注入，集中承接单条 Mapper 与真实 JDBC 批处理。
    @Autowired
    protected BaseTemplateDao baseTemplateDao;

    // dataSource 承接当前模块实际使用的数据源，供公共 DAO 读取表结构并执行方言查询。
    @Autowired
    protected DataSource dataSource;

    // COMMON_DB_SOURCE_RESOLVER 复用 config 层的数据源上下文解析能力，让 DAO 不再自己识别数据库类型。
    private static final CommonDbSourceResolver COMMON_DB_SOURCE_RESOLVER = new CommonDbSourceResolver();
    // METADATA_READER 复用 common-db 已有的元数据读取实现，让支撑层不再旁路新建一套字段查询逻辑。
    private static final DatabaseMetadataReader METADATA_READER = new DefaultDatabaseMetadataReader();
    // METADATA_SELECT_COLUMN_BUILDER 复用 metadata 层的字段串构建规则，让 DAO 不再自己拼 select 片段。
    private static final MetadataSelectColumnBuilder METADATA_SELECT_COLUMN_BUILDER = new MetadataSelectColumnBuilder();
    // COMMON_QUERY_VALIDATOR 统一校验动态查询对象，避免分页、排序和条件字段绕开受控边界。
    private static final CommonQueryValidator COMMON_QUERY_VALIDATOR = new DefaultCommonQueryValidator(METADATA_READER);
    // COMMON_QUERY_SQL_BUILDER 统一生成多数据库动态查询 SQL，让分页逻辑继续收口在方言查询链路里。
    private static final CommonQuerySqlBuilder COMMON_QUERY_SQL_BUILDER = new DefaultCommonQuerySqlBuilder(COMMON_QUERY_VALIDATOR, new DatabaseDialectFactory());
    // COMMON_QUERY_EXECUTOR 统一执行动态查询 SQL，供分页和方言差异查询复用同一 JDBC 执行链路。
    private static final CommonQueryExecutor COMMON_QUERY_EXECUTOR = new DefaultCommonQueryExecutor(COMMON_QUERY_SQL_BUILDER);


    /**
     * 解析当前 DAO 使用的数据库上下文。
     *
     * @return {"sourceKey":"H2","databaseType":"H2","dataSource":"org.h2.jdbcx.JdbcDataSource","catalogName":"运行时随机UUID","schemaName":"PUBLIC"}
     */
    protected CommonDbSource resolveCurrentDbSource() {
        // 解析注入的数据源 → 可供元数据、方言和查询链路复用的数据库上下文。
        return COMMON_DB_SOURCE_RESOLVER.resolve(dataSource);
    }

    /**
     * 读取当前 DAO 对应表的主键字段。
     *
     * @return ["id", "tenantId"]
     */
    protected List<String> getPrimaryKeyColumnNameList() {
        // 解析当前表名 → "UniauthUser"。
        String tableName = getTableName();
        // 解析当前数据库上下文 → {"sourceKey":"H2","databaseType":"H2","dataSource":"org.h2.jdbcx.JdbcDataSource","catalogName":"运行时随机UUID","schemaName":"PUBLIC"}。
        CommonDbSource commonDbSource = COMMON_DB_SOURCE_RESOLVER.resolve(dataSource);
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
     * @return 表名，例如 "UniauthUser"
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
     * @return {"id":"UniauthUserId","tenantId":"UniauthUserTenantId"}
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
     * 生成当前表可用于 SELECT 的列名字符串。
     *
     * @return "id, tenantId, loginName, status"
     */
    protected String getselectColumns() {
        // 解析当前表名 → "UniauthUser"。
        String tableName = getTableName();
        // 解析数据库上下文 → {"databaseType":"H2","schemaName":"PUBLIC"}。
        CommonDbSource commonDbSource = COMMON_DB_SOURCE_RESOLVER.resolve(dataSource);
        // 读取表字段元数据 → ["id", "tenantId", "loginName", "status"]。
        List<ColumnMetadata> columnMetadataList = METADATA_READER.listColumns(commonDbSource, tableName);
        // 拼接 SELECT 字段 → "id, tenantId, loginName, status"。
        String selectColumns = METADATA_SELECT_COLUMN_BUILDER.build(columnMetadataList);
        // 字段串为空时停止，防止生成非法 SELECT SQL。
        if (!StringUtils.hasText(selectColumns)) {
            throw new IllegalStateException("no selectable columns found for table: " + tableName);
        }
        // 输出 SELECT 列名字符串 → "id, tenantId, loginName, status"。
        return selectColumns;
    }

    /**
     * 获取公共动态查询执行器。
     *
     * @return DefaultCommonQueryExecutor
     */
    protected CommonQueryExecutor getCommonQueryExecutor() {
        // 输出统一查询执行器 → 分页和动态查询共用同一条 SQL 构建与执行链路。
        return COMMON_QUERY_EXECUTOR;
    }

    /**
     * 复制字段和值的有序映射，避免修改调用方原始参数。
     *
     * @param sourceColumnValueMap 原字段映射，例如 {"id":1,"status":"ENABLE"}
     * @return 独立字段映射，例如 {"id":1,"status":"ENABLE"}
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
