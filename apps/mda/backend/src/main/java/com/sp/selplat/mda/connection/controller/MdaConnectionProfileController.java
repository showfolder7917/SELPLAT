package com.sp.selplat.mda.connection.controller;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.mda.connection.service.MdaConnectionProfileService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 发布 MDA 连接配置管理接口。
 * Controller 只绑定 HTTP 参数并序列化 Service 的公共返回结构。
 */
@RestController
@ModuleDescription(code = "mda-connection", name = "MDA 连接", description = "管理多数据库连接配置")
@RequestMapping(value = "/api/mda/connections", produces = MediaType.APPLICATION_JSON_VALUE)
public class MdaConnectionProfileController {

    private final MdaConnectionProfileService service;

    public MdaConnectionProfileController(MdaConnectionProfileService service) {
        this.service = service;
    }

    /**
     * 查询全部有效连接。
     *
     * @return 分页 JSON，例如 {@code {"records":[{"id":10001,"connectionName":"MDA 本地工作库"}],"totalCount":1}}
     */
    @GetMapping
    public String getStore() {
        return JsonUtils.toJsonIgnoreNull(service.getStore());
    }

    /**
     * 查询连接详情。
     *
     * @param id URL 中的控制库主键，例如 {@code 10001}
     * @return 连接详情，例如 {@code {"success":true,"data":{"id":10001,"password":"dev-password"}}}
     */
    @GetMapping("/{id}")
    public String getById(@PathVariable("id") long id) {
        return JsonUtils.toJsonIgnoreNull(service.getById(id));
    }

    /**
     * 新增连接。
     *
     * @param saveIn JSON 请求体，例如 {@code {"connectionName":"开发库","databaseType":"H2","databaseName":"mem:dev"}}
     * @return 新增结果，例如 {@code {"success":true,"data":{"id":10002},"affectedRows":1}}
     */
    @PostMapping
    public String insert(CommonParam saveIn) {
        return JsonUtils.toJsonIgnoreNull(service.insert(saveIn));
    }

    /**
     * 更新连接。
     *
     * @param id URL 中的控制库主键，例如 {@code 10002}
     * @param saveIn JSON 请求体中的最新连接字段
     * @return 更新结果，例如 {@code {"success":true,"data":{"id":10002},"affectedRows":1}}
     */
    @PostMapping("/{id}")
    public String update(@PathVariable("id") long id, CommonParam saveIn) {
        return JsonUtils.toJsonIgnoreNull(service.update(id, saveIn));
    }

    /**
     * 逻辑删除连接。
     *
     * @param id URL 中的控制库主键，例如 {@code 10002}
     * @return 删除结果，例如 {@code {"success":true,"data":{"id":10002,"status":0},"affectedRows":1}}
     */
    @PostMapping("/{id}/delete")
    public String delete(@PathVariable("id") long id) {
        return JsonUtils.toJsonIgnoreNull(service.delete(id));
    }

    /**
     * 测试已保存或临时连接参数。
     *
     * @param testIn JSON 请求体，例如 {@code {"connectionId":10001}}
     * @return JDBC 产品信息，例如 {@code {"success":true,"data":{"databaseProductName":"H2"}}}
     */
    @PostMapping("/test")
    public String test(CommonParam testIn) {
        return JsonUtils.toJsonIgnoreNull(service.testConnection(testIn));
    }
}
