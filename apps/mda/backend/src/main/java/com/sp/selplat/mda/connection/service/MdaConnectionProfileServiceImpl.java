package com.sp.selplat.mda.connection.service;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.connection.CredentialCipher;
import com.sp.selplat.mda.connection.dao.MdaConnectionProfileDao;
import com.sp.selplat.mda.jdbc.JdbcConnectionFactory;
import com.sp.selplat.mda.jdbc.MdaConnectionDefinition;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * 管理 MDA 独立控制库中的连接配置，并在运行边界完成口令加解密和响应脱敏。
 */
@Service
public class MdaConnectionProfileServiceImpl implements MdaConnectionProfileService {

    private final MdaConnectionProfileDao dao;
    private final CredentialCipher credentialCipher;
    private final JdbcConnectionFactory connectionFactory;

    /**
     * 装配连接配置业务服务。
     *
     * @param dao MDA 独立控制库 DAO
     * @param credentialCipher 口令加解密组件
     * @param connectionFactory 动态目标库连接工厂
     * 执行结果示例：连接配置只进入 apps/mda/db/mda.mv.db，目标查询使用配置指向的数据库。
     */
    public MdaConnectionProfileServiceImpl(
            MdaConnectionProfileDao dao,
            CredentialCipher credentialCipher,
            JdbcConnectionFactory connectionFactory) {
        this.dao = dao;
        this.credentialCipher = credentialCipher;
        this.connectionFactory = connectionFactory;
    }

    @Override
    public CommonPageResult getStore() {
        List<Map<String, Object>> records = dao.findAll();
        records.forEach(this::scrubSecret);
        CommonPageResult result = new CommonPageResult();
        result.setRecords(records);
        result.setTotalCount(records.size());
        result.setPageNo(1);
        result.setPageSize(Math.max(1, records.size()));
        return result;
    }

    @Override
    public CommonResult getById(long id) {
        Map<String, Object> record = requiredRecord(id);
        scrubSecret(record);
        return success(record, null, "/api/mda/connections/" + id, "连接详情查询完成。");
    }

    @Override
    public CommonResult insert(CommonParam saveIn) {
        Map<String, Object> values = normalize(saveIn, null);
        long id = dao.insert(values);
        Map<String, Object> record = requiredRecord(id);
        scrubSecret(record);
        return success(record, 1, "/api/mda/connections", "连接新增完成。");
    }

    @Override
    public CommonResult update(long id, CommonParam saveIn) {
        Map<String, Object> current = requiredRecord(id);
        Map<String, Object> values = normalize(saveIn, current);
        int affectedRows = dao.update(id, values);
        Map<String, Object> record = requiredRecord(id);
        scrubSecret(record);
        return success(record, affectedRows, "/api/mda/connections/" + id, "连接更新完成。");
    }

