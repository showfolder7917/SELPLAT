package com.sp.selplat.mda.common.util.jdbc;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.connectionprofile.service.MdaConnectionProfileService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 把已保存连接配置或页面临时字段统一解析为目标数据库运行定义。
 * metadata、sql 和连接测试共同依赖本组件，不再借用连接配置 CRUD Service 承载转换职责。
 */
@Component
public class MdaConnectionDefinitionResolver {

    private final MdaConnectionProfileService profileService;

    /**
     * 创建使用公共连接配置查询能力的定义解析器。
     *
     * @param profileService 只提供公共 CRUD 的连接配置 Service，例如 {@code MdaConnectionProfileServiceImpl}
     *     <p>构造完成后无返回值；副作用是保存配置查询入口供运行期按 connectionId 读取控制库。
     */
    public MdaConnectionDefinitionResolver(MdaConnectionProfileService profileService) {
        this.profileService = profileService;
    }

    /**
     * 解析已保存连接或页面临时连接字段。
     *
     * @param queryIn 已保存连接例如 {@code {"connectionId":100000}}；临时连接例如
     *     {@code {"databaseType":"H2","databaseName":"mem:mda_demo","username":"sa"}}
     * @return 目标连接定义，例如 {@code MdaConnectionDefinition[databaseType=H2,databaseName=mem:mda_demo]}
     * @throws CommonBusinessException 当参数为空、主键非法或配置不存在时抛出，例如
     *     {@code CommonBusinessException("MDA_CONNECTION_REQUIRED", "连接参数不能为空。")}
     */
    public MdaConnectionDefinition resolve(CommonParam queryIn) {
        if (queryIn == null) {
            throw new CommonBusinessException("MDA_CONNECTION_REQUIRED", "连接参数不能为空。");
        }
        Object connectionId = queryIn.getParam("connectionId");
        Map<String, Object> source = connectionId == null || String.valueOf(connectionId).isBlank()
                ? new LinkedHashMap<>(queryIn.getParamMap())
                : loadSavedConnection(requiredId(connectionId));
        return toDefinition(source);
    }

    /**
     * 按控制库主键读取一条已保存连接配置。
     *
     * @param id 连接配置主键，例如 {@code 100000L}
     * @return 控制库字段副本，例如 {@code {"id":100000,"databaseType":"H2"}}
     * @throws CommonBusinessException 当公共详情查询未返回字段映射时抛出，例如错误编码
     *     {@code MDA_CONNECTION_NOT_FOUND}
     */
    private Map<String, Object> loadSavedConnection(long id) {
        CommonParam idParam = new CommonParam();
        idParam.putParam("id", id);
        CommonResult result = profileService.getById(idParam);
        if (!(result.getData() instanceof Map<?, ?> record)) {
            throw new CommonBusinessException("MDA_CONNECTION_NOT_FOUND", "未找到连接配置：" + id);
        }
        Map<String, Object> source = new LinkedHashMap<>();
        record.forEach((key, value) -> source.put(String.valueOf(key), value));
        return source;
    }

    /**
     * 把控制库字段映射提取为目标 JDBC 连接需要的最小定义。
     *
     * @param source 控制库记录或页面临时字段，例如 {@code {"databaseType":"H2","databaseName":"mem:demo"}}
     * @return 不含审计字段的连接定义，例如 {@code MdaConnectionDefinition[databaseType=H2,databaseName=mem:demo]}
     */
    private MdaConnectionDefinition toDefinition(Map<String, Object> source) {
        return new MdaConnectionDefinition(
                text(source.get("databaseType")),
                text(source.get("host")),
                integer(source.get("port")),
                text(source.get("databaseName")),
                text(source.get("schemaName")),
                text(source.get("username")),
                text(source.get("password")),
                text(source.get("customJdbcUrl")),
                text(source.get("jdbcParameters")),
                bool(source.get("defaultAutoCommit"), true));
    }

    /**
     * 把连接配置主键转换为长整数。
     *
     * @param value 数字或数字文本，例如 {@code "100000"}
     * @return 长整数主键，例如 {@code 100000L}
     * @throws CommonBusinessException 当值不是数字时抛出，例如错误编码 {@code MDA_CONNECTION_ID_INVALID}
     */
    private long requiredId(Object value) {
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new CommonBusinessException("MDA_CONNECTION_ID_INVALID", "id 必须是数字。", exception);
        }
    }

    /**
     * 把字段值转换为保持原内容的文本。
     *
     * @param value 数据库字段值，例如 {@code "sa"}
     * @return 文本 {@code "sa"}；输入为 null 时返回 {@code null}
     */
    private String text(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    /**
     * 把端口值转换为整数。
     *
     * @param value 数值或数字文本，例如 {@code "5432"}
     * @return 端口整数 {@code 5432}；空值返回 {@code null}
     * @throws NumberFormatException 当非空文本不是整数时抛出，例如 {@code "abc"}
     */
    private Integer integer(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        return value instanceof Number number ? number.intValue() : Integer.valueOf(String.valueOf(value));
    }

    /**
     * 把连接开关值转换为布尔值。
     *
     * @param value 布尔值或文本，例如 {@code "false"}
     * @param defaultValue 空值默认值，例如 {@code true}
     * @return 解析结果，例如 {@code false}
     */
    private boolean bool(Object value, boolean defaultValue) {
        return value == null
                ? defaultValue
                : value instanceof Boolean flag ? flag : Boolean.parseBoolean(String.valueOf(value));
    }
}
