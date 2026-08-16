package com.sp.selplat.referencedata.referencedatatreenode.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.common.util.ReferenceDataQueryUtil;
import com.sp.selplat.referencedata.common.util.code.ReferenceDataCodeServiceImpl;
import com.sp.selplat.referencedata.referencedatatreenode.dao.ReferenceDataTreeNodeDao;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/** 从独立的 ReferenceDataTreeNode 表读取记录，保留页面归属并按 code 与 parentId 组装树。 */
@Service
public class ReferenceDataTreeNodeServiceImpl
        extends ReferenceDataCodeServiceImpl<ReferenceDataTreeNodeDao>
        implements ReferenceDataTreeNodeService {

    /**
     * 返回树节点统一可读前缀。
     * 真实传参示例：新增参数为 {@code {"nodeValue":"READING"}}。
     * 真实返回示例：返回 {@code treeNode}，最终 code 形如 {@code treeNode103013}。
     * 异常或副作用示例：方法不访问类型表，也不修改新增参数。
     *
     * @param saveIn 已取得全局主键的节点新增参数
     * @return 树节点对象前缀
     */
    @Override
    protected String resolveCodePrefix(CommonParam saveIn) {
        return "treeNode";
    }

    /**
     * 校验并保留树节点的工程和页面归属；两者不参与父子树计算。
     * 真实传参示例：新增参数为 {@code {"projectCode":"reference-data","pageCode":"page101017"}}。
     * 真实返回示例：返回 {@code reference-data}，同时把规范化 pageCode 保留给 DAO。
     * 异常或副作用示例：页面 Code 为空时抛出业务异常，不写入缺少归属的树节点。
     *
     * @param saveIn 尚未进入 DAO 的新增参数
     * @return 规范化后的树节点所属项目编码
     */
    @Override
    protected String resolveProjectCode(CommonParam saveIn) {
        Object pageCodeValue = saveIn.getParam("pageCode");
        String pageCode = pageCodeValue == null ? "" : String.valueOf(pageCodeValue).trim();
        if (pageCode.isEmpty()) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TREE_PAGE_CODE_REQUIRED",
                    "树节点所属页面 Code 不能为空。");
        }
        saveIn.putParam("pageCode", pageCode);
        Object projectCodeValue = saveIn.getParam("projectCode");
        String projectCode = projectCodeValue == null ? "" : String.valueOf(projectCodeValue).trim();
        saveIn.putParam("projectCode", projectCode);
        return projectCode;
    }

    /** {@inheritDoc} */
    @Override
    public CommonPageResult getStore(CommonPageParam queryIn) {
        CommonPageParam requiredQuery = queryIn == null ? new CommonPageParam() : queryIn;
        // codeLike、parentId 和 status 都由 BaseDao 转成独立 AND 条件，不再保留关键词 OR 查询。
        return super.getStore(requiredQuery);
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getNodes(String rootCode, Map<String, String> parameters) {
        List<Map<String, Object>> rows = getDao().findEnabledNodes();
        Map<String, Object> root = rows.stream()
                .filter(row -> rootCode != null && rootCode.trim().equals(String.valueOf(row.get("code"))))
                .findFirst()
                .orElseThrow(() -> new CommonBusinessException(
                        "REFERENCE_DATA_TREE_ROOT_NOT_FOUND",
                        "未找到启用的树根节点：" + String.valueOf(rootCode)));
        String locale = ReferenceDataQueryUtil.locale(parameters);
        Map<Long, List<Map<String, Object>>> rowsByParent = groupRowsByParent(rows);
        Map<String, Object> tree = buildNode(root, rowsByParent, locale, new HashSet<>());
        String path = "/api/reference-data/trees/" + rootCode.trim();
        return ReferenceDataQueryUtil.success(tree, path, "引用数据树查询完成。");
    }

    /**
     * 按 parentId 归并平铺树记录。
     * 真实传参示例：{@code [{id:2,parentId:1}]}。
     * 真实返回示例：{@code {1:[{id:2,parentId:1}]}。
     * 异常或副作用示例：根节点不会作为其他空父节点的子项；方法不修改输入记录。
     *
     * @param rows DAO 已按排序值返回的节点
     * @return 保持数据库顺序的父节点分组
     */
    private Map<Long, List<Map<String, Object>>> groupRowsByParent(List<Map<String, Object>> rows) {
        Map<Long, List<Map<String, Object>>> rowsByParent = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            if (row.get("parentId") != null) {
                long parentId = ((Number) row.get("parentId")).longValue();
                rowsByParent.computeIfAbsent(parentId, ignored -> new ArrayList<>()).add(row);
            }
        }
        return rowsByParent;
    }

    /**
     * 把一个数据库节点及其 parentId 子孙递归组装为公共树节点。
     * 真实传参示例：根记录为 {@code {id:1,code:"treeNode101007"}}。
     * 真实返回示例：{@code {id:"treeNode101007",value:"ROOT",children:[]}}。
     * 异常或副作用示例：检测到循环父子关系时抛出业务异常，避免无限递归。
     *
     * @param row 当前数据库节点
     * @param rowsByParent 按父主键分组的启用节点
     * @param locale 已规范化语言
     * @param ancestry 当前递归链中的节点主键
     * @return 不可变语义的树节点数据
     */
    private Map<String, Object> buildNode(
            Map<String, Object> row,
            Map<Long, List<Map<String, Object>>> rowsByParent,
            String locale,
            Set<Long> ancestry) {
        long id = ((Number) row.get("id")).longValue();
        if (!ancestry.add(id)) {
            throw new CommonBusinessException("REFERENCE_DATA_TREE_CYCLE", "树节点存在循环父子关系。");
        }
        List<Map<String, Object>> children = new ArrayList<>();
        for (Map<String, Object> child : rowsByParent.getOrDefault(id, List.of())) {
            children.add(buildNode(child, rowsByParent, locale, new HashSet<>(ancestry)));
        }
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", String.valueOf(row.get("code")));
        node.put("parentId", row.get("parentId"));
        node.put("label", ReferenceDataQueryUtil.label(row, locale));
        node.put("value", String.valueOf(row.get("nodeValue")));
        node.put("children", List.copyOf(children));
        return Collections.unmodifiableMap(node);
    }
}
