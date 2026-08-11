package com.sp.selplat.referencedata.referencedatatablecolumn.service.impl;

import com.sp.selplat.common.service.grid.GridColumnDefinitionProvider;
import com.sp.selplat.referencedata.referencedatatablecolumn.service.ReferenceDataTableColumnService;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * 把当前单工程中的 ReferenceDataTableColumn Service 接入公共 getGridColumn 扩展点。
 * 本实现不发送 HTTP；未来拆分部署时由公共远程客户端使用同一 resolve.htm 契约替代。
 */
@Component
public class ReferenceDataGridColumnDefinitionProvider implements GridColumnDefinitionProvider {

    // 只调用表格头业务 Service，提供者不越过 Service 直接访问其他表 DAO。
    private final ReferenceDataTableColumnService tableColumnService;

    /**
     * 创建当前进程内的表格头配置提供者。
     *
     * @param tableColumnService Spring 注入的表格头业务 Service，例如当前 reference-data 私有库实现
     */
    public ReferenceDataGridColumnDefinitionProvider(@Lazy ReferenceDataTableColumnService tableColumnService) {
        this.tableColumnService = tableColumnService;
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> resolve(String tableName, String gridId, String locale) {
        // 公共请求坐标 → 当前表格头 Service 返回 SEL Grid 标准列，不产生第二套映射逻辑。
        return tableColumnService.resolveColumnDefinitions(tableName, gridId, locale);
    }
}
