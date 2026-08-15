package com.sp.selplat.referencedata.capability.configuration.service.impl;

import com.sp.selplat.common.service.grid.GridColumnDefinitionProvider;
import com.sp.selplat.referencedata.capability.configuration.service.ReferenceDataConfigurationService;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/** 把六表配置服务接入公共 BaseService.getGridColumn 扩展点。 */
@Component
public class ReferenceDataGridColumnDefinitionProvider implements GridColumnDefinitionProvider {

    private final ReferenceDataConfigurationService configurationService;

    /**
     * 创建以表格唯一 code 为入口的本地 Grid 配置提供者。
     * 真实传参示例：Spring 延迟注入 ReferenceDataConfigurationServiceImpl。
     * 真实返回示例：提供者可为任一业务 Service 返回 ReferenceDataTableElement 列配置。
     * 异常或副作用示例：配置服务缺失时应用启动失败；构造过程不访问数据库。
     *
     * @param configurationService 六表 code 与页面配置服务
     */
    public ReferenceDataGridColumnDefinitionProvider(
            @Lazy ReferenceDataConfigurationService configurationService) {
        this.configurationService = configurationService;
    }

    /**
     * 通过真实业务表名和 ReferenceDataTable.code 解析公共 Grid 列。
     * 真实传参示例：{@code ReferenceDataType/table101018/zh-CN}。
     * 真实返回示例：返回中文表头、宽度和 renderer 的标准列数组。
     * 异常或副作用示例：坐标不匹配时返回空数组并由公共服务回退元数据；方法不修改数据库。
     *
     * @param tableName 当前业务 Service 的真实表名
     * @param gridId 当前协议中承载的 ReferenceDataTable 唯一 code
     * @param locale 页面语言
     * @return SEL Grid 标准列数组
     */
    @Override
    public List<Map<String, Object>> resolve(String tableName, String gridId, String locale) {
        return configurationService.resolveGridColumns(tableName, gridId, locale);
    }
}
