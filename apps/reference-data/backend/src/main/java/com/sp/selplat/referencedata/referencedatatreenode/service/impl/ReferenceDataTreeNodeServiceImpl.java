package com.sp.selplat.referencedata.referencedatatreenode.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.referencedata.common.util.code.ReferenceDataCodeServiceImpl;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.common.util.ReferenceDataQueryUtil;
import com.sp.selplat.referencedata.referencedatatreenode.dao.ReferenceDataTreeNodeDao;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/** 从 ReferenceDataTreeNode 表读取平铺记录并组装公共 Map 树。 */
@Service
public class ReferenceDataTreeNodeServiceImpl
        extends ReferenceDataCodeServiceImpl<ReferenceDataTreeNodeDao>
        implements ReferenceDataTreeNodeService {

    // 统一节点表的五种明确类型直接登记可读前缀，新增类型必须同时扩展数据库约束和此映射。
    private static final Map<String, String> NODE_CODE_PREFIXES = Map.of(
            "DROPDOWN", "dropdownOption",
            "TREE", "treeNode",
            "GRID_MENU", "gridMenuItem",
            "PANEL_MENU", "panelMenuItem",
            "CONTEXT_MENU", "contextMenuItem");

    /**
     * 根据所属数据类型为统一节点表选择可读前缀，数据库关联仍只依赖 typeId。
     * 真实传参示例：typeId 指向 {@code DROPDOWN} 时，参数为 {@code {"typeId":101001}}。
     * 真实返回示例：下拉选项返回 {@code dropdownOption}，右键菜单项返回 {@code contextMenuItem}。
     * 异常或副作用示例：typeId 缺失、类型不存在或出现未登记 type 时抛出业务异常，节点不会入库。
     *
     * @param saveIn 已取得全局主键、包含 typeId 的节点新增参数
     * @return 当前类型对应的节点对象前缀
     */
    @Override
    protected String resolveCodePrefix(CommonParam saveIn) {
        Map<String, Object> type = requiredType(saveIn);
        String resourceType = String.valueOf(type.get("type"));
        // 数据库 type 检查约束保证一定命中；公共编码链仍会阻止任何异常空前缀。
        return NODE_CODE_PREFIXES.get(resourceType);
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getNodes(String typeCode, Map<String, String> parameters) {
        List<Map<String, Object>> rows = getDao().findEnabledNodes(typeCode);
        if (rows.isEmpty()) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_NODES_NOT_FOUND",
                    "未找到引用数据节点：" + typeCode);
        }
        String locale = ReferenceDataQueryUtil.locale(parameters);
        String resourceType = String.valueOf(rows.get(0).get("resourceType"));
        Object nodes;
        if ("DROPDOWN".equals(resourceType)) {
            nodes = buildOptions(rows, locale);
        } else if ("TREE".equals(resourceType)) {
            nodes = buildChildren("", groupRowsByParent(rows), locale);
        } else {
            nodes = buildMenuChildren("", groupRowsByParent(rows), locale);
        }
        String path = "/api/reference-data/types/" + typeCode.trim() + "/nodes";
        return ReferenceDataQueryUtil.success(nodes, path, "引用数据节点查询完成。");
    }

    /**
     * 根据节点的内部 typeId 解析项目编码，并移除前端无权保存的临时 projectCode。
     * 真实传参示例：新增参数为 {@code {"typeId":101001,"nodeValue":"ENABLED"}}。
     * 真实返回示例：类型记录属于 reference-data 时返回 {@code reference-data}，最终生成
     *     {@code dropdownOption101020}。
     * 异常或副作用示例：typeId 缺失或不存在时抛出业务异常，节点不会写入数据库。
     *
     * @param saveIn 已取得节点主键、尚未进入 DAO 的新增参数
     * @return 节点所属类型的项目编码
     */
    @Override
    protected String resolveProjectCode(CommonParam saveIn) {
        Map<String, Object> type = requiredType(saveIn);
        saveIn.getParamMap().remove("projectCode");
        return String.valueOf(type.get("projectCode"));
    }

    /**
     * 使用真实类型表解析节点所属项目和节点类别，避免前端提交冗余 projectCode 或 type。
     * 真实传参示例：{@code {"typeId":101001,"nodeCode":"ENABLED"}}。
     * 真实返回示例：返回 {@code {"id":101001,"projectCode":"reference-data","type":"DROPDOWN"}}。
     * 异常或副作用示例：typeId 非数字或未命中启用类型时抛出业务异常，不修改数据库。
     *
     * @param saveIn 节点新增参数
     * @return 所属启用类型完整坐标
     */
    private Map<String, Object> requiredType(CommonParam saveIn) {
        long typeId;
        try {
            typeId = Long.parseLong(String.valueOf(saveIn.getParam("typeId")));
        } catch (NumberFormatException exception) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_NODE_TYPE_INVALID",
                    "节点所属类型必须是有效主键。",
                    exception);
        }
        Map<String, Object> type = getDao().findTypeById(typeId);
        if (type == null) {
            throw new CommonBusinessException("REFERENCE_DATA_NODE_TYPE_NOT_FOUND", "节点所属类型不存在。");
        }
        return type;
    }

    /**
     * 把类型化节点转换为 SEL 下拉框使用的稳定选项结构。
     * 真实传参示例：{@code [{nodeValue:"TREE",labelZh:"树",sortnum:10}]} 与 {@code zh-CN}。
     * 真实返回示例：{@code [{value:"TREE",label:"树",sortOrder:10,disabled:false}]}。
     * 异常或副作用示例：扩展 JSON 非法时由公共解析器抛出统一异常；方法不写数据库。
     *
     * @param rows 已按顺序读取的下拉节点
     * @param locale 已规范化语言
     * @return 不可变下拉选项列表
     */
    private List<Map<String, Object>> buildOptions(List<Map<String, Object>> rows, String locale) {
        List<Map<String, Object>> options = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> attributes = ReferenceDataQueryUtil.attributes(row.get("attributesJson"));
            Map<String, Object> option = new LinkedHashMap<>();
            option.put("value", String.valueOf(row.get("nodeValue")));
            option.put("label", ReferenceDataQueryUtil.label(row, locale));
            option.put("groupCode", attributes.get("groupCode"));
            option.put("sortOrder", new BigDecimal(String.valueOf(row.get("sortnum"))).intValue());
            option.put("disabled", Boolean.TRUE.equals(row.get("disabled")));
            option.put("attributes", attributes);
            options.add(Collections.unmodifiableMap(option));
        }
        return List.copyOf(options);
    }

    /**
     * 按父节点编码归并平铺记录，供树和菜单共享同一层级关系。
     * 真实传参示例：{@code [{nodeCode:"refresh",parentCode:null}]}。
     * 真实返回示例：{@code {"":[{nodeCode:"refresh"}]}}。
     * 异常或副作用示例：父编码为空时归入根节点；方法不修改输入记录。
     *
     * @param rows DAO 已按排序值返回的节点
     * @return 保持数据库顺序的父节点分组
     */
    private Map<String, List<Map<String, Object>>> groupRowsByParent(List<Map<String, Object>> rows) {
        Map<String, List<Map<String, Object>>> rowsByParent = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String parentCode = row.get("parentCode") == null ? "" : String.valueOf(row.get("parentCode"));
            rowsByParent.computeIfAbsent(parentCode, ignored -> new ArrayList<>()).add(row);
        }
        return rowsByParent;
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

    /**
     * 递归把树节点记录转换为 SEL 右键菜单使用的多级结构。
     * 真实传参示例：根层空编码、按父节点分组的 refresh 节点和 {@code zh-CN}。
     * 真实返回示例：{@code [{code:"refresh",command:"reload",children:[]}]}。
     * 异常或副作用示例：attributesJson 未提供 icon、command 时返回 null；方法不写数据库。
     *
     * @param parentCode 当前父菜单编码，根层为空字符串
     * @param rowsByParent 按父编码分组的数据库节点
     * @param locale 已规范化语言
     * @return 当前层级的不可变菜单项列表
     */
    private List<Map<String, Object>> buildMenuChildren(
            String parentCode,
            Map<String, List<Map<String, Object>>> rowsByParent,
            String locale) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> row : rowsByParent.getOrDefault(parentCode, List.of())) {
            String itemCode = String.valueOf(row.get("nodeCode"));
            Map<String, Object> attributes = ReferenceDataQueryUtil.attributes(row.get("attributesJson"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("code", itemCode);
            item.put("label", ReferenceDataQueryUtil.label(row, locale));
            item.put("icon", row.get("icon"));
            item.put("command", row.get("commandCode"));
            item.put("disabled", Boolean.TRUE.equals(row.get("disabled")));
            item.put("children", buildMenuChildren(itemCode, rowsByParent, locale));
            item.put("attributes", attributes);
            items.add(Collections.unmodifiableMap(item));
        }
        return List.copyOf(items);
    }
}
