package com.sp.selplat.mda.capability.rowdata.controller;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.mda.capability.rowdata.service.JdbcRowDataService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * 接收 MDA 数据编辑窗口的单行更新请求，不开放无主键批量修改能力。
 */
@RestController
@ModuleDescription(code = "mda-row-data", name = "MDA 行数据", description = "按主键编辑目标数据库单行数据")
@RequestMapping("/api/mda/data")
public class JdbcRowDataController {

    // 行数据控制器只委托按主键更新服务，不复用控制库 CRUD。
    private final JdbcRowDataService service;

    /**
     * 创建目标库单行数据编辑控制器。
     * 真实传参示例：Spring 注入 {@code JdbcRowDataServiceImpl}。
     * 真实返回示例：构造出可处理 {@code update-row.htm} 的控制器。
     * 异常或副作用示例：依赖缺失时由 Spring 阻止应用启动，不连接目标数据库。
     *
     * @param service Spring 注入的目标库单行更新服务
     */
    public JdbcRowDataController(JdbcRowDataService service) {
        this.service = service;
    }

    /**
     * 按目标表真实主键更新双击选中的一条记录。
     * 真实传参示例：{@code {"connectionId":1,"tableName":"Demo","primaryKeyValues":{"id":1},}
     * {@code "values":{"name":"修改后"}}}。
     * 真实返回示例：返回 JSON {@code {"success":true,"data":{"affectedRows":1},"msg":"数据更新完成。"}}。
     * 异常或副作用示例：校验失败时返回统一错误响应，服务层事务已经回滚。
     *
     * @param updateIn 编辑窗口提交的目标记录和字段值
     * @return 序列化后的单行更新结果 JSON
     */
    @RequestMapping(value = "update-row.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String updateRow(CommonParam updateIn) {
        return JsonUtils.toJsonIgnoreNull(service.updateRow(updateIn));
    }
}
