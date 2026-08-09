package com.sp.selplat.japanese.n2bluebookquestion.reference;

import com.sp.selplat.referencedata.backend.provider.ReferenceDataProvider;
import com.sp.selplat.referencedata.contract.model.ReferenceDataQuery;
import com.sp.selplat.referencedata.contract.model.TreeNode;
import com.sp.selplat.referencedata.contract.model.TypeOption;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 向 reference-data 注册 japanese/n2-blue-book-question。
 * 未来树和类型直接在本 Provider 中替换为真实业务查询。
 */
@Component
public class JapaneseN2BlueBookQuestionReferenceDataProvider
        implements ReferenceDataProvider {

    /** @return 工程稳定编码，例如 {@code "japanese"}。 */
    @Override
    public String getProjectCode() {
        return "japanese";
    }

    /** @return 资源稳定编码，例如 {@code "n2-blue-book-question"}。 */
    @Override
    public String getResourceCode() {
        return "n2-blue-book-question";
    }

    /**
     * 返回页面左侧树的初始根节点。
     *
     * @param query 租户和过滤条件，例如 {@code {tenantId:"1"}}
     * @return 初始根节点；未来替换为真实业务树
     */
    @Override
    public List<TreeNode> loadTree(ReferenceDataQuery query) {
        String rootId = "n2-blue-book-question-root";
        return List.of(new TreeNode(
                rootId, null, "N2 蓝宝书1000题", "ALL",
                List.of(
                        new TreeNode("n2-pronunciation", rootId, "语音・读音题",
                                "PRONUNCIATION", List.of(), Map.of("questionType", "PRONUNCIATION")),
                        new TreeNode("n2-kanji", rootId, "汉字题",
                                "KANJI", List.of(), Map.of("questionType", "KANJI")),
                        new TreeNode("n2-grammar", rootId, "语法题",
                                "GRAMMAR", List.of(), Map.of("questionType", "GRAMMAR"))),
                Map.of("jlptLevel", "N2", "sourceBook", "蓝宝书1000题")));
    }

    /**
     * 返回默认状态类型。
     *
     * @param query 租户和过滤条件，例如 {@code {tenantId:"1"}}
     * @return 有效和停用两个默认选项
     */
    @Override
    public List<TypeOption> loadOptions(
            ReferenceDataQuery query) {
        return List.of(
                new TypeOption(
                        "PRONUNCIATION", "语音・读音题", "question-type",
                        10, false, Map.of()),
                new TypeOption(
                        "KANJI", "汉字题", "question-type",
                        20, false, Map.of()),
                new TypeOption(
                        "GRAMMAR", "语法题", "question-type",
                        30, false, Map.of()),
                new TypeOption(
                        "1", "有效", "status",
                        40, false, Map.of()),
                new TypeOption(
                        "0", "停用", "status",
                        50, false, Map.of()));
    }
}
