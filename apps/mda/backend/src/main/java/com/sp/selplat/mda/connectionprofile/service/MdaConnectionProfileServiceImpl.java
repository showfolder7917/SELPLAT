package com.sp.selplat.mda.connectionprofile.service;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.connectionprofile.dao.MdaConnectionProfileDao;
import com.sp.selplat.mda.targetdatabase.common.jdbc.JdbcConnectionFactory;
import com.sp.selplat.mda.targetdatabase.common.jdbc.MdaConnectionDefinition;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 复用固定表 Base 链管理 MdaConnectionProfile，并保留动态目标库连接测试能力。
 */
@Service
public class MdaConnectionProfileServiceImpl
        extends BaseServiceImpl<MdaConnectionProfileDao>
        implements MdaConnectionProfileService {

    private final JdbcConnectionFactory connectionFactory;

    /**
     * 装配连接配置业务服务。
     *
     * @param connectionFactory 动态目标库连接工厂
     */
    public MdaConnectionProfileServiceImpl(JdbcConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    /**
     * 查询有效连接并保持连接选择器的稳定排序。
     *
     * @param queryIn 页面分页和筛选参数
     * @return 有效连接分页结果
     */
    @Override
    public CommonPageResult getStore(CommonPageParam queryIn) {
        CommonPageParam requiredQuery = queryIn == null ? new CommonPageParam() : queryIn;
        requiredQuery.putParam("status", 1);
        return getDao().getPageList(
                requiredQuery.getParamMap(),
                "sortnum asc id asc",
                requiredQuery.getPageNo(),
                requiredQuery.getPageSize());
    }

    /**
     * 使用 H2 自增主键新增连接；其余查询、更新、删除全部走公共 Base DAO。
     *
     * @param saveIn 页面连接字段
     * @return 包含数据库生成主键的连接配置
     */
    @Override
    public CommonResult insert(CommonParam saveIn) {
        CommonParam normalized = normalize(saveIn, null);
        long id = getDao().insertReturningId(normalized);
        normalized.putParam("id", id);
        return buildSuccessResult(normalized.getParamMap(), 1, "连接新增完成。");
    }

    /**
     * 批量新增连接配置，批量 SQL 仍由公共 Base DAO 执行。
     *
     * @param saveIn 页面批量连接字段
     * @return 批量新增结果
     */
    @Override
    @Transactional("mdaTransactionManager")
    public CommonResult insertBatch(CommonBatchParam saveIn) {
        if (saveIn == null) {
            throw new CommonBusinessException("MDA_CONNECTION_REQUIRED", "连接参数不能为空。");
        }
        for (CommonParam item : saveIn.getItems()) {
            item.setParamMap(normalize(item, null).getParamMap());
        }
        int affectedRows = getDao().insertBatch(saveIn);
        return buildSuccessResult(saveIn.getItems(), affectedRows, "连接批量新增完成。");
    }

    /**
     * 校验并更新连接配置，未传密码时保留控制库中的原值。
     *
     * @param saveIn 包含 id 与最新连接字段的参数
     * @return 更新结果
     */
    @Override
    public CommonResult update(CommonParam saveIn) {
        long id = requiredId(saveIn == null ? null : saveIn.getParam("id"));
        Map<String, Object> current = requiredRecord(id);
        MdaConnectionDefinition previousDefinition = definition(current);
        CommonParam normalized = normalize(saveIn, current);
        normalized.putParam("id", id);
        normalized.putParam("lastOperateUserId", valueOrDefault(saveIn.getParam("lastOperateUserId"), 1L));
        normalized.putParam("updatedAt", LocalDateTime.now());
        CommonResult result = super.update(normalized);
        // 更新成功后立即关闭旧 URL、账号或口令对应的池，下一次请求只能使用新配置。
        connectionFactory.invalidate(previousDefinition);
        return result;
    }

    /**
     * 批量更新前逐项执行与单条更新相同的连接字段规范化。
     *
     * @param saveIn 包含主键与最新连接字段的批量参数
     * @return 公共批量更新结果
     */
    @Override
    @Transactional("mdaTransactionManager")
    public CommonResult updateBatch(CommonBatchParam saveIn) {
        if (saveIn == null) {
            throw new CommonBusinessException("MDA_CONNECTION_REQUIRED", "连接参数不能为空。");
        }
        List<MdaConnectionDefinition> previousDefinitions = new ArrayList<>();
        for (CommonParam item : saveIn.getItems()) {
            long id = requiredId(item.getParam("id"));
            Map<String, Object> current = requiredRecord(id);
            previousDefinitions.add(definition(current));
            CommonParam normalized = normalize(item, current);
            normalized.putParam("id", id);
            normalized.putParam("lastOperateUserId", valueOrDefault(item.getParam("lastOperateUserId"), 1L));
            normalized.putParam("updatedAt", LocalDateTime.now());
            item.setParamMap(normalized.getParamMap());
        }
        CommonResult result = super.updateBatch(saveIn);
        previousDefinitions.forEach(connectionFactory::invalidate);
        return result;
    }

    @Override
    public CommonResult delete(CommonParam deleteIn) {
        Map<String, Object> current = requiredRecord(requiredId(deleteIn == null ? null : deleteIn.getParam("id")));
        CommonResult result = super.delete(deleteIn);
        // 假删除完成后关闭对应目标池，页面无法再通过已停用配置继续访问目标库。
        connectionFactory.invalidate(definition(current));
        return result;
    }

    @Override
    @Transactional("mdaTransactionManager")
    public CommonResult deleteBatch(CommonBatchParam deleteIn) {
        if (deleteIn == null) {
            throw new CommonBusinessException("MDA_CONNECTION_REQUIRED", "连接参数不能为空。");
        }
        List<MdaConnectionDefinition> previousDefinitions = new ArrayList<>();
        for (CommonParam item : deleteIn.getItems()) {
            previousDefinitions.add(definition(requiredRecord(requiredId(item.getParam("id")))));
        }
        CommonResult result = super.deleteBatch(deleteIn);
        previousDefinitions.forEach(connectionFactory::invalidate);
        return result;
    }

    @Override
    public CommonResult testConnection(CommonParam testIn) {
        MdaConnectionDefinition definition = loadDefinition(testIn);
        try (Connection connection = connectionFactory.open(definition)) {
            DatabaseMetaData metadata = connection.getMetaData();
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("databaseProductName", metadata.getDatabaseProductName());
            data.put("databaseProductVersion", metadata.getDatabaseProductVersion());
            data.put("driverName", metadata.getDriverName());
            data.put("jdbcUrl", metadata.getURL());
            data.put("readOnly", connection.isReadOnly());
            return buildSuccessResult(data, "连接成功。");
        } catch (SQLException | IllegalStateException exception) {
            throw new CommonBusinessException("MDA_CONNECTION_FAILED", "数据库连接失败：" + exception.getMessage(), exception);
        }
    }

    @Override
    public MdaConnectionDefinition loadDefinition(CommonParam queryIn) {
        Object connectionId = queryIn == null ? null : queryIn.getParam("connectionId");
        Map<String, Object> source;
        if (connectionId != null && !String.valueOf(connectionId).isBlank()) {
            source = requiredRecord(requiredId(connectionId));
        } else if (queryIn != null) {
            source = new LinkedHashMap<>(queryIn.getParamMap());
        } else {
            throw new CommonBusinessException("MDA_CONNECTION_REQUIRED", "连接参数不能为空。");
        }
        return definition(source);
    }

    private MdaConnectionDefinition definition(Map<String, Object> source) {
        return new MdaConnectionDefinition(
                text(source.get("databaseType")), text(source.get("host")), integer(source.get("port")),
                text(source.get("databaseName")), text(source.get("schemaName")), text(source.get("username")),
                text(source.get("password")), text(source.get("customJdbcUrl")), text(source.get("jdbcParameters")),
                bool(source.get("defaultAutoCommit"), true));
    }

    private CommonParam normalize(CommonParam source, Map<String, Object> current) {
        if (source == null) {
            throw new CommonBusinessException("MDA_CONNECTION_REQUIRED", "连接参数不能为空。");
        }
        CommonParam normalized = new CommonParam();
        normalized.putParam("tenantId", valueOrDefault(source.getParam("tenantId"), 1L));
        normalized.putParam("lastOperateUserId", valueOrDefault(source.getParam("lastOperateUserId"), 1L));
        normalized.putParam("connectionName", requiredText(source.getParam("connectionName"), "连接名称不能为空。"));
        normalized.putParam("databaseType", requiredText(source.getParam("databaseType"), "数据库类型不能为空。").toUpperCase(Locale.ROOT));
        normalized.putParam("host", optionalText(source.getParam("host")));
        normalized.putParam("port", integer(source.getParam("port")));
        normalized.putParam("databaseName", requiredText(source.getParam("databaseName"), "数据库名不能为空。"));
        normalized.putParam("schemaName", optionalText(source.getParam("schemaName")));
        normalized.putParam("username", optionalText(source.getParam("username")));
        Object password = source.getParam("password");
        normalized.putParam("password", password == null ? current == null ? "" : current.get("password") : String.valueOf(password));
        normalized.putParam("customJdbcUrl", optionalText(source.getParam("customJdbcUrl")));
        normalized.putParam("jdbcParameters", optionalText(source.getParam("jdbcParameters")));
        normalized.putParam("defaultAutoCommit", bool(source.getParam("defaultAutoCommit"), true));
        normalized.putParam("sortnum", valueOrDefault(source.getParam("sortnum"), 0));
        normalized.putParam("status", valueOrDefault(source.getParam("status"), 1));
        normalized.putParam("createdAt", valueOrDefault(source.getParam("createdAt"), LocalDateTime.now()));
        normalized.putParam("updatedAt", LocalDateTime.now());
        return normalized;
    }

    private Map<String, Object> requiredRecord(long id) {
        Map<String, Object> record = getDao().getById(idParam(id));
        if (record == null) {
            throw new CommonBusinessException("MDA_CONNECTION_NOT_FOUND", "未找到连接配置：" + id);
        }
        return new LinkedHashMap<>(record);
    }

    private CommonParam idParam(long id) {
        CommonParam param = new CommonParam();
        param.putParam("id", id);
        return param;
    }

    private long requiredId(Object value) {
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new CommonBusinessException("MDA_CONNECTION_ID_INVALID", "id 必须是数字。", exception);
        }
    }

    private Object valueOrDefault(Object value, Object defaultValue) {
        return value == null ? defaultValue : value;
    }

    private String requiredText(Object value, String message) {
        String result = optionalText(value);
        if (result == null) {
            throw new CommonBusinessException("MDA_CONNECTION_FIELD_REQUIRED", message);
        }
        return result;
    }

    private String optionalText(Object value) {
        return value == null || String.valueOf(value).trim().isEmpty() ? null : String.valueOf(value).trim();
    }

    private String text(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Integer integer(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        return value instanceof Number number ? number.intValue() : Integer.valueOf(String.valueOf(value));
    }

    private boolean bool(Object value, boolean defaultValue) {
        return value == null ? defaultValue : value instanceof Boolean flag ? flag : Boolean.parseBoolean(String.valueOf(value));
    }
}
