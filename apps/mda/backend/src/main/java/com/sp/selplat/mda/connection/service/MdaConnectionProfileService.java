package com.sp.selplat.mda.connection.service;

import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.jdbc.MdaConnectionDefinition;

/**
 * 声明 MDA 连接配置管理、连接测试和运行期 JDBC 配置加载能力。
 */
public interface MdaConnectionProfileService {

    CommonPageResult getStore();

    CommonResult getById(long id);

    CommonResult insert(CommonParam saveIn);

    CommonResult update(long id, CommonParam saveIn);

    CommonResult delete(long id);

    /**
     * 使用已保存配置或页面临时字段测试目标数据库连接。
     *
     * @param testIn 已保存连接例如 {@code {"connectionId":10001}}；临时配置例如
     *     {@code {"databaseType":"POSTGRESQL","host":"127.0.0.1","port":5432,"databaseName":"demo"}}
     * @return 连接测试结果，例如
     *     {@code {"success":true,"data":{"databaseProductName":"PostgreSQL","readOnly":false},"msg":"连接成功。"}}
     */
    CommonResult testConnection(CommonParam testIn);

    /**
     * 把已保存连接或页面临时字段转换为 JDBC 运行配置；已保存口令仅在内存中解密。
     *
     * @param queryIn 已保存连接例如 {@code {"connectionId":10001}}；临时配置例如
     *     {@code {"databaseType":"H2","databaseName":"mem:mda_demo","username":"sa"}}
     * @return 不含审计字段的连接定义，例如
     *     {@code {"databaseType":"H2","databaseName":"mem:mda_demo","username":"sa","defaultAutoCommit":true}}
     */
    MdaConnectionDefinition loadDefinition(CommonParam queryIn);
}
