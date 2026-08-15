package com.sp.selplat.referencedata;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/** 验证引用数据前端只使用最终六表模型和页面级保存接口。 */
class ReferenceDataSixTableContractTest {

    /**
     * 验证前端注册表、唯一 code、表格外键和 JSON 页面保存契约。
     * 真实传参示例：读取 classpath 中 {@code static/reference-data/reference-data.js}。
     * 真实返回示例：脚本包含六表新接口且不包含四张已删除旧表或旧列宽入口。
     * 异常或副作用示例：资源缺失时测试失败；方法不修改文件或数据库。
     *
     * @throws Exception 页面脚本无法读取时抛出
     */
    @Test
    void shouldUseOnlySixTablePageConfigurationContract() throws Exception {
        String script = new ClassPathResource("static/reference-data/reference-data.js")
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(script)
                .contains("tableName: \"ReferenceDataType\"")
                .contains("tableName: \"ReferenceDataTreeNode\"")
                .contains("tableName: \"ReferenceDataTable\"")
                .contains("tableName: \"ReferenceDataTableElement\"")
                .contains("tableName: \"ReferenceDataControlLayout\"")
                .contains("tableName: \"ReferenceDataWindow\"")
                .contains("referenceDataLoadPageConfiguration()")
                .contains("/api/reference-data/page-editor-capability")
                .contains("jsonData: { baseVersion: referenceDataState.pageVersion, tableElements: widths }")
                .contains("Number(record.tableId) === Number(referenceDataState.selectedTable.id)")
                .doesNotContain("ReferenceDataOption")
                .doesNotContain("ReferenceDataContextMenuItem")
                .doesNotContain("ReferenceDataTableColumn")
                .doesNotContain("ReferenceDataControlBinding")
                .doesNotContain("save-widths.htm")
                .doesNotContain("document.createElement(");
    }
}
