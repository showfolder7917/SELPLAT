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
import com.sp.selplat.common.db.template.BaseTemplateDao;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.ClassUtils;
import org.springframework.util.StringUtils;

// 通用 DAO 支撑层负责表名解析、字段元数据、模板查询入参拼装和公共查询组件暴露，不直接承接业务 SQL 或分页执行。
public abstract class BaseDaoSupportImpl {

    // 模板 DAO 代理对象由 Spring 在实例化具体 DAO 子类后统一注入，保证通用 CRUD 可复用同一代理。
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


    // 分页查询基类需要知道当前真实数据源类型，供方言层在 SQL 构建阶段统一判断数据库差异。
    protected CommonDbSource resolveCurrentDbSource() {
        // 直接复用 config 层解析器，把当前注入的数据源转换成可复用的数据源上下文。
        return COMMON_DB_SOURCE_RESOLVER.resolve(dataSource);
    }

    // 子类必须明确当前公共 DAO 的主键列名，供更新和删除按唯一标识命中目标记录。
    protected String getId() {
        // 公共基类默认按平台约定的 id 主键列定位记录，让简单单表 DAO 不必重复声明同一主键名。
        return "id";
    }

    // 按公共 DAO 的命名约定延迟解析物理表名，让子类无需显式传参或依赖构造阶段赋值。
    protected String getTableName() {
        // 先还原 Spring 代理背后的用户类，避免 CGLIB 后缀导致公共 DAO 命名约定解析失败。
        Class<?> userClass = ClassUtils.getUserClass(this);
        // 使用用户类类名推导默认表名，保持简单单表模块的零样板接入方式。
        String simpleName = userClass.getSimpleName();
        // 类名不满足平台 DAO 命名约定时立即失败，避免模板 SQL 打到错误表。
        if (!simpleName.endsWith("DaoImpl")) {
            throw new IllegalStateException("DAO类名不符合约定: " + simpleName);
        }
        // 去掉实现类后缀后返回物理表名，供通用 CRUD 和动态查询共用。
        return simpleName.substring(0, simpleName.length() - "DaoImpl".length());
    }

    // 公共 DAO 统一通过现有元数据读取器生成 select 字段串，让子类不必手工维护整串字段列表。
    protected String getselectColumns() {
        // 当前 DAO 的物理表名继续沿用基类约定解析，保证字段读取目标与模板 CRUD 命中同一张表。
        String tableName = getTableName();
        // 通过 config 层的解析器把当前真实数据源转换成 common-db 可复用的数据源上下文实体。
        CommonDbSource commonDbSource = COMMON_DB_SOURCE_RESOLVER.resolve(dataSource);
        // 通过现有元数据读取器实时查询目标表字段，保证字段顺序和真实表结构保持一致。
        List<ColumnMetadata> columnMetadataList = METADATA_READER.listColumns(commonDbSource, tableName);
        // 通过 metadata 层的构建器把字段元数据转换成模板和动态查询都可复用的字段串。
        String selectColumns = METADATA_SELECT_COLUMN_BUILDER.build(columnMetadataList);
        // 没读到任何字段时立即失败，避免后续 select 退化成非法 SQL。
        if (!StringUtils.hasText(selectColumns)) {
            throw new IllegalStateException("no selectable columns found for table: " + tableName);
        }
        // 返回当前表的完整字段串，供详情、列表和动态查询统一复用。
        return selectColumns;
    }

    // 分页查询基类需要复用同一套动态 SQL 执行器，避免在各个 DAO 子类里继续散落 JDBC 方言调用。
    protected CommonQueryExecutor getCommonQueryExecutor() {
        // 返回当前支撑层统一维护的查询执行器，让分页和动态查询共用同一条 SQL 构建与执行链路。
        return COMMON_QUERY_EXECUTOR;
    }

    // 复制字段映射时统一使用 LinkedHashMap，保证列顺序稳定并兼容 null 场景。
    protected Map<String, Object> copyColumnValueMap(Map<String, Object> sourceColumnValueMap) {
        // 调用方不传条件或字段时，统一返回空有序映射，避免模板层出现空指针。
        if (sourceColumnValueMap == null || sourceColumnValueMap.isEmpty()) {
            return new LinkedHashMap<>();
        }
        // 复制一份独立有序映射，让模板入参和调用方原始对象完全解耦。
        return new LinkedHashMap<>(sourceColumnValueMap);
    }
}






