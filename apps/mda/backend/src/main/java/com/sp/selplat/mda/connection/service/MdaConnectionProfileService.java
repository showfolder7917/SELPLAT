package com.sp.selplat.mda.connection.service;

import com.sp.selplat.common.service.BaseCrudService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.jdbc.MdaConnectionDefinition;

/**
 * 连接配置服务继承公共 CRUD 契约，只额外声明连接测试和运行期 JDBC 配置加载能力。
 * 公共增删改查方法及注释统一复用 {@link BaseCrudService}，本接口不重复声明。
 */
public interface MdaConnectionProfileService extends BaseCrudService {

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
