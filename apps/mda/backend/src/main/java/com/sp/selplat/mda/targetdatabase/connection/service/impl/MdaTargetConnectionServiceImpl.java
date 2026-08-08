package com.sp.selplat.mda.targetdatabase.connection.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.logging.OperationLog;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.targetdatabase.common.jdbc.JdbcConnectionFactory;
import com.sp.selplat.mda.targetdatabase.common.jdbc.MdaConnectionDefinition;
import com.sp.selplat.mda.targetdatabase.common.jdbc.MdaConnectionDefinitionResolver;
import com.sp.selplat.mda.targetdatabase.connection.service.MdaTargetConnectionService;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * 解析目标连接定义并执行一次真实 JDBC 连接测试。
 */
@Service
public class MdaTargetConnectionServiceImpl implements MdaTargetConnectionService {

    private final MdaConnectionDefinitionResolver definitionResolver;
    private final JdbcConnectionFactory connectionFactory;

    /**
     * 创建目标数据库连接测试 Service。
     *
     * @param definitionResolver 已保存或临时连接字段解析器，例如 {@code MdaConnectionDefinitionResolver}
     * @param connectionFactory 目标连接池工厂，例如 {@code JdbcConnectionFactory}
     *     <p>构造完成后无返回值；副作用是保存解析器和连接工厂供测试调用复用。
     */
    public MdaTargetConnectionServiceImpl(
            MdaConnectionDefinitionResolver definitionResolver,
            JdbcConnectionFactory connectionFactory) {
        this.definitionResolver = definitionResolver;
        this.connectionFactory = connectionFactory;
    }

    /**
     * 建立真实 JDBC 连接并返回数据库产品信息。
     *
     * @param testIn 已保存连接例如 {@code {"connectionId":100000}}；临时连接例如
     *     {@code {"databaseType":"H2","databaseName":"mem:mda_demo","username":"sa"}}
     * @return 连接成功结果，例如
     *     {@code {"success":true,"data":{"databaseProductName":"H2","readOnly":false},"msg":"连接成功。"}}
     * @throws CommonBusinessException 当定义解析或目标连接失败时抛出，例如错误编码
     *     {@code MDA_CONNECTION_FAILED}
     */
    @Override
    @OperationLog
    public CommonResult testConnection(CommonParam testIn) {
        MdaConnectionDefinition definition = definitionResolver.resolve(testIn);
        try (Connection connection = connectionFactory.open(definition)) {
            DatabaseMetaData metadata = connection.getMetaData();
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("databaseProductName", metadata.getDatabaseProductName());
            data.put("databaseProductVersion", metadata.getDatabaseProductVersion());
            data.put("driverName", metadata.getDriverName());
            data.put("jdbcUrl", metadata.getURL());
            data.put("readOnly", connection.isReadOnly());
            CommonResult result = new CommonResult();
            result.setSuccess(true);
            result.setData(data);
            result.setMsg("连接成功。");
            return result;
        } catch (SQLException | IllegalStateException exception) {
            throw new CommonBusinessException(
                    "MDA_CONNECTION_FAILED",
                    "数据库连接失败：" + exception.getMessage(),
                    exception);
        }
    }
}
