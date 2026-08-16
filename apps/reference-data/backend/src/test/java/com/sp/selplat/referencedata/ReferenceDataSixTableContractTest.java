package com.sp.selplat.referencedata;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
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
                .contains("tableTitle: module.name, tableCode: tableRecord?.code || referenceDataText")
                .contains("querySelector('[data-sel-grid-role=\"table-heading\"]')")
                .contains("const editorId = `selWindow${module.key.charAt(0).toUpperCase()}${module.key.slice(1)}ReferenceDataPageEditorId`")
                .contains("controller.setPageEditMetadata({ title: \"Window\", code: windowRecord.code })")
                .contains("controller.getPageEditTarget()")
                .contains("referenceDataText(\"editor.sourceTable\", {}, \"来源表\"), value: \"ReferenceDataWindow\"")
                .contains("captureState: () => controller.getGeometry()")
                .contains("saveState: (geometry) => referenceDataSaveWindowGeometry(windowRecord, geometry, controller)")
                .contains("jsonData: { baseVersion: referenceDataState.pageVersion, windows: [savedGeometry] }")
                .contains("[\"types\", \"tables\", \"controls\", \"windows\"].includes(module.key)")
                .contains("jsonData: { baseVersion: referenceDataState.pageVersion, tableElements: widths }")
                .contains("referenceDataMountQueryControlEditors()")
                .contains("referenceDataState.searchController?.setIndependentLayout(true)")
                .contains("referenceDataState.searchController?.getLayoutTargets?.()")
                .contains("key: \"code\", targetKey: \"code\"")
                .contains("key: \"parentTypeCode\", targetKey: \"parentTypeCode\"")
                .contains("key: \"parentId\", targetKey: \"parentId\"")
                .contains("key: \"tableId\", targetKey: \"tableId\"")
                .contains("key: \"submit\", targetKey: \"submit\"")
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
                .contains("{ name: \"tableId\", label: \"所属表 ID\"")
                .contains("placeholder: module.searchPlaceholder")
                .contains("jsonData: { baseVersion: referenceDataState.pageVersion, controls: [savedLayout] }")
                .contains("const geometry = {")
                .contains("direct: true")
                .contains("key: \"referenceDataQueryToolbar\"")
                .contains("host: sharedEditHost")
                .contains("follow: definition.key === \"reset\"")
                .contains("key: \"referenceDataQueryToolbar\"")
                .contains("moveGroup: definitionIndex === 0")
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
                .doesNotContain("key: \"keyword\"")
                .doesNotContain("submit.default")
                .doesNotContain("submit.types")
                .doesNotContain("submit.controls")
                .doesNotContain("[\"PAGE\", \"WINDOW\", \"PANEL\"")
                .doesNotContain("Window 子控件填写稳定字段名")
                .doesNotContain("save-widths.htm")
                .doesNotContain("document.createElement(");
    }

    /**
     * 验证引用数据应用同时提供中日英完整同构语言包并接入公共原子语言运行时。
     * 真实传参示例：读取 {@code static/reference-data/i18n/zh-CN.json}、{@code ja-JP.json} 和 {@code en-US.json}。
     * 真实返回示例：三份叶子键集合完全相同，页面脚本登记 {@code reference-data.project} 并暴露无刷新切换入口。
     * 异常或副作用示例：语言包缺失、JSON 无效或键不一致时测试失败；方法不修改资源和数据库。
     *
     * @throws Exception 语言资源或页面脚本无法读取时抛出
     */
    @Test
    void shouldProvideIsomorphicRuntimeLocaleResources() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode chinese = mapper.readTree(readResource("static/reference-data/i18n/zh-CN.json"));
        JsonNode japanese = mapper.readTree(readResource("static/reference-data/i18n/ja-JP.json"));
        JsonNode english = mapper.readTree(readResource("static/reference-data/i18n/en-US.json"));
        assertThat(leafKeys(japanese)).isEqualTo(leafKeys(chinese));
        assertThat(leafKeys(english)).isEqualTo(leafKeys(chinese));

        String html = readResource("static/reference-data/reference-data.html");
        String script = readResource("static/reference-data/reference-data.js");
        assertThat(html).contains("/sel/core/selLocaleRuntime.js");
        assertThat(script)
                .contains("\"locale.runtime\"")
                .contains("selplat.reference-data.locale")
                .contains("referenceDataLoadLocaleResources")
                .contains("id: \"reference-data.project\"")
                .contains("referenceDataLocalizedText")
                .contains("setLocale: (nextLocale)");
    }

    /**
     * 读取一个 classpath 文本资源。
     * 真实传参示例：{@code static/reference-data/i18n/en-US.json}。
     * 真实返回示例：返回 UTF-8 JSON 文本。
     * 异常或副作用示例：资源不存在时抛出异常；不修改文件。
     *
     * @param path classpath 相对路径
     * @return UTF-8 文本
     * @throws Exception 资源无法读取时抛出
     */
    private String readResource(String path) throws Exception {
        return new ClassPathResource(path).getContentAsString(StandardCharsets.UTF_8);
    }

    /**
     * 收集 JSON 中全部叶子键路径，验证不同语言结构同构。
     * 真实传参示例：包含 {@code page.title} 和 {@code action.save} 的语言根节点。
     * 真实返回示例：返回排序后的 {@code [action.save, page.title]}。
     * 异常或副作用示例：空节点返回空集合；不修改输入 JSON。
     *
     * @param root JSON 根节点
     * @return 排序后的叶子键路径集合
     */
    private Set<String> leafKeys(JsonNode root) {
        Set<String> keys = new TreeSet<>();
        collectLeafKeys(root, "", keys);
        return keys;
    }

    /**
     * 递归把 JSON 叶子键加入结果集合。
     * 真实传参示例：根路径为空、节点为 {@code {"page":{"title":"x"}}}。
     * 真实返回示例：结果集合新增 {@code page.title}。
     * 异常或副作用示例：null 节点不会新增键；只修改调用方传入的结果集合。
     *
     * @param node 当前 JSON 节点
     * @param prefix 当前键路径
     * @param keys 收集结果
     */
    private void collectLeafKeys(JsonNode node, String prefix, Set<String> keys) {
        if (node == null) return;
        if (!node.isObject()) {
            keys.add(prefix);
            return;
        }
        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            collectLeafKeys(field.getValue(), prefix.isEmpty() ? field.getKey() : prefix + "." + field.getKey(), keys);
        }
    }
}
