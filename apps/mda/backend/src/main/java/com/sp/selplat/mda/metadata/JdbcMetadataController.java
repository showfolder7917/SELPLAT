package com.sp.selplat.mda.metadata;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.ModuleDescription;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * 数据库结构接口只序列化元数据 Service 返回的固定结果。
 */
@RestController
@ModuleDescription(code = "mda-metadata", name = "MDA 元数据", description = "浏览数据库结构")
@RequestMapping("/api/mda/metadata")
public class JdbcMetadataController {

    // 元数据控制器只持有自己的只读 Service，不继承公共 CRUD 路由。
    private final JdbcMetadataService service;

    /**
     * 创建只开放数据库结构浏览能力的元数据控制器。
     *
     * @param service Spring 注入的元数据服务，例如 {@code JdbcMetadataServiceImpl}
     */
    public JdbcMetadataController(JdbcMetadataService service) {
        // 构造注入保证控制器创建后始终具有唯一可用的元数据服务。
        this.service = service;
    }

    /**
     * 读取指定连接的 catalog、schema、table 和 column 树。
     *
     * @param queryIn 连接主键，例如 {@code {"connectionId":10001}}
     * @return 元数据树 JSON，例如
     *     {@code {"success":true,"data":{"nodes":[{"type":"catalog","label":"MDA","children":[]}],}
     *     {@code "tableCount":0,"truncated":false},"msg":"数据库结构读取完成。"}}
     */
    @RequestMapping(value = "tree.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String tree(CommonParam queryIn) {
        // Service 已完成连接读取和元数据遍历，控制器只序列化固定结果。
        return JsonUtils.toJsonIgnoreNull(service.getTree(queryIn));
    }
}
