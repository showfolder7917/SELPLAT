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
        String page = new ClassPathResource("static/reference-data/reference-data.html")
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(script)
                .contains("const referenceDataNavigationUrl = \"/api/reference-data/workbench/navigation.htm\"")
                .contains("* 注释约定：")
                .contains("每个有效语句或连续语句组前都说明业务目的")
                .contains("纯括号、逗号和链式调用的续行不重复写注释")
                .contains("// 当前模块是本次 Payload 中所有标题、字段和动作的共同来源。")
                .contains("// 所有语义事件都从 Panel 根节点冒泡，在这里集中监听一次。")
                .contains("async function referenceDataLoadNavigation()")
                .contains("key !== \"columns\"")
                .contains("async function referenceDataEnsureModuleLoaded(module, force = false)")
                .contains("await referenceDataLoadModuleView(referenceDataActiveModule())")
                .doesNotContain("async function referenceDataLoadAllModules()")
                .contains("key: \"tables\", tableName: \"ReferenceDataTable\", gridId: \"selGridTableManagementId\"")
                .contains("api: \"/api/reference-data/admin/tables/\"")
                .contains("key: \"bindings\", tableName: \"ReferenceDataControlBinding\", gridId: \"selGridControlBindingManagementId\"")
                .contains("api: \"/api/reference-data/admin/control-bindings/\"")
                .contains("referenceDataTextField(\"gridColumnId\", \"表格配置 ID\"")
                .contains("label: \"暂无数据类型\", icon: \"ri-information-line\"")
                .contains("disabled: true, selected: true")
                .contains("url: `${module.api}getGridColumn.htm?${queryParams}`")
                .doesNotContain("/api/reference-data/admin/table-columns/resolve.htm?${queryParams}")
                .doesNotContain("function referenceDataSafeColumns")
                .contains("async function referenceDataOpenTableColumns(record)")
                .contains("if ([\"tables\", \"options\"].includes(module.key)) return []")
                .contains("await referenceDataSwitchModule(\"columns\")")
                .contains("referenceDataState.selectedTable = selFreeze({ ...record })")
                .contains("function referenceDataRenderTableDetail()")
                .contains("function referenceDataReturnToTableList()")
                .contains("backButton.addEventListener(\"click\", referenceDataReturnToTableList)")
                .contains("function referenceDataCreateTableDetailTabs()")
                .contains("function referenceDataLoadModuleView(")
                .contains("await Promise.all(dependencies)")
                .contains("referenceDataState.columns.has(module.key)")
                .contains("`正在加载${module.name}…`")
                .contains("if (referenceDataState.activeKey === key)")
                .contains("label: (record) => Number(record.status) === 1 ? \"停用\" : \"启用\"")
                .contains("? \"ri-forbid-2-line\" : \"ri-checkbox-circle-line\"")
                .contains("data: { id: record.id, status: nextStatus }")
                .doesNotContain("data: { ...record, status: nextStatus }")
                .contains("[[\"info\", \"基本信息\"], [\"columns\", \"表格列配置\"], [\"preview\", \"效果预览\"]]")
                .contains("\"data-reference-data-detail-tab\": tab")
                .contains("label: module.key === \"tables\" ? \"打开表格配置\"")
                .contains("if (target.moduleKey === \"tables\")")
                .contains("referenceDataState.deleteConfirmController = confirmDialog.mount")
                .contains("async function referenceDataBuildDeleteMessage(module, record)")
                .contains("await referenceDataEnsureModuleLoaded(referenceDataModules.columns)")
                .contains("String(column.tableName) === String(record.tableName)")
                .contains("String(column.gridId) === String(record.gridColumnId)")
                .contains("`当前关联 ${associatedColumnCount} 个表格列配置。删除仅停用表格定义，不会删除列配置。`")
                .contains("const confirmed = await referenceDataState.deleteConfirmController.open")
                .contains("if (!confirmed) return false")
                .contains("return referenceDataDelete(module, Number(record.id))")
                .contains("/api/reference-data/admin/table-columns/page-editor-capability.htm")
                .contains("function referenceDataMountWorkspace(payload)")
                .contains("function referenceDataMountManagementControls(windowMessages)")
                .contains("function referenceDataMountPageEditor(canEditPage)")
                .contains("function referenceDataBindGridAndTreeEvents()")
                .contains("function referenceDataBindFormAndPreviewEvents()")
                .contains("referenceDataMountPageEditor(pageEditorCapability.data?.canEditPage === true)")
                .contains("const { element, freeze: selFreeze } = selBase")
                .contains("function referenceDataCreateTablePreview(columns)")
                .doesNotContain("document.createElement(")
                .contains("id: \"selGridReferenceDataPageEditorId\"")
                .contains("changeEvent: \"selGrid:columnResizeChange\"")
                .contains("label: \"业务数据表\", value: module.tableName")
                .contains("label: \"表格控件 ID\", value: module.gridId")
                .contains("url: \"/api/reference-data/admin/table-columns/save-widths.htm\"")
                .contains("widths: JSON.stringify(widths)")
                .contains("await referenceDataLoadResolvedColumns(module, true)")
                .contains("if (module.key === \"options\") return \"typeId\"")
                .contains("menuTitle: [\"options\", \"bindings\"].includes(module.key) ? \"选择引用数据类型\"")
                .contains("function referenceDataBuildBindingWindowRows()")
                .contains("name: \"controlType\", label: \"控件类型\"")
                .contains("referenceDataTextField(\"controlId\", \"SEL 控件实例 ID\"")
                .doesNotContain("selDropdownOptionManagerPageEditorId")
                .doesNotContain("referenceDataOpenOptionManager")
                .doesNotContain("selWindowDropdownOptionManagerId")
                .contains("await referenceDataConfirmAndDelete(module, record)")
                .contains("请先保存或取消当前页面更改。")
                .doesNotContain("存在关联数据时由数据库阻止不安全操作")
                .doesNotContain("deleteWindowController")
                .doesNotContain("selWindowReferenceDataDeleteId");
        assertThat(page)
                .contains("/sel/components/confirm-dialog/selConfirmDialog.css")
                .contains("/sel/components/confirm-dialog/selConfirmDialog.js")
                .contains("selPersonalization.js?v=20260814-action-editor-1")
                .contains("selWindow.js?v=20260814-custom-content-1")
                .contains("reference-data.js?v=20260814-control-binding-1");
    }
}
