package com.sp.selplat.common.service.grid;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.sp.selplat.common.db.metadata.model.ColumnMetadata;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 验证公共表格头解析在单工程、远程工程和静默字段名降级三种部署状态下保持相同列契约。 */
class GridColumnDefinitionSupportTest {

    /**
     * 验证本地提供者命中时优先返回业务配置。
     *
     * 执行结果示例：{@code nameZh} 的表格头显示为“中文名称”，不读取后备字段名。
     */
    @Test
    void shouldPreferLocalConfiguredColumns() {
        GridColumnDefinitionProvider provider = (tableName, gridId, locale) -> List.of(Map.of(
                "id", "nameZh", "field", "nameZh", "label", "中文名称", "renderer", "text"));

        GridColumnDefinitionSupport.Resolution resolution = GridColumnDefinitionSupport.resolve(
                List.of(provider), "", "ReferenceDataType", "selGridTypeManagementId", "zh-CN", metadata());

        assertEquals("REFERENCE_DATA_TABLE_COLUMN", resolution.source());
        assertEquals("中文名称", resolution.columns().get(0).get("label"));
    }

    /**
     * 验证独立 Reference Data HTTP 服务返回的配置可以直接接入公共入口。
     *
     * @throws Exception 本地真实 HTTP Server 无法创建或关闭时抛出
     * 执行结果示例：远程返回“远程名称”后公共结果来源为 {@code REFERENCE_DATA_TABLE_COLUMN}。
     */
    @Test
    void shouldUseRemoteConfiguredColumnsWhenApplicationIsSplit() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/reference-data/admin/table-columns/resolve.htm", exchange -> {
            byte[] body = ("{\"success\":true,\"data\":{\"columns\":["
                    + "{\"id\":\"nameZh\",\"field\":\"nameZh\",\"label\":\"远程名称\",\"renderer\":\"text\"}]}}")
                    .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            String serviceUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            GridColumnDefinitionSupport.Resolution resolution = GridColumnDefinitionSupport.resolve(
                    List.of(), serviceUrl, "ReferenceDataType", "selGridTypeManagementId", "zh-CN", metadata());
            assertEquals("REFERENCE_DATA_TABLE_COLUMN", resolution.source());
            assertEquals("远程名称", resolution.columns().get(0).get("label"));
        } finally {
            server.stop(0);
        }
    }

    /**
     * 验证本地提供者异常且远程接口未配置时不抛错误，而是直接显示字段名。
     *
     * 执行结果示例：返回 {@code label=id}、{@code label=nameZh} 两列且来源为
     * {@code DEFAULT_FIELD_NAME}。
     */
    @Test
    void shouldSilentlyFallbackToFieldNames() {
        GridColumnDefinitionProvider unavailable = (tableName, gridId, locale) -> {
            throw new IllegalStateException("configuration unavailable");
        };

        GridColumnDefinitionSupport.Resolution resolution = GridColumnDefinitionSupport.resolve(
                List.of(unavailable), "", "ReferenceDataType", "selGridTypeManagementId", "zh-CN", metadata());

        assertEquals("DEFAULT_FIELD_NAME", resolution.source());
        assertEquals(List.of("id", "nameZh"), resolution.columns().stream().map(column -> column.get("label")).toList());
    }

    private Map<String, ColumnMetadata> metadata() {
        Map<String, ColumnMetadata> metadata = new LinkedHashMap<>();
        metadata.put("id", column("ReferenceDataType", "id"));
        metadata.put("nameZh", column("ReferenceDataType", "nameZh"));
        return metadata;
    }

    private ColumnMetadata column(String tableName, String columnName) {
        ColumnMetadata metadata = new ColumnMetadata();
        metadata.setTableName(tableName);
        metadata.setColumnName(columnName);
        return metadata;
    }
}
