package com.sp.selplat.mda.capability.targetconnection.service;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/**
 * 声明目标数据库真实连接测试能力，不承载连接配置控制表 CRUD。
 */
public interface MdaTargetConnectionService {

    /**
     * 使用已保存配置或页面临时字段测试目标数据库连接。
     *
     * @param testIn 已保存连接例如 {@code {"connectionId":100000}}；临时配置例如
     *     {@code {"databaseType":"H2","databaseName":"mem:mda_demo","username":"sa"}}
     * @return 连接测试结果，例如
     *     {@code {"success":true,"data":{"databaseProductName":"H2","readOnly":false},"msg":"连接成功。"}}
     */
    CommonResult testConnection(CommonParam testIn);
}
