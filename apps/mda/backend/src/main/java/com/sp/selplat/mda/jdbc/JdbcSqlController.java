package com.sp.selplat.mda.jdbc;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.BaseController;
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
public class JdbcSqlController extends BaseController<JdbcSqlService> {

    /**
     * @param executeIn 例如 {@code {"connectionId":10001,"sql":"select * from sample"}}
     * @return 结果集、更新计数、警告和耗时 JSON
     */
    @RequestMapping(value = "execute.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String execute(@RequestBody CommonParam executeIn) {
        return JsonUtils.toJsonIgnoreNull(getService().execute(executeIn));
    }
}
