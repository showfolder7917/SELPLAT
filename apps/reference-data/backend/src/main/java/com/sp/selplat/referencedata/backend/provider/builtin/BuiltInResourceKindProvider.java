package com.sp.selplat.referencedata.backend.provider.builtin;

import com.sp.selplat.referencedata.backend.provider.ReferenceDataProvider;
import com.sp.selplat.referencedata.contract.model.ReferenceDataQuery;
import com.sp.selplat.referencedata.contract.model.TreeNode;
import com.sp.selplat.referencedata.contract.model.TypeOption;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 提供 reference-data 自身的资源类型树和选项，作为平台内置且可真实调用的第一个 Provider。
 * 本 Provider 只描述“树资源”和“类型选项资源”两种稳定能力，不保存其他项目的业务数据。
 */
@Component
public class BuiltInResourceKindProvider implements ReferenceDataProvider {

    // 内置资源坐标固定属于 reference-data，供维护页和模块验收稳定调用。
    private static final String PROJECT_CODE = "reference-data";
    // resource-kind 同时提供树与下拉表达，展示 Provider 的两条完整查询链路。
    private static final String RESOURCE_CODE = "resource-kind";
    // 类型选项共用固定分组编码，业务页面无需根据文案推导选项归属。
    private static final String OPTION_GROUP_CODE = "reference-data-resource-kind";
    // 根节点使用稳定全集值，前端无需根据本地化文案判断是否选中全部类型。
    private static final String ROOT_VALUE = "ALL";
    // 根节点属性使用稳定类型标识，避免与可选择的 TREE、OPTIONS 类型混淆。
    private static final String ROOT_KIND = "ROOT";

    /**
     * 返回内置资源所属的平台模块编码。
     *
     * @return 固定项目编码 {@code "reference-data"}
     */
    @Override
    public String getProjectCode() {
        // 平台内置资源 → reference-data 项目坐标。
        return PROJECT_CODE;
    }

    /**
     * 返回资源类型元数据的稳定编码。
     *
     * @return 固定资源编码 {@code "resource-kind"}
     */
    @Override
    public String getResourceCode() {
        // 资源类型元数据 → resource-kind 注册表坐标。
        return RESOURCE_CODE;
    }

    /**
     * 按请求语言返回资源类型层级树。
     *
     * @param query API 或业务 Service 传入的查询，例如
     *     {@code {projectCode:"reference-data",resourceCode:"resource-kind",parameters:{locale:"en-US"}}}
     * @return 单根树，例如
     *     {@code [{id:"resource-kind-root",label:"Reference data resource types",children:[{value:"TREE"},{value:"OPTIONS"}]}]}
     */
    @Override
    public List<TreeNode> loadTree(ReferenceDataQuery query) {
        // locale 参数 → 中文、日文或英文的稳定显示文案。
        ResourceKindLabels labels = labels(query.parameters().get("locale"));
        // 两种引用数据能力 → 根节点下按固定顺序排列的可选择子节点。
        List<TreeNode> children = List.of(
                new TreeNode(
                        "resource-kind-tree",
                        "resource-kind-root",
                        labels.treeLabel(),
                        "TREE",
                        List.of(),
                        Map.of("resourceKind", "TREE")),
                new TreeNode(
                        "resource-kind-options",
                        "resource-kind-root",
                        labels.optionsLabel(),
                        "OPTIONS",
                        List.of(),
                        Map.of("resourceKind", "OPTIONS")));
        // 已本地化子节点 → 可直接交给公共 selTree 的完整单根树。
        return List.of(new TreeNode(
                "resource-kind-root",
                null,
                labels.rootLabel(),
                ROOT_VALUE,
                children,
                Map.of("resourceKind", ROOT_KIND)));
    }

    /**
     * 按请求语言返回资源类型下拉选项。
     *
     * @param query API 或业务 Service 传入的查询，例如
     *     {@code {projectCode:"reference-data",resourceCode:"resource-kind",parameters:{locale:"ja-JP"}}}
     * @return 两个有序选项，例如
     *     {@code [{value:"TREE",label:"ツリーリソース",sortOrder:10},{value:"OPTIONS",label:"選択肢リソース",sortOrder:20}]}
     */
    @Override
    public List<TypeOption> loadOptions(ReferenceDataQuery query) {
        // locale 参数 → 与树节点一致的三语显示文案。
        ResourceKindLabels labels = labels(query.parameters().get("locale"));
        // 稳定业务值 → TREE 在前、OPTIONS 在后的下拉选项结果。
        return List.of(
                new TypeOption(
                        "TREE",
                        labels.treeLabel(),
                        OPTION_GROUP_CODE,
                        10,
                        false,
                        Map.of("resourceKind", "TREE")),
                new TypeOption(
                        "OPTIONS",
                        labels.optionsLabel(),
                        OPTION_GROUP_CODE,
                        20,
                        false,
                        Map.of("resourceKind", "OPTIONS")));
    }

    /**
     * 把外部 locale 值转换成内置资源的三语文案。
     *
     * @param localeValue 查询参数中的语言值，例如 {@code "en-US"}；缺失或未知值按中文处理
     * @return 三个显示文案，例如 {@code ResourceKindLabels("引用数据资源类型", "树形资源", "类型选项资源")}
     */
    private ResourceKindLabels labels(Object localeValue) {
        // 任意参数值 → 去空格后的 BCP-47 语言代码。
        String locale = localeValue == null ? "zh-CN" : String.valueOf(localeValue).trim();
        // 日文请求 → reference-data 内置资源的日文显示文案。
        if ("ja-JP".equalsIgnoreCase(locale)) {
            return new ResourceKindLabels("参照データリソース種別", "ツリーリソース", "選択肢リソース");
        }
        // 英文请求 → reference-data 内置资源的英文显示文案。
        if ("en-US".equalsIgnoreCase(locale)) {
            return new ResourceKindLabels("Reference data resource types", "Tree resource", "Option resource");
        }
        // 缺失、中文或未知语言 → 第一版统一使用稳定中文回退，保证接口始终可读。
        return new ResourceKindLabels("引用数据资源类型", "树形资源", "类型选项资源");
    }

    /**
     * 保存同一语言下的根节点、树资源和选项资源文案。
     *
     * @param rootLabel 根节点文案，例如 {@code "引用数据资源类型"}
     * @param treeLabel 树资源文案，例如 {@code "树形资源"}
     * @param optionsLabel 选项资源文案，例如 {@code "类型选项资源"}
     */
    private record ResourceKindLabels(String rootLabel, String treeLabel, String optionsLabel) {
    }
}
