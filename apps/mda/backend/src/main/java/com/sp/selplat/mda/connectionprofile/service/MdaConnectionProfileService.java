package com.sp.selplat.mda.connectionprofile.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.jdbc.MdaConnectionDefinition;

/**
 * 声明 MDA 固定连接配置表的公共 CRUD，以及动态目标库连接所需的业务动作。
 */
public interface MdaConnectionProfileService extends BaseService {

    /**
     * 兼容现有页面查询全部有效连接。
     *
     * @return 有效连接分页结果，例如 {@code {"records":[{"id":1}],"totalCount":1}}
     */
    CommonPageResult getStore();

    /**
     * 兼容现有页面按路径主键查询连接详情。
     *
     * @param id MdaConnectionProfile 主键，例如 {@code 1}
     * @return 连接详情公共结果
     */
    CommonResult getById(long id);

    /**
     * 兼容现有页面按路径主键更新连接配置。
     *
     * @param id MdaConnectionProfile 主键，例如 {@code 1}
     * @param saveIn 最新连接字段
     * @return 更新后的公共结果
     */
    CommonResult update(long id, CommonParam saveIn);

    /**
     * 兼容现有页面按路径主键假删除连接配置。
     *
     * @param id MdaConnectionProfile 主键，例如 {@code 1}
     * @return 假删除公共结果
     */
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
     * 把已保存连接或页面临时字段转换为 JDBC 运行配置。
     *
     * @param queryIn 已保存连接例如 {@code {"connectionId":10001}}；临时配置例如
     *     {@code {"databaseType":"H2","databaseName":"mem:mda_demo","username":"sa"}}
     * @return 不含审计字段的连接定义
     */
    MdaConnectionDefinition loadDefinition(CommonParam queryIn);
}
