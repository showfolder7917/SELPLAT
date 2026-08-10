package com.sp.selplat.mda.capability.sqlexport.controller;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.mda.capability.sqlexport.service.JdbcStartupSqlExportService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * 接收 MDA 树右键导出请求，只把文件生成副作用委托给启动 SQL 导出服务。
 */
@RestController
@ModuleDescription(code = "mda-startup-sql-export", name = "MDA 启动 SQL 导出", description = "导出应用数据库结构和全量数据")
@RequestMapping("/api/mda/export")
public class JdbcStartupSqlExportController {

    // 导出控制器只依赖目标库导出服务，不直接访问 JDBC 或工程文件。
    private final JdbcStartupSqlExportService service;

    /**
     * 创建表和数据库启动 SQL 导出控制器。
     *
     * @param service Spring 注入的导出服务，例如 {@code JdbcStartupSqlExportServiceImpl}
     *     <p>真实返回示例：构造出可处理两个导出接口的控制器。
     *     <p>异常或副作用示例：依赖缺失时由 Spring 阻止应用启动，不连接数据库或写文件。
     */
    public JdbcStartupSqlExportController(JdbcStartupSqlExportService service) {
        this.service = service;
    }

    /**
     * 导出右键选中的一张表。
     *
     * @param exportIn 页面提交的连接、Schema 和表名，例如
     *     {@code {"connectionId":1,"schema":"PUBLIC","tableName":"MdaConnectionProfile"}}
     * @return 统一结果 JSON，例如
     *     {@code {"success":true,"data":{"tableCount":1,"rowCount":2},"msg":"表启动 SQL 导出完成。"}}
     * @throws RuntimeException 服务校验或写入失败时交给公共异常处理器；失败时不会保留半套 SQL
     */
    @RequestMapping(value = "table.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String exportTable(CommonParam exportIn) {
        return JsonUtils.toJsonIgnoreNull(service.exportTable(exportIn));
    }

    /**
     * 导出当前中央登记应用数据库中的全部物理表。
     *
     * @param exportIn 页面提交的连接坐标，例如 {@code {"connectionId":1,"catalog":"mda"}}
     * @return 统一结果 JSON，例如
     *     {@code {"success":true,"data":{"tableCount":2,"rowCount":13},"msg":"数据库启动 SQL 导出完成。"}}
     * @throws RuntimeException 服务校验或写入失败时交给公共异常处理器；系统 Schema 和视图不会写文件
     */
    @RequestMapping(value = "database.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String exportDatabase(CommonParam exportIn) {
        return JsonUtils.toJsonIgnoreNull(service.exportDatabase(exportIn));
    }
}
