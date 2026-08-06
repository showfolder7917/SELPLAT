package com.sp.selplat.mda.jdbc;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.BaseExtendsController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * SQL 接口不解释 SQL，只把完整请求交给 Service 并序列化执行结果。
 */
@RestController
@ModuleDescription(code = "mda-sql", name = "MDA SQL", description = "执行目标数据库 SQL")
@RequestMapping("/api/mda/sql")
public class JdbcSqlController extends BaseExtendsController {

    // SQL 控制器只持有自己的执行 Service，不继承公共 CRUD 路由。
    private final JdbcSqlService service;

    /**
     * 创建只开放目标数据库 SQL 执行能力的控制器。
     *
     * @param service Spring 注入的 SQL 服务，例如 {@code JdbcSqlServiceImpl}
     */
    public JdbcSqlController(JdbcSqlService service) {
        // 构造注入保证控制器创建后始终具有唯一可用的 SQL 服务。
        this.service = service;
    }

    /**
     * 执行调用方提交的完整 SQL，并返回结果集或更新计数。
     *
     * @param executeIn 执行参数，例如 {@code {"connectionId":10001,"sql":"select * from sample"}}
     * @return SQL 结果 JSON，例如
     *     {@code {"success":true,"data":{"results":[{"kind":"resultSet","rows":[[1]]}],}
     *     {@code "warnings":[],"elapsedMs":12,"autoCommit":true,"maxRows":1000},"msg":"SQL 执行完成。"}}
     */
    @RequestMapping(value = "execute.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String execute(@RequestBody CommonParam executeIn) {
        // Service 已完成 SQL 执行和结果构建，控制器只序列化固定结果。
        return JsonUtils.toJsonIgnoreNull(service.execute(executeIn));
    }
}
