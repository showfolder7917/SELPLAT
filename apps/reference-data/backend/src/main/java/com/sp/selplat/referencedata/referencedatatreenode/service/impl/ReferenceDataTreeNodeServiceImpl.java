package com.sp.selplat.referencedata.referencedatatreenode.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.common.util.ReferenceDataQueryUtil;
import com.sp.selplat.referencedata.referencedatatreenode.dao.ReferenceDataTreeNodeDao;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 从 ReferenceDataTreeNode 表读取平铺记录并组装公共 Map 树。 */
@Service
public class ReferenceDataTreeNodeServiceImpl
        extends BaseServiceImpl<ReferenceDataTreeNodeDao>
        implements ReferenceDataTreeNodeService {

    /** {@inheritDoc} */
    @Override
    public CommonResult getTree(String projectCode, String resourceCode, Map<String, String> parameters) {
        List<Map<String, Object>> rows = getDao().findEnabledNodes(projectCode, resourceCode);
        if (rows.isEmpty()) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TREE_NOT_FOUND",
                    "未找到引用数据树：" + projectCode + "/" + resourceCode);
        }
        String locale = ReferenceDataQueryUtil.locale(parameters);
        Map<String, List<Map<String, Object>>> rowsByParent = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String parentCode = row.get("parentCode") == null ? "" : String.valueOf(row.get("parentCode"));
            rowsByParent.computeIfAbsent(parentCode, ignored -> new ArrayList<>()).add(row);
        }
        List<Map<String, Object>> roots = buildChildren("", rowsByParent, locale);
        String path = "/api/reference-data/" + projectCode.trim() + "/" + resourceCode.trim() + "/tree";
        return ReferenceDataQueryUtil.success(roots, path, "引用数据树查询完成。");
    }

    /**
     * 递归把同一父节点下的数据库记录组装为公共 Map 树节点。
     *
     * @param parentCode 当前父节点编码，例如 {@code "resource-kind-root"}；根层为空字符串
     * @param rowsByParent 按父编码分组的真实数据库记录
     * @param locale 已规范化语言，例如 {@code "zh-CN"}
     * @return 节点列表，例如 {@code [{"id":"resource-kind-tree","children":[]}]}
     * 异常或副作用示例：缺少可选子节点时返回空列表，不修改 DAO 原始记录。
     */
    private List<Map<String, Object>> buildChildren(
            String parentCode,
            Map<String, List<Map<String, Object>>> rowsByParent,
            String locale) {
        List<Map<String, Object>> nodes = new ArrayList<>();
        for (Map<String, Object> row : rowsByParent.getOrDefault(parentCode, List.of())) {
            String nodeCode = String.valueOf(row.get("nodeCode"));
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("id", nodeCode);
            node.put("parentId", parentCode.isEmpty() ? null : parentCode);
            node.put("label", ReferenceDataQueryUtil.label(row, locale));
            node.put("value", String.valueOf(row.get("nodeValue")));
            node.put("children", buildChildren(nodeCode, rowsByParent, locale));
            node.put("attributes", ReferenceDataQueryUtil.attributes(row.get("attributesJson")));
            nodes.add(Collections.unmodifiableMap(node));
        }
        return List.copyOf(nodes);
    }
}