    @Override
    public CommonResult delete(long id) {
        requiredRecord(id);
        int affectedRows = dao.softDelete(id);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", id);
        data.put("status", 0);
        return success(data, affectedRows, "/api/mda/connections/" + id + "/delete", "连接删除完成。");
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
            return success(data, null, "/api/mda/connections/test", "连接成功。");
        } catch (SQLException | IllegalStateException exception) {
            throw new CommonBusinessException("MDA_CONNECTION_FAILED", "数据库连接失败：" + exception.getMessage(), exception);
        }
    }

    @Override
    public MdaConnectionDefinition loadDefinition(CommonParam queryIn) {
        Object connectionId = queryIn == null ? null : queryIn.getParam("connectionId");
        Map<String, Object> source;
        if (connectionId != null && !String.valueOf(connectionId).isBlank()) {
            source = requiredRecord(longValue(connectionId, "connectionId"));
            source.put("password", credentialCipher.decrypt(text(source.get("passwordCiphertext"))));
        } else if (queryIn != null) {
            source = new LinkedHashMap<>(queryIn.getParamMap());
        } else {
            throw new CommonBusinessException("MDA_CONNECTION_REQUIRED", "连接参数不能为空。");
        }
        return new MdaConnectionDefinition(
                text(source.get("databaseType")), text(source.get("host")), integer(source.get("port")),
                text(source.get("databaseName")), text(source.get("schemaName")), text(source.get("username")),
                text(source.get("password")), text(source.get("customJdbcUrl")), text(source.get("jdbcParameters")),
                bool(source.get("defaultAutoCommit"), true));
    }

    private Map<String, Object> normalize(CommonParam source, Map<String, Object> current) {
        if (source == null) throw new CommonBusinessException("MDA_CONNECTION_REQUIRED", "连接参数不能为空。");
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("connectionName", requiredText(source.getParam("connectionName"), "连接名称不能为空。"));
        values.put("databaseType", requiredText(source.getParam("databaseType"), "数据库类型不能为空。").toUpperCase(Locale.ROOT));
        values.put("host", optionalText(source.getParam("host")));
        values.put("port", integer(source.getParam("port")));
        values.put("databaseName", requiredText(source.getParam("databaseName"), "数据库名不能为空。"));
        values.put("schemaName", optionalText(source.getParam("schemaName")));
        values.put("username", optionalText(source.getParam("username")));
        Object password = source.getParam("password");
        values.put("passwordCiphertext", password == null || String.valueOf(password).isEmpty()
                ? current == null ? "" : current.get("passwordCiphertext")
                : credentialCipher.encrypt(String.valueOf(password)));
        values.put("customJdbcUrl", optionalText(source.getParam("customJdbcUrl")));
        values.put("jdbcParameters", optionalText(source.getParam("jdbcParameters")));
        values.put("defaultAutoCommit", bool(source.getParam("defaultAutoCommit"), true));
        values.put("sortnum", source.getParam("sortnum") == null ? 0 : source.getParam("sortnum"));
        return values;
    }

    private Map<String, Object> requiredRecord(long id) {
        try {
            Map<String, Object> record = dao.findById(id);
            if (record == null) throw new CommonBusinessException("MDA_CONNECTION_NOT_FOUND", "未找到连接配置：" + id);
            return new LinkedHashMap<>(record);
        } catch (CommonBusinessException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new CommonSystemException("MDA_CONTROL_DATABASE_FAILED", "MDA 控制库操作失败。", exception);
        }
    }

    private void scrubSecret(Map<String, Object> record) {
        Object ciphertext = record.remove("passwordCiphertext");
        record.remove("password");
        record.put("passwordSaved", ciphertext != null && !String.valueOf(ciphertext).isEmpty());
    }

    private CommonResult success(Object data, Integer affectedRows, String requestPath, String message) {
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setModuleCode("mda");
        result.setRequestPath(requestPath);
        result.setData(data);
        result.setAffectedRows(affectedRows);
        result.setMsg(message);
        return result;
    }

    private String requiredText(Object value, String message) {
        String text = optionalText(value);
        if (text == null) throw new CommonBusinessException("MDA_CONNECTION_FIELD_REQUIRED", message);
        return text;
    }

    private String optionalText(Object value) {
        if (value == null || String.valueOf(value).trim().isEmpty()) return null;
        return String.valueOf(value).trim();
    }

    private String text(Object value) { return value == null ? null : String.valueOf(value); }

    private Integer integer(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        return value instanceof Number number ? number.intValue() : Integer.valueOf(String.valueOf(value));
    }

    private long longValue(Object value, String field) {
        try { return Long.parseLong(String.valueOf(value)); }
        catch (NumberFormatException exception) {
            throw new CommonBusinessException("MDA_CONNECTION_ID_INVALID", field + " 必须是数字。", exception);
        }
    }

    private boolean bool(Object value, boolean defaultValue) {
        return value == null ? defaultValue : value instanceof Boolean flag ? flag : Boolean.parseBoolean(String.valueOf(value));
    }
}
