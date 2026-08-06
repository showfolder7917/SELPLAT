package com.sp.selplat.mda.connection.service;

import com.sp.selplat.common.service.BaseServiceImpl;
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

    /**
     * 创建同时具备口令保护和动态 JDBC 连接能力的配置服务。
     *
     * @param credentialCipher Spring 注入的口令加解密组件，例如 {@code CredentialCipher}
     * @param connectionFactory Spring 注入的动态连接工厂，例如 {@code JdbcConnectionFactory}
     */
    public MdaConnectionProfileServiceImpl(CredentialCipher credentialCipher, JdbcConnectionFactory connectionFactory) {
        // 口令组件只在保存、详情脱敏和运行期连接加载时使用。
        this.credentialCipher = credentialCipher;
        // 动态连接工厂只创建目标库连接，不替换 MDA 自身配置数据源。
        this.connectionFactory = connectionFactory;
    }

    /**
     * 复用公共主键查询，并在返回前移除口令密文和明文。
     *
     * @param queryIn 连接配置主键，例如 {@code {"id":10001}}
     * @return 脱敏详情，例如
     *     {@code {"success":true,"data":{"id":10001,"connectionName":"本地 H2","passwordSaved":true},}
     *     {@code "msg":"详情查询完成。"}}
     */
    @Override
    public CommonResult getById(CommonParam queryIn) {
        CommonResult result = super.getById(queryIn);
        @SuppressWarnings("unchecked")
        Map<String, Object> record = (Map<String, Object>) result.getData();
        scrubSecret(record);
        return result;
    }

    /**
     * 规范化新连接默认字段、加密页面口令后复用公共新增流程，并对返回数据脱敏。
     *
     * @param saveIn 页面连接字段，例如
     *     {@code {"connectionName":"本地 H2","databaseType":"h2","databaseName":"mem:mda","password":"secret"}}
     * @return 不含口令和密文的新增结果，例如
     *     {@code {"success":true,"data":{"id":10001,"databaseType":"H2","passwordSaved":true},"msg":"新增完成。"}}
     */
    @Override
    public CommonResult insert(CommonParam saveIn) {
        normalizeNewProfile(saveIn);
        replacePassword(saveIn, true);
        CommonResult result = super.insert(saveIn);
        scrubSecret(saveIn.getParamMap());
        return result;
    }

    /**
     * 规范化数据库类型、按需更新加密口令后复用公共更新流程，并对返回数据脱敏。
     *
     * @param saveIn 主键和更新字段，例如
     *     {@code {"id":10001,"databaseType":"postgresql","password":"new-secret"}}
     * @return 不含口令和密文的更新结果，例如
     *     {@code {"success":true,"data":{"id":10001,"databaseType":"POSTGRESQL","passwordSaved":true},}
     *     {@code "msg":"更新完成。"}}
     */
    @Override
    public CommonResult update(CommonParam saveIn) {
        normalizeType(saveIn);
        replacePassword(saveIn, false);
        CommonResult result = super.update(saveIn);
        scrubSecret(saveIn.getParamMap());
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
