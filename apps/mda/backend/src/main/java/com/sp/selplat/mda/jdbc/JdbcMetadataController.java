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
 * 数据库结构接口只序列化元数据 Service 返回的固定结果。
 */
@RestController
@ModuleDescription(code = "mda-metadata", name = "MDA 元数据", description = "浏览数据库结构")
@RequestMapping("/api/mda/metadata")
public class JdbcMetadataController extends BaseController<JdbcMetadataService> {

    /**
     * @param queryIn 连接主键，例如 {@code {"connectionId":10001}}
     * @return catalog/schema/table/column 树 JSON
     */
    @RequestMapping(value = "tree.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String tree(@RequestBody CommonParam queryIn) {
        return JsonUtils.toJsonIgnoreNull(getService().getTree(queryIn));
    }
}
