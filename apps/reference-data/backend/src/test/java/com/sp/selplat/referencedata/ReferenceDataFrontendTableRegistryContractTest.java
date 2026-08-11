package com.sp.selplat.referencedata;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/** 验证表格登记模块能够进入对应的数据库驱动表格头明细。 */
class ReferenceDataFrontendTableRegistryContractTest {

    /**
     * 验证表格登记出现在导航和编辑表单中，并使用表格配置 ID 筛选对应列。
     *
     * 真实传参示例：点击 {@code reference-data / ReferenceDataType / selGridTypeManagementId} 表格记录。
     * 真实返回示例：页面切换到 {@code ReferenceDataTableColumn} 并搜索 {@code selGridTypeManagementId}。
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
                .contains("await referenceDataEnsureModuleLoaded(referenceDataActiveModule())")
                .doesNotContain("async function referenceDataLoadAllModules()")
                .contains("key: \"tables\", tableName: \"ReferenceDataTable\", gridId: \"selGridTableManagementId\"")
                .contains("api: \"/api/reference-data/admin/tables/\"")
                .contains("referenceDataText(\"gridColumnId\", \"表格配置 ID\"")
                .contains("async function referenceDataOpenTableColumns(referenceDataRecord)")
                .contains("await referenceDataSwitchModule(\"columns\")")
                .contains("String(referenceDataRecord.gridColumnId || referenceDataRecord.tableName || \"\")")
                .contains("label: referenceDataModule.key === \"tables\" ? \"查看表格头\"")
                .contains("if (referenceDataTarget.moduleKey === \"tables\")");
    }
}
