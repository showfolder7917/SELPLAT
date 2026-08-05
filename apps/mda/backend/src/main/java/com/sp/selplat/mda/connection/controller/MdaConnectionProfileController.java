package com.sp.selplat.mda.connection.controller;

import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.mda.connection.service.MdaConnectionProfileService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * 连接配置接口只负责接收公共参数并序列化 Service 固定结果。
 */
@RestController
@ModuleDescription(code = "mda-connection", name = "MDA 连接", description = "管理多数据库连接配置")
@RequestMapping("/api/mda/connections")
public class MdaConnectionProfileController extends BaseController<MdaConnectionProfileService> {

    /**
     * 查询有效连接列表。
     *
     * @param queryIn 例如 {@code pageNo=1&pageSize=100&status=1}
     * @return 脱敏连接分页 JSON
     */
    @RequestMapping(value = "getStore.htm", method = {RequestMethod.GET, RequestMethod.POST},
            produces = MediaType.APPLICATION_JSON_VALUE)
    public String getStore(CommonPageParam queryIn) {
        return JsonUtils.toJsonIgnoreNull(getService().getStore(queryIn));
    }

    /**
     * @param queryIn 主键，例如 {@code {"id":10001}}
     * @return 脱敏连接详情 JSON
     */
    @RequestMapping(value = "getById.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getById(@RequestBody CommonParam queryIn) {
        return JsonUtils.toJsonIgnoreNull(getService().getById(queryIn));
    }

    /**
     * @param saveIn 新连接字段，例如 {@code {"connectionName":"本地H2","databaseType":"H2"}}
     * @return 新增结果 JSON
     */
    @RequestMapping(value = "create.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String create(@RequestBody CommonParam saveIn) {
        return JsonUtils.toJsonIgnoreNull(getService().insert(saveIn));
    }

    /**
     * @param saveIn 主键与更新字段，例如 {@code {"id":10001,"connectionName":"测试库"}}
     * @return 更新结果 JSON
     */
    @RequestMapping(value = "update.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String update(@RequestBody CommonParam saveIn) {
        return JsonUtils.toJsonIgnoreNull(getService().update(saveIn));
    }

    /**
     * @param deleteIn 主键，例如 {@code {"id":10001}}
     * @return 逻辑删除结果 JSON
     */
    @RequestMapping(value = "delete.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String delete(@RequestBody CommonParam deleteIn) {
        return JsonUtils.toJsonIgnoreNull(getService().delete(deleteIn));
    }

    /**
     * @param testIn 已保存 connectionId 或一组未保存连接字段
     * @return 数据库产品、驱动和只读状态 JSON
     */
    @RequestMapping(value = "test.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String test(@RequestBody CommonParam testIn) {
        return JsonUtils.toJsonIgnoreNull(getService().testConnection(testIn));
    }
}
