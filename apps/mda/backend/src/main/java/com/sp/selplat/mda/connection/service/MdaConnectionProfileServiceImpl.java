package com.sp.selplat.mda.connection.service;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonPageParam;
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
 * 连接配置业务服务复用公共单表链路，并在数据库边界完成口令加解密与响应脱敏。
 */
@Service
public class MdaConnectionProfileServiceImpl extends BaseServiceImpl<MdaConnectionProfileDao>
        implements MdaConnectionProfileService {

    private final CredentialCipher credentialCipher;
    private final JdbcConnectionFactory connectionFactory;

    public MdaConnectionProfileServiceImpl(CredentialCipher credentialCipher, JdbcConnectionFactory connectionFactory) {
        this.credentialCipher = credentialCipher;
        this.connectionFactory = connectionFactory;
    }

    @Override
    public CommonPageResult getStore(CommonPageParam queryIn) {
        CommonPageResult result = super.getStore(queryIn);
        // 列表中的每条记录都删除密文，只返回 passwordSaved 帮助页面判断是否已有口令。
        result.getRecords().forEach(this::scrubSecret);
        return result;
    }

    @Override
    public CommonResult getById(CommonParam queryIn) {
        CommonResult result = super.getById(queryIn);
        @SuppressWarnings("unchecked")
        Map<String, Object> record = (Map<String, Object>) result.getData();
        scrubSecret(record);
        return result;
    }

    @Override
    public CommonResult insert(CommonParam saveIn) {
        normalizeNewProfile(saveIn);
        replacePassword(saveIn, true);
        CommonResult result = super.insert(saveIn);
        scrubSecret(saveIn.getParamMap());
        return result;
    }

    @Override
    public CommonResult update(CommonParam saveIn) {
        normalizeType(saveIn);
        replacePassword(saveIn, false);
        CommonResult result = super.update(saveIn);
        scrubSecret(saveIn.getParamMap());
        return result;
    }

    @Override
    public CommonResult delete(CommonParam deleteIn) {
        return super.delete(deleteIn);
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
        } catch (SQLException exception) {
            throw new IllegalArgumentException("数据库连接失败：" + exception.getMessage(), exception);
        }
    }

    @Override
    public MdaConnectionDefinition loadDefinition(CommonParam queryIn) {
        Map<String, Object> source;
        Object connectionId = queryIn.getParam("connectionId");
        Object id = connectionId;
        // 仅传 id 时兼容连接测试 API；编辑表单同时带其他字段时必须测试页面新值，不能回读旧配置覆盖新密码。
        if (id == null && queryIn.getParam("id") != null && queryIn.getParamMap().size() == 1) {
            id = queryIn.getParam("id");
        }
        if (id != null && !String.valueOf(id).isBlank()) {
            CommonParam idParam = new CommonParam();
            idParam.putParam("id", id);
            source = getDao().getById(idParam);
            if (source == null || source.isEmpty()) {
                throw new IllegalArgumentException("未找到连接配置：" + id);
            }
            String ciphertext = text(source.get("passwordCiphertext"));
            source = new LinkedHashMap<>(source);
            source.put("password", credentialCipher.decrypt(ciphertext));
        } else {
            // 未保存连接测试直接使用页面字段，不把明文口令写入配置库。
            source = new LinkedHashMap<>(queryIn.getParamMap());
        }
        return toDefinition(source);
    }

    private MdaConnectionDefinition toDefinition(Map<String, Object> source) {
        return new MdaConnectionDefinition(
                text(source.get("databaseType")), text(source.get("host")), integer(source.get("port")),
                text(source.get("databaseName")), text(source.get("schemaName")), text(source.get("username")),
                text(source.get("password")), text(source.get("customJdbcUrl")), text(source.get("jdbcParameters")),
                bool(source.get("defaultAutoCommit"), true));
    }

    private void normalizeNewProfile(CommonParam saveIn) {
        normalizeType(saveIn);
        // 公共 DAO 需要明确租户、操作人、排序和状态字段；页面未传时使用本地工作台默认值。
        saveIn.getParamMap().putIfAbsent("tenantId", 1L);
        saveIn.getParamMap().putIfAbsent("lastOperateUserId", 1L);
        saveIn.getParamMap().putIfAbsent("defaultAutoCommit", true);
        saveIn.getParamMap().putIfAbsent("sortnum", 0);
        saveIn.getParamMap().putIfAbsent("status", 1);
    }

    private void normalizeType(CommonParam saveIn) {
        Object type = saveIn.getParam("databaseType");
        if (type != null) {
            saveIn.putParam("databaseType", String.valueOf(type).trim().toUpperCase(Locale.ROOT));
        }
    }

    private void replacePassword(CommonParam saveIn, boolean insert) {
        Object password = saveIn.getParam("password");
        if (password != null) {
            saveIn.putParam("passwordCiphertext", credentialCipher.encrypt(String.valueOf(password)));
        } else if (insert) {
            saveIn.putParam("passwordCiphertext", "");
        }
        // 明文 password 没有数据库列，进入公共 DAO 前必须移除。
        saveIn.getParamMap().remove("password");
    }

    private void scrubSecret(Map<String, Object> record) {
        if (record == null) {
            return;
        }
        Object ciphertext = record.remove("passwordCiphertext");
        record.remove("password");
        record.put("passwordSaved", ciphertext != null && !String.valueOf(ciphertext).isEmpty());
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
        if (value == null) {
            return defaultValue;
        }
        return value instanceof Boolean flag ? flag : Boolean.parseBoolean(String.valueOf(value));
    }
}
