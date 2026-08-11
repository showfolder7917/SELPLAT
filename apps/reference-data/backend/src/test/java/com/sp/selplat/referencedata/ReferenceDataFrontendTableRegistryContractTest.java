package com.sp.selplat.referencedata;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/** 验证表格定义模块通过统一表格头接口进入基本信息、列配置和效果预览。 */
class ReferenceDataFrontendTableRegistryContractTest {

    /**
     * 验证表格登记出现在导航和编辑表单中，并使用表格配置 ID 筛选对应列。
     *
     * 真实传参示例：点击 {@code reference-data / ReferenceDataType / selGridTypeManagementId} 表格记录。
     * 真实返回示例：页面打开 {@code ReferenceDataTableColumn} 列配置并保留三页签详情上下文。
     * 异常或副作用示例：记录不存在时不切换模块，也不会修改当前表格筛选条件。
     *
     * @throws Exception 页面脚本资源无法读取时抛出
     */
    @Test
    void shouldOpenRegisteredTableColumnDetails() throws Exception {
        String script = new ClassPathResource("static/reference-data/reference-data.js")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("const referenceDataNavigationUrl = \"/api/reference-data/workbench/navigation.htm\"")
                .contains("async function referenceDataLoadNavigation()")
                .contains("referenceDataKey !== \"columns\"")
                .contains("async function referenceDataEnsureModuleLoaded(referenceDataModule, referenceDataForce = false)")
                .contains("await referenceDataLoadModuleView(referenceDataActiveModule())")
                .doesNotContain("async function referenceDataLoadAllModules()")
                .contains("key: \"tables\", tableName: \"ReferenceDataTable\", gridId: \"selGridTableManagementId\"")
                .contains("api: \"/api/reference-data/admin/tables/\"")
                .contains("referenceDataText(\"gridColumnId\", \"表格配置 ID\"")
                .contains("label: \"暂无数据类型\", icon: \"ri-information-line\"")
                .contains("disabled: true, selected: true")
                .contains("url: `${referenceDataModule.api}getGridColumn.htm?${referenceDataQuery}`")
                .doesNotContain("/api/reference-data/admin/table-columns/resolve.htm?${referenceDataQuery}")
                .doesNotContain("function referenceDataSafeColumns")
                .contains("async function referenceDataOpenTableColumns(referenceDataRecord)")
                .contains("if (referenceDataModule.key === \"tables\") return Object.freeze([])")
                .contains("await referenceDataSwitchModule(\"columns\")")
                .contains("referenceDataState.selectedTable = Object.freeze({ ...referenceDataRecord })")
                .contains("function referenceDataRenderTableDetail()")
                .contains("function referenceDataReturnToTableList()")
                .contains(".addEventListener(\"click\", () => referenceDataReturnToTableList())")
                .contains("referenceDataDetail.querySelectorAll(\"[data-reference-data-detail-tab]\")")
                .contains("function referenceDataLoadModuleView(")
                .contains("await Promise.all([")
                .contains("referenceDataState.columns.has(referenceDataModule.key)")
                .contains("`正在加载${referenceDataModule.name}…`")
                .contains("if (referenceDataState.activeKey === referenceDataKey)")
                .contains("data: { id: referenceDataRecord.id, status: referenceDataNextStatus }")
                .doesNotContain("data: { ...referenceDataRecord, status: referenceDataNextStatus }")
                .contains("data-reference-data-detail-tab=\"info\"")
                .contains("data-reference-data-detail-tab=\"columns\"")
                .contains("data-reference-data-detail-tab=\"preview\"")
                .contains("label: referenceDataModule.key === \"tables\" ? \"打开表格配置\"")
                .contains("if (referenceDataTarget.moduleKey === \"tables\")");
    }
}
