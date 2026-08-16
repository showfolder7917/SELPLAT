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
                .contains("referenceDataState.records.set(\"controls\", result.data.controls)")
                .contains("/api/reference-data/page-editor-capability")
                .contains("tableTitle: `${module.name}表格`, tableCode: tableRecord?.code || \"尚未登记\"")
                .contains("querySelector('[data-sel-grid-role=\"table-heading\"]')")
                .contains("const editorId = `selWindow${module.key.charAt(0).toUpperCase()}${module.key.slice(1)}ReferenceDataPageEditorId`")
                .contains("controller.setPageEditMetadata({ title: \"Window\", code: windowRecord.code })")
                .contains("controller.getPageEditTarget()")
                .contains("{ label: \"来源表\", value: \"ReferenceDataWindow\" }")
                .contains("captureState: () => controller.getGeometry()")
                .contains("saveState: (geometry) => referenceDataSaveWindowGeometry(windowRecord, geometry, controller)")
                .contains("jsonData: { baseVersion: referenceDataState.pageVersion, windows: [savedGeometry] }")
                .contains("[\"types\", \"tables\", \"controls\", \"windows\"].includes(module.key)")
                .contains("jsonData: { baseVersion: referenceDataState.pageVersion, tableElements: widths }")
                .contains("referenceDataMountQueryControlEditors()")
                .contains("referenceDataState.searchController?.setIndependentLayout(true)")
                .contains("referenceDataState.searchController?.getLayoutTargets?.()")
                .contains("key: \"keyword\", targetKey: \"keyword\"")
                .contains("key: \"codeTypes\", targetKey: \"code\", fieldName: \"code\"")
                .contains("key: \"parentTypeCode\", targetKey: \"parentTypeCode\"")
                .contains("fieldName: \"submit.types\"")
                .contains("fieldName: \"submit.controls\"")
                .contains("searchFields: [\"code\", \"parentTypeCode\"]")
                .contains("{ name: \"parentTypeCode\", label: \"上级类型 Code\"")
                .contains("searchFields: [\"code\", \"parentId\"]")
                .contains("queryFields: [")
                .contains("mode: module.key === \"controls\" ? \"REMOTE\" : \"LOCAL\"")
                .contains("parameters.set(\"codeLike\", normalized.code)")
                .contains("parameters.set(\"parentCodeLike\", normalized.parentCode)")
                .contains("parameters.set(\"optionSetCodeLike\", normalized.optionSetCode)")
                .contains("root.addEventListener(\"selGrid:queryChange\"")
                .contains("searchFields: [\"code\", \"tableId\"]")
                .contains("placeholder: module.searchPlaceholder")
                .contains("jsonData: { baseVersion: referenceDataState.pageVersion, controls: [savedLayout] }")
                .contains("const geometry = {")
                .contains("direct: true")
                .contains("key: \"referenceDataQueryToolbar\"")
                .contains("host: sharedEditHost")
                .contains("follow: definition.key === \"reset\"")
                .contains("flow: { key: \"referenceDataQueryToolbar\", gap: 12, order: definition.orderNo }")
                .contains("resetTarget.insertAdjacentElement(\"afterend\", sharedEditHost)")
                .contains("record.parentKind) === \"TOOLBAR\"")
                .contains("Number(record.tableId) === Number(referenceDataState.selectedTable.id)")
                .doesNotContain("ReferenceDataOption")
                .doesNotContain("ReferenceDataContextMenuItem")
                .doesNotContain("ReferenceDataTableColumn")
                .doesNotContain("ReferenceDataControlBinding")
                .doesNotContain("请先保存或取消当前页面更改")
                .doesNotContain("confirmDiscard")
                .doesNotContain("reference-data-query-editor-deck")
                .doesNotContain("reference-data-query-editor-card")
                .doesNotContain("[\"PAGE\", \"WINDOW\", \"PANEL\"")
                .doesNotContain("Window 子控件填写稳定字段名")
                .doesNotContain("save-widths.htm")
                .doesNotContain("document.createElement(");
    }
}
