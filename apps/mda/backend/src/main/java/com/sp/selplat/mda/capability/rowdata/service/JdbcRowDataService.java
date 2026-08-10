package com.sp.selplat.mda.capability.rowdata.service;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/**
 * 通过目标数据库真实主键安全更新 MDA 表查询页签中的单条记录。
 */
public interface JdbcRowDataService {

    /**
     * 校验真实表、字段和主键后更新一条目标库记录。
     * 真实传参示例：{@code {"connectionId":1,"schema":"PUBLIC","tableName":"Demo",}
     * {@code "primaryKeyValues":{"id":1},"values":{"name":"修改后"}}}。
     * 真实返回示例：返回 {@code {"success":true,"data":{"affectedRows":1},"msg":"数据更新完成。"}}。
     * 异常或副作用示例：无主键、字段不存在或影响行数不是 1 时抛出异常并回滚，不修改其他记录。
     *
     * @param updateIn 双击编辑窗口提交的连接、表、原主键和新字段值
     * @return 只包含单行更新结果的公共响应
     */
    CommonResult updateRow(CommonParam updateIn);
}
