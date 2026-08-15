package com.sp.selplat.common.service.grid;

import com.fasterxml.jackson.core.type.TypeReference;
import com.sp.selplat.common.db.metadata.model.ColumnMetadata;
import com.sp.selplat.common.util.JsonUtils;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 统一编排本地表格头提供者、未来独立 Reference Data 服务和数据库字段名降级。
 * 本类不抛出配置查询异常；业务表格在配置缺失或远程不可用时仍能使用真实字段名显示。
 */
public final class GridColumnDefinitionSupport {

    // 远程客户端复用连接池，未来应用拆分后不会为每张表重复创建网络资源。
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(800))
            .build();

    /** 工具类不保存请求状态，禁止外部实例化。 */
    private GridColumnDefinitionSupport() {
    }

    /**
     * 按本地配置、远程配置、字段名的固定优先级解析表格头。
     *
     * @param providers 当前 Spring 容器中可用的本地提供者，例如 Reference Data 本地实现
     * @param serviceUrl 未来独立 Reference Data 服务根地址，例如 {@code "http://reference-data:8080"}
     * @param tableName 当前 DAO 元数据中的真实表名，例如 {@code "ReferenceDataType"}
     * @param gridId 页面表格实例标识，例如 {@code "selGridTypeManagementId"}
     * @param locale 页面语言，例如 {@code "zh-CN"}
     * @param metadata 当前 DAO 的真实字段元数据，例如 {@code {"id":ColumnMetadata,"nameZh":ColumnMetadata}}
     * @return 解析结果，例如 {@code source=REFERENCE_DATA_TABLE_ELEMENT} 和中文列配置；全部配置未命中时
     *     返回 {@code source=DEFAULT_FIELD_NAME} 且 label 等于字段名
     */
    public static Resolution resolve(
            List<GridColumnDefinitionProvider> providers,
            String serviceUrl,
            String tableName,
            String gridId,
            String locale,
            Map<String, ColumnMetadata> metadata) {
        // 当前单工程优先走 Spring 本地实现 → 不产生同进程 HTTP 往返。
        for (GridColumnDefinitionProvider provider : providers == null ? List.<GridColumnDefinitionProvider>of() : providers) {
            try {
                List<Map<String, Object>> columns = immutableColumns(provider.resolve(tableName, gridId, locale));
                if (!columns.isEmpty()) return new Resolution("REFERENCE_DATA_TABLE_ELEMENT", columns);
            } catch (RuntimeException exception) {
                // 某个配置提供者故障只表示当前配置不可用，继续执行静默降级。
                System.getLogger(GridColumnDefinitionSupport.class.getName())
                        .log(System.Logger.Level.DEBUG, "本地表格头配置不可用，已静默降级。", exception);
            }
        }
        // 未来多工程只需配置服务根地址 → 公共入口自动调用同一 resolve.htm 契约。
        List<Map<String, Object>> remoteColumns = resolveRemote(serviceUrl, tableName, gridId, locale);
        if (!remoteColumns.isEmpty()) return new Resolution("REFERENCE_DATA_TABLE_ELEMENT", remoteColumns);
        // 配置未命中或接口不可用 → 使用数据库真实字段名，不把技术失败转换成页面提示。
        return new Resolution("DEFAULT_FIELD_NAME", defaultColumns(metadata));
    }

    /**
     * 把解析结果交给 BaseServiceImpl 组装公共 CommonResult。
     *
     * @param source 表格头来源，例如 {@code "REFERENCE_DATA_TABLE_ELEMENT"}
     * @param columns 标准列清单，例如 {@code [{"id":"id","field":"id","label":"id"}]}
     */
    public record Resolution(String source, List<Map<String, Object>> columns) {

        /**
         * 创建不可变解析结果，避免 Controller 序列化前被调用方改写。
         *
         * @param source 表格头来源，例如 {@code "DEFAULT_FIELD_NAME"}
         * @param columns 标准列清单，例如 {@code [{"id":"id","field":"id","label":"id"}]}
         */
        public Resolution {
            source = String.valueOf(source);
            columns = immutableColumns(columns);
        }
    }

    // 远程服务未配置、超时、非 2xx 或 JSON 无有效列时统一返回空列表，调用方继续字段名降级。
    private static List<Map<String, Object>> resolveRemote(
            String serviceUrl,
            String tableName,
            String gridId,
            String locale) {
        if (serviceUrl == null || serviceUrl.isBlank()) return List.of();
        String endpoint = serviceUrl.replaceAll("/+$", "")
                + "/api/reference-data/admin/table-columns/resolve.htm"
                + "?tableName=" + encode(tableName)
                + "&gridId=" + encode(gridId)
                + "&locale=" + encode(locale);
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofMillis(1200))
                    .GET()
                    .build();
            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) return List.of();
            Map<String, Object> payload = JsonUtils.fromJson(
                    response.body(), new TypeReference<Map<String, Object>>() { });
            Object dataValue = payload == null ? null : payload.get("data");
            if (!(dataValue instanceof Map<?, ?> data)) return List.of();
            Object columnsValue = data.get("columns");
            if (!(columnsValue instanceof List<?> columns)) return List.of();
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object columnValue : columns) {
                if (!(columnValue instanceof Map<?, ?> column)) continue;
                Map<String, Object> normalized = new LinkedHashMap<>();
                column.forEach((key, value) -> normalized.put(String.valueOf(key), value));
                result.add(Collections.unmodifiableMap(normalized));
            }
            return List.copyOf(result);
        } catch (Exception exception) {
            // 网络、超时和响应错误仅写调试日志，页面继续显示字段名且不出现提示。
            System.getLogger(GridColumnDefinitionSupport.class.getName())
                    .log(System.Logger.Level.DEBUG, "远程表格头配置不可用，已静默降级。", exception);
            return List.of();
        }
    }

    // 数据库字段元数据 → id、field、label 均使用真实字段名，完全符合静默后备口径。
    private static List<Map<String, Object>> defaultColumns(Map<String, ColumnMetadata> metadata) {
        List<Map<String, Object>> columns = new ArrayList<>();
        if (metadata == null) return List.of();
        metadata.forEach((metadataKey, columnMetadata) -> {
            String fieldName = columnMetadata != null && columnMetadata.getColumnName() != null
                    ? columnMetadata.getColumnName() : metadataKey;
            Map<String, Object> column = new LinkedHashMap<>();
            column.put("id", fieldName);
            column.put("field", fieldName);
            column.put("label", fieldName);
            column.put("width", "auto");
            column.put("renderer", "text");
            columns.add(Map.copyOf(column));
        });
        return List.copyOf(columns);
    }

    // 提供者结果复制为不可变有序映射，防止缓存或页面转换时修改数据库查询结果。
    private static List<Map<String, Object>> immutableColumns(List<Map<String, Object>> columns) {
        if (columns == null || columns.isEmpty()) return List.of();
        return columns.stream()
                .map(LinkedHashMap::new)
                .map(Collections::unmodifiableMap)
                .toList();
    }

    // 查询参数只编码值，不参与远程 URL 路径拼接。
    private static String encode(String value) {
        return URLEncoder.encode(String.valueOf(value == null ? "" : value), StandardCharsets.UTF_8);
    }
}
