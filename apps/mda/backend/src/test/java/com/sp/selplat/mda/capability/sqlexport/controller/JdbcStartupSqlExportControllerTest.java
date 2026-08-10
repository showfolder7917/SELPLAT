package com.sp.selplat.mda.capability.sqlexport.controller;

import com.sp.selplat.mda.capability.sqlexport.controller.JdbcStartupSqlExportController;
import com.sp.selplat.mda.capability.sqlexport.service.JdbcStartupSqlExportService;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import org.junit.jupiter.api.Test;

/**
 * 验证两个启动 SQL 导出 API 分别委托正确 Service 方法并保留公共响应结构。
 */
class JdbcStartupSqlExportControllerTest {

    /**
     * 验证单表导出接口不会误调用全库导出。
     * 真实传参示例：{@code {connectionId=1,schema=PUBLIC,tableName=DemoItem}}。
     * 真实返回示例：JSON 包含 {@code success=true,msg=表启动 SQL 导出完成。}。
     * 异常或副作用示例：mock Service 不访问数据库或文件，只记录一次 exportTable 调用。
     */
    @Test
    void delegatesTableExport() {
        JdbcStartupSqlExportService service = mock(JdbcStartupSqlExportService.class);
        CommonParam request = new CommonParam();
        request.putParam("connectionId", 1L);
        request.putParam("schema", "PUBLIC");
        request.putParam("tableName", "DemoItem");
        when(service.exportTable(same(request))).thenReturn(success("表启动 SQL 导出完成。"));

        String json = new JdbcStartupSqlExportController(service).exportTable(request);

        assertThat(json).contains("\"success\":true").contains("表启动 SQL 导出完成。");
        verify(service).exportTable(same(request));
    }

    /**
     * 验证数据库导出接口不会误调用单表导出。
     * 真实传参示例：{@code {connectionId=1,catalog=mda}}。
     * 真实返回示例：JSON 包含 {@code success=true,msg=数据库启动 SQL 导出完成。}。
     * 异常或副作用示例：mock Service 不访问数据库或文件，只记录一次 exportDatabase 调用。
     */
    @Test
    void delegatesDatabaseExport() {
        JdbcStartupSqlExportService service = mock(JdbcStartupSqlExportService.class);
        CommonParam request = new CommonParam();
        request.putParam("connectionId", 1L);
        request.putParam("catalog", "mda");
        when(service.exportDatabase(same(request))).thenReturn(success("数据库启动 SQL 导出完成。"));

        String json = new JdbcStartupSqlExportController(service).exportDatabase(request);

        assertThat(json).contains("\"success\":true").contains("数据库启动 SQL 导出完成。");
        verify(service).exportDatabase(same(request));
    }

    /** 创建控制器测试需要的最小公共成功结果。 */
    private CommonResult success(String message) {
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setMsg(message);
        return result;
    }
}
