package com.sp.selplat.mda.capability.sqlexport.service;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/**
 * 把中央登记的 SELPLAT H2 应用数据库导出为受门禁约束的启动 SQL。
 */
public interface JdbcStartupSqlExportService {

    /**
     * 导出右键选中的一张物理表，结构和全量数据分别写入应用 {@code db/sql}。
     *
     * @param exportIn MDA 页面提交的连接与表坐标，例如
     *     {@code {"connectionId":1,"catalog":"mda","schema":"PUBLIC","tableName":"MdaConnectionProfile"}}
     * @return 导出结果，例如
     *     {@code {"success":true,"data":{"projectName":"mda","tableCount":1,"rowCount":2,}}
     *     {@code "msg":"表启动 SQL 导出完成。"}}
     * @throws com.sp.selplat.common.exception.CommonBusinessException 连接未登记、目标不是物理表或表不符合门禁时抛出；
     *     不修改已有启动 SQL
     * @throws com.sp.selplat.common.exception.CommonSystemException JDBC 或文件写入失败时抛出；已经替换的文件会恢复
     */
    CommonResult exportTable(CommonParam exportIn);

    /**
     * 导出当前应用数据库业务 Schema 中的全部物理表，不导出系统 Schema 和视图。
     *
     * @param exportIn MDA 页面提交的连接坐标，例如 {@code {"connectionId":1,"catalog":"mda"}}
     * @return 导出结果，例如
     *     {@code {"success":true,"data":{"projectName":"mda","tableCount":2,"rowCount":13,}}
     *     {@code "msg":"数据库启动 SQL 导出完成。"}}
     * @throws com.sp.selplat.common.exception.CommonBusinessException 连接未进入中央登记或任一表不符合门禁时抛出；
     *     不生成部分文件
     * @throws com.sp.selplat.common.exception.CommonSystemException JDBC 或文件写入失败时抛出；已经替换的文件会恢复
     */
    CommonResult exportDatabase(CommonParam exportIn);
}
