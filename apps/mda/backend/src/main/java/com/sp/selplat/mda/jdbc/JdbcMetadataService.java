package com.sp.selplat.mda.jdbc;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/**
 * 读取目标数据库目录、模式、表和字段的中立元数据树。
 */
public interface JdbcMetadataService {

    /**
     * 读取目标连接的 catalog、schema、table、view 和 column 层级树，最多遍历一千张表。
     *
     * @param queryIn 已保存连接主键，例如 {@code {"connectionId":10001}}
     * @return 元数据结果，例如
     *     {@code {"success":true,"data":{"databaseProductName":"H2","nodes":[{"type":"catalog",}
     *     {@code "label":"MDA","children":[]}],"tableCount":0,"truncated":false},"msg":"数据库结构读取完成。"}}
     */
    CommonResult getTree(CommonParam queryIn);
}
