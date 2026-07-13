package com.sp.selplat.common.db.metadata;

import com.sp.selplat.common.db.datasource.CommonDbSource;
import com.sp.selplat.common.db.metadata.model.ColumnMetadata;
import com.sp.selplat.common.db.metadata.model.TableMetadata;
import java.util.List;

/**
 * 数据库元数据读取器接口统一抽象表和字段结构读取能力。
 * 这里把数据源实体直接作为入参，是为了让上层传入选定的数据源上下文，
 * 底层不再自行决定当前读取哪套数据库元数据。
 */
public interface DatabaseMetadataReader {

    /**
     * 列出当前数据源下的表集合。
     *
     * @param dataSource 数据源实体
     * @return 表集合
     */
    List<TableMetadata> listTables(CommonDbSource dataSource);

    /**
     * 获取指定表信息。
     *
     * @param dataSource 数据源实体
     * @param tableName 表名
     * @return 表信息
     */
    TableMetadata getTable(CommonDbSource dataSource, String tableName);

    /**
     * 列出指定表字段集合。
     *
     * @param dataSource 数据源实体
     * @param tableName 表名
     * @return 字段集合
     */
    List<ColumnMetadata> listColumns(CommonDbSource dataSource, String tableName);

    /**
     * 列出指定表主键字段集合。
     *
     * @param dataSource 数据源实体
     * @param tableName 表名
     * @return 主键字段集合
     */
    List<String> listPrimaryKeys(CommonDbSource dataSource, String tableName);

    /**
     * 判断表是否存在。
     *
     * @param dataSource 数据源实体
     * @param tableName 表名
     * @return 是否存在
     */
    boolean existsTable(CommonDbSource dataSource, String tableName);

    /**
     * 判断字段是否存在。
     *
     * @param dataSource 数据源实体
     * @param tableName 表名
     * @param columnName 字段名
     * @return 是否存在
     */
    boolean existsColumn(CommonDbSource dataSource, String tableName, String columnName);
}


