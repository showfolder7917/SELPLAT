package com.sp.selplat.referencedata.common.config;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.referencedatacontrollayout.service.ReferenceDataControlLayoutService;
import com.sp.selplat.referencedata.referencedatatable.service.ReferenceDataTableService;
import com.sp.selplat.referencedata.referencedatatableelement.service.ReferenceDataTableElementService;
import com.sp.selplat.referencedata.referencedatatreenode.service.ReferenceDataTreeNodeService;
import com.sp.selplat.referencedata.referencedatawindow.service.ReferenceDataWindowService;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 从各应用 Jar 的声明文件幂等登记页面、查询控件、Grid 列、树和 Window 默认配置。
 * 初始化器只创建缺失记录并保留管理员已经保存的布局；业务应用没有 Reference Data 模块时仍使用前端默认值。
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 100)
public class ReferenceDataApplicationDefaultsInitializer implements ApplicationRunner {

    // 所有应用统一把声明放在 META-INF 固定目录，Host 可以从多个模块 Jar 一次发现。
    private static final String RESOURCE_PATTERN =
            "classpath*:META-INF/selplat-reference-data-defaults/*.json";
    // 初始化分页只在本地六表 Service 中使用，超过一千条时继续读取后续页。
    private static final int PAGE_SIZE = 1000;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final PathMatchingResourcePatternResolver resources =
            new PathMatchingResourcePatternResolver();
    private final ReferenceDataControlLayoutService controlService;
    private final ReferenceDataTableService tableService;
    private final ReferenceDataTableElementService elementService;
    private final ReferenceDataTreeNodeService treeNodeService;
    private final ReferenceDataWindowService windowService;

    /**
     * 装配应用默认配置登记所需的五张业务表 Service。
     * 真实传参示例：Spring 注入 ControlLayout、Table、TableElement、TreeNode 和 Window Service。
     * 真实返回示例：构造后的初始化器可把 Japanese 声明写入同一个 reference-data 私有库。
     * 异常或副作用示例：任一 Service 缺失时 Host 启动失败，不允许用直连 SQL 绕过业务发号链。
     *
     * @param controlService 页面与查询控件业务 Service
     * @param tableService Grid 定义业务 Service
     * @param elementService Grid 元素业务 Service
     * @param treeNodeService 树节点业务 Service
     * @param windowService Window 默认几何业务 Service
     */
    public ReferenceDataApplicationDefaultsInitializer(
            ReferenceDataControlLayoutService controlService,
            ReferenceDataTableService tableService,
            ReferenceDataTableElementService elementService,
            ReferenceDataTreeNodeService treeNodeService,
            ReferenceDataWindowService windowService) {
        this.controlService = controlService;
        this.tableService = tableService;
        this.elementService = elementService;
        this.treeNodeService = treeNodeService;
        this.windowService = windowService;
    }

    /**
     * 按资源 URL 稳定顺序导入所有应用声明，重复启动只补缺失项。
     * 真实传参示例：classpath 同时包含 {@code japanese/n2-blue-book-question.json} 和生成应用声明。
     * 真实返回示例：每个页面形成一个 PAGE、一张 Grid、独立控件、列、树和 Window 记录。
     * 异常或副作用示例：JSON 无效或同一语义坐标重复时事务回滚并阻止 Host 带病启动。
     *
     * @param arguments Spring Boot 启动参数；本初始化器不读取业务参数
     * @throws IOException 声明资源无法枚举或读取时抛出并阻止启动
     */
    @Override
    @Transactional(transactionManager = "referenceDataTransactionManager")
    public void run(ApplicationArguments arguments) throws IOException {
        Resource[] discovered = resources.getResources(RESOURCE_PATTERN);
        List<Resource> ordered = new ArrayList<>(List.of(discovered));
        ordered.sort(Comparator.comparing(resource -> {
            try {
                return resource.getURL().toExternalForm();
            } catch (IOException exception) {
                return resource.getDescription();
            }
        }));
        for (Resource resource : ordered) {
            Map<String, Object> manifest = objectMapper.readValue(
                    resource.getInputStream(),
                    new TypeReference<Map<String, Object>>() { });
            importManifest(manifest);
        }
    }

    /**
     * 把一份页面声明转换为五张表中的真实记录，并用本轮生成 code 解析父子关系。
     * 真实传参示例：{@code {projectCode:"japanese",pageKey:"n2-blue-book-question",table:{...}}}。
     * 真实返回示例：缺失记录新增后，既有管理员宽度、位置和状态保持不变。
     * 异常或副作用示例：必要字段缺失时抛出 IllegalStateException；当前声明事务整体回滚。
     *
     * @param manifest 应用模块随 Jar 发布的页面默认配置
     */
    private void importManifest(Map<String, Object> manifest) {
        String projectCode = requiredText(manifest, "projectCode");
        String pageKey = requiredText(manifest, "pageKey");
        Map<String, Object> page = ensurePage(projectCode, pageKey, object(manifest.get("page")));
        String pageCode = text(page.get("pageCode"));
        Map<String, Object> tableDefinition = object(manifest.get("table"));
        Map<String, Object> table = tableDefinition.isEmpty()
                ? Map.of() : ensureTable(projectCode, pageCode, tableDefinition);
        if (!table.isEmpty()) {
            ensureElements(projectCode, table, list(tableDefinition.get("columns")));
        }
        ensureControls(projectCode, pageCode, list(manifest.get("controls")));
        disableDeprecatedControls(pageCode, manifest.get("deprecatedControlFields"));
        ensureWindows(projectCode, pageCode, list(manifest.get("windows")));
        ensureTreeNodes(
                projectCode,
                pageCode,
                text(manifest.get("legacyProjectCode")),
                list(manifest.get("treeNodes")));
    }

    /**
     * 查询或创建一个带稳定 pageKey 的 PAGE 根记录。
     * 真实传参示例：{@code japanese/n2-blue-book-question}。
     * 真实返回示例：首次返回 {@code {code:"page107001",pageCode:"page107001"}}，以后返回同一记录。
     * 异常或副作用示例：同一坐标重复时抛出异常；首次调用会消费 ControlLayout 自己的主键号段。
     *
     * @param projectCode 工程编码
     * @param pageKey 稳定页面键
     * @param defaults PAGE 的可选默认布局
     * @return 已存在或新建的 PAGE 记录
     */
    private Map<String, Object> ensurePage(
            String projectCode,
            String pageKey,
            Map<String, Object> defaults) {
        Map<String, Object> existing = single(controlService, Map.of(
                "projectCode", projectCode,
                "controlKind", "PAGE",
                "fieldName", pageKey,
                "statusIn", List.of(1, 2)));
        if (!existing.isEmpty()) {
            return existing;
        }
        Map<String, Object> values = new LinkedHashMap<>(defaults);
        values.put("projectCode", projectCode);
        values.put("pageCode", "bootstrap");
        values.put("controlKind", "PAGE");
        values.put("fieldName", pageKey);
        values.putIfAbsent("sourceTableName", "ReferenceDataControlLayout");
        values.putIfAbsent("layoutMode", "FLOW");
        values.putIfAbsent("orderNo", 0);
        values.putIfAbsent("breakpoint", "DESKTOP");
        values.putIfAbsent("editable", true);
        values.putIfAbsent("status", 1);
        values.putIfAbsent("sortnum", 0);
        return insert(controlService, values);
    }

    /**
     * 查询或创建页面唯一 Grid，并明确其真实业务表名。
     * 真实传参示例：Japanese 页面声明 sourceTableName 为 {@code JapaneseN2BlueBookQuestion}。
     * 真实返回示例：返回 {@code {id:107002,code:"table107002",gridId:"selGridJapaneseN2BlueBookQuestionId"}}。
     * 异常或副作用示例：页面已有 Grid 时保留管理员配置；首次调用消费 Table 自己的主键号段。
     *
     * @param projectCode 工程编码
     * @param pageCode PAGE 数据库 code
     * @param defaults Grid 默认字段
     * @return 已存在或新建的 Grid 记录
     */
    private Map<String, Object> ensureTable(
            String projectCode,
            String pageCode,
            Map<String, Object> defaults) {
        Map<String, Object> existing = single(tableService, Map.of(
                "pageCode", pageCode,
                "gridId", requiredText(defaults, "gridId"),
                "statusIn", List.of(1, 2)));
        if (!existing.isEmpty()) {
            return existing;
        }
        Map<String, Object> values = without(defaults, "columns");
        values.put("projectCode", projectCode);
        values.put("pageCode", pageCode);
        values.putIfAbsent("sourceTableName", requiredText(defaults, "sourceTableName"));
        values.putIfAbsent("nameZh", requiredText(defaults, "nameZh"));
        values.putIfAbsent("selectionMode", "NONE");
        values.putIfAbsent("pageSize", 20);
        values.putIfAbsent("rowHeight", 48);
        values.putIfAbsent("status", 1);
        values.putIfAbsent("sortnum", 10);
        return insert(tableService, values);
    }

    /**
     * 为 Grid 补齐缺失列；已有列宽和可见性不会被默认声明覆盖。
     * 真实传参示例：题号列 fieldName 为 {@code sourceQuestionNo}、viewCode 为 {@code DEFAULT}。
     * 真实返回示例：缺失列形成 {@code tableElement107003}，再次启动不新增第二条。
     * 异常或副作用示例：列缺少 fieldName 时阻止启动；已创建列保留数据库现值。
     *
     * @param projectCode 工程编码
     * @param table Grid 父记录
     * @param columns 默认列声明
     */
    private void ensureElements(
            String projectCode,
            Map<String, Object> table,
            List<Map<String, Object>> columns) {
        for (Map<String, Object> column : columns) {
            String fieldName = requiredText(column, "fieldName");
            Map<String, Object> existing = single(elementService, Map.of(
                    "tableId", table.get("id"),
                    "viewCode", "DEFAULT",
                    "fieldName", fieldName,
                    "statusIn", List.of(1, 2)));
            if (!existing.isEmpty()) {
                continue;
            }
            Map<String, Object> values = new LinkedHashMap<>(column);
            values.put("projectCode", projectCode);
            values.put("tableId", table.get("id"));
            values.put("viewCode", "DEFAULT");
            values.putIfAbsent("elementType", "COLUMN");
            values.putIfAbsent("width", "auto");
            values.putIfAbsent("cellRenderer", "text");
            values.putIfAbsent("visible", true);
            values.putIfAbsent("resizable", true);
            values.putIfAbsent("status", 1);
            insert(elementService, values);
        }
    }

    /**
     * 按声明 key 先父后子补齐页面查询控件，每个可拖拽元素保持独立记录。
     * 真实传参示例：toolbar 下声明 keyword、submit 和 reset 三个子控件。
     * 真实返回示例：三个子控件分别获得独立 {@code control<id>} 并共享 toolbar parentCode。
     * 异常或副作用示例：parentKey 未先声明时阻止启动；只有与 legacyGeometry 完全相同的旧默认值会升级，管理员布局不会被覆盖。
     *
     * @param projectCode 工程编码
     * @param pageCode PAGE 数据库 code
     * @param controls 按父节点优先排列的控件声明
     */
    private void ensureControls(
            String projectCode,
            String pageCode,
            List<Map<String, Object>> controls) {
        Map<String, String> codeByKey = new LinkedHashMap<>();
        for (Map<String, Object> control : controls) {
            String key = requiredText(control, "key");
            String parentKey = text(control.get("parentKey"));
            String parentKind = parentKey.isEmpty() ? "PAGE" : "TOOLBAR";
            String parentCode = parentKey.isEmpty() ? pageCode : codeByKey.get(parentKey);
            if (parentCode == null) {
                throw new IllegalStateException("页面控件 parentKey 必须先声明：" + parentKey);
            }
            String fieldName = requiredText(control, "fieldName");
            Map<String, Object> existing = single(controlService, Map.of(
                    "pageCode", pageCode,
                    "parentKind", parentKind,
                    "parentCode", parentCode,
                    "fieldName", fieldName,
                    "statusIn", List.of(1, 2)));
            Map<String, Object> record = existing;
            if (record.isEmpty()) {
                Map<String, Object> values = without(control, "key", "parentKey", "legacyGeometry");
                values.put("projectCode", projectCode);
                values.put("pageCode", pageCode);
                values.put("parentKind", parentKind);
                values.put("parentCode", parentCode);
                values.putIfAbsent("sourceTableName", "ReferenceDataControlLayout");
                values.putIfAbsent("layoutMode", "ABSOLUTE");
                values.putIfAbsent("breakpoint", "DESKTOP");
                values.putIfAbsent("editable", true);
                values.putIfAbsent("status", 1);
                record = insert(controlService, values);
            } else {
                record = repairLegacyControlGeometry(record, control);
            }
            codeByKey.put(key, text(record.get("code")));
        }
    }

    /**
     * 仅把与声明中旧默认矩形完全一致的控件升级到当前默认矩形。
     * 真实传参示例：数据库题号查询仍为 {@code x=0,width=220px}，声明 legacyGeometry 也为同一矩形。
     * 真实返回示例：通过 ControlLayout Service 更新为 {@code x=17} 并返回合并后的当前记录。
     * 异常或副作用示例：管理员已经移动或调宽任一字段时保持原值；公共更新失败时事务整体回滚。
     *
     * @param existing 当前数据库控件记录
     * @param declaration 当前应用声明
     * @return 原记录或完成旧默认升级后的记录
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> repairLegacyControlGeometry(
            Map<String, Object> existing,
            Map<String, Object> declaration) {
        Map<String, Object> legacyGeometry = object(declaration.get("legacyGeometry"));
        if (legacyGeometry.isEmpty() || !legacyGeometry.entrySet().stream()
                .allMatch(entry -> text(existing.get(entry.getKey())).equals(text(entry.getValue())))) {
            return existing;
        }
        Map<String, Object> update = new LinkedHashMap<>();
        update.put("id", existing.get("id"));
        for (String field : List.of("x", "y", "width", "height")) {
            if (declaration.containsKey(field)) {
                update.put(field, declaration.get(field));
            }
        }
        CommonResult result = controlService.update(param(update));
        Map<String, Object> repaired = new LinkedHashMap<>(existing);
        repaired.putAll((Map<String, Object>) result.getData());
        return repaired;
    }

    /**
     * 按应用声明停用已经退出页面结构的旧控件，避免永久库继续返回幽灵编辑项。
     * 真实传参示例：N2 页面声明 {@code deprecatedControlFields=["keyword"]}。
     * 真实返回示例：当前页面所有启用的 keyword 记录通过 ControlLayout Service 变为 {@code status=0}。
     * 异常或副作用示例：未声明、其他页面或已经停用的记录不受影响；删除失败时事务整体回滚。
     *
     * @param pageCode 当前 PAGE 数据库 code
     * @param declaredFields 声明中的废弃字段名数组
     */
    private void disableDeprecatedControls(
            String pageCode,
            Object declaredFields) {
        if (!(declaredFields instanceof List<?> fields)) {
            return;
        }
        for (Object declaredField : fields) {
            String fieldName = text(declaredField);
            if (fieldName.isEmpty()) {
                continue;
            }
            List<Map<String, Object>> deprecated = records(controlService, filters(
                    "pageCode", pageCode,
                    "fieldName", fieldName,
                    "statusIn", List.of(1, 2)));
            for (Map<String, Object> record : deprecated) {
                controlService.delete(param(Map.of("id", record.get("id"))));
            }
        }
    }

    /**
     * 为页面补齐 Window 外框默认几何，Window 内字段不进入 ControlLayout。
     * 真实传参示例：triggerControlCode 为 {@code selWindowJapaneseN2BlueBookQuestionId}。
     * 真实返回示例：首次生成一条 Window 记录，拖拽保存后重启继续保留保存值。
     * 异常或副作用示例：已有 triggerControlCode 时保持原几何；声明缺失名称或尺寸时数据库校验阻止启动。
     *
     * @param projectCode 工程编码
     * @param pageCode PAGE 数据库 code
     * @param windows Window 默认声明
     */
    private void ensureWindows(
            String projectCode,
            String pageCode,
            List<Map<String, Object>> windows) {
        for (Map<String, Object> window : windows) {
            String triggerControlCode = requiredText(window, "triggerControlCode");
            if (!single(windowService, Map.of(
                    "pageCode", pageCode,
                    "triggerControlCode", triggerControlCode,
                    "statusIn", List.of(1, 2))).isEmpty()) {
                continue;
            }
            Map<String, Object> values = new LinkedHashMap<>(window);
            values.put("projectCode", projectCode);
            values.put("pageCode", pageCode);
            values.putIfAbsent("positionMode", "CENTER");
            values.putIfAbsent("resizable", true);
            values.putIfAbsent("draggable", true);
            values.putIfAbsent("maximizable", true);
            values.putIfAbsent("minimizable", true);
            values.putIfAbsent("breakpoint", "DESKTOP");
            values.putIfAbsent("status", 1);
            insert(windowService, values);
        }
    }

    /**
     * 补齐树节点并可接管旧项目下同值的历史节点，树关系始终只使用 parentId。
     * 真实传参示例：旧 N2 节点属于 reference-data，新声明属于 japanese 页面。
     * 真实返回示例：原 treeNode code 和 id 保留，只更新 projectCode、pageCode、parentId 与最终多语言名称。
     * 异常或副作用示例：同一 nodeValue 命中多条时阻止接管；新节点消费 TreeNode 自己的主键号段。
     *
     * @param projectCode 新工程编码
     * @param pageCode 新 PAGE code
     * @param legacyProjectCode 可选历史工程编码
     * @param nodes 按父节点优先排列的树声明
     */
    private void ensureTreeNodes(
            String projectCode,
            String pageCode,
            String legacyProjectCode,
            List<Map<String, Object>> nodes) {
        Map<String, Map<String, Object>> recordByKey = new LinkedHashMap<>();
        for (Map<String, Object> node : nodes) {
            String key = requiredText(node, "key");
            String parentKey = text(node.get("parentKey"));
            Object parentId = parentKey.isEmpty() ? null : recordByKey.get(parentKey).get("id");
            String nodeValue = requiredText(node, "nodeValue");
            Map<String, Object> record = single(treeNodeService, filters(
                    "projectCode", projectCode,
                    "pageCode", pageCode,
                    "nodeValue", nodeValue,
                    "statusIn", List.of(1, 2)));
            if (record.isEmpty() && !legacyProjectCode.isEmpty()) {
                record = single(treeNodeService, filters(
                        "projectCode", legacyProjectCode,
                        "nodeValue", text(node.getOrDefault("legacyNodeValue", nodeValue)),
                        "statusIn", List.of(1, 2)));
                if (!record.isEmpty()) {
                    Map<String, Object> update = without(node, "key", "parentKey", "legacyNodeValue");
                    update.put("id", record.get("id"));
                    update.put("projectCode", projectCode);
                    update.put("pageCode", pageCode);
                    update.put("parentId", parentId);
                    treeNodeService.update(param(update));
                    record = new LinkedHashMap<>(record);
                    record.putAll(update);
                }
            }
            if (record.isEmpty()) {
                Map<String, Object> values = without(node, "key", "parentKey", "legacyNodeValue");
                values.put("projectCode", projectCode);
                values.put("pageCode", pageCode);
                if (parentId != null) {
                    values.put("parentId", parentId);
                }
                values.putIfAbsent("status", 1);
                record = insert(treeNodeService, values);
            }
            recordByKey.put(key, record);
        }
    }

    /**
     * 通过 BaseService 分页取得完整匹配记录。
     * 真实传参示例：Table Service 与 {@code {pageCode:"page107001",statusIn:[1,2]}}。
     * 真实返回示例：返回所有匹配记录，超过一千条时自动读取下一页。
     * 异常或副作用示例：Service 查询失败时传播原异常；不直接访问 JdbcTemplate。
     *
     * @param service 当前业务表 Service
     * @param filters BaseDao 明确字段条件
     * @return 全部分页记录
     */
    private List<Map<String, Object>> records(
            BaseService service,
            Map<String, Object> filters) {
        List<Map<String, Object>> result = new ArrayList<>();
        int pageNo = 1;
        long totalCount;
        do {
            CommonPageParam query = new CommonPageParam();
            query.setPageNo(pageNo++);
            query.setPageSize(PAGE_SIZE);
            filters.forEach(query::putParam);
            CommonPageResult page = service.getStore(query);
            result.addAll(page.getRecords());
            totalCount = page.getTotalCount();
        } while (result.size() < totalCount);
        return result;
    }

    /**
     * 查询应唯一的语义记录。
     * 真实传参示例：Control Service 与工程、PAGE、fieldName 三个条件。
     * 真实返回示例：无记录返回空 Map，一条记录返回完整数据库字段。
     * 异常或副作用示例：多条记录抛出 IllegalStateException，避免选择任意一条覆盖配置。
     *
     * @param service 当前业务 Service
     * @param filters 唯一语义条件
     * @return 唯一记录或空 Map
     */
    private Map<String, Object> single(
            BaseService service,
            Map<String, Object> filters) {
        List<Map<String, Object>> matches = records(service, filters);
        if (matches.size() > 1) {
            throw new IllegalStateException("应用默认配置语义坐标重复：" + filters);
        }
        return matches.isEmpty() ? Map.of() : matches.get(0);
    }

    /**
     * 使用业务 Service 公共新增链写入一条声明记录。
     * 真实传参示例：{@code {projectCode:"japanese",controlKind:"PAGE"}}。
     * 真实返回示例：返回包含数据库生成 id 和 code 的字段映射。
     * 异常或副作用示例：号段或数据库写入失败时传播异常并回滚当前初始化事务。
     *
     * @param service 目标业务 Service
     * @param values 待新增业务字段
     * @return 新增后的完整字段映射
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> insert(
            BaseService service,
            Map<String, Object> values) {
        CommonResult result = service.insert(param(values));
        return (Map<String, Object>) result.getData();
    }

    /**
     * 把有序 Map 转为公共动态参数对象。
     * 真实传参示例：{@code {id:107001,width:"320px"}}。
     * 真实返回示例：CommonParam.paramMap 保持相同键值。
     * 异常或副作用示例：空 Map 返回空参数；方法不访问数据库。
     *
     * @param values 声明或更新字段
     * @return 公共 Service 可直接消费的参数
     */
    private CommonParam param(Map<String, Object> values) {
        CommonParam param = new CommonParam();
        values.forEach((key, value) -> {
            if (value != null) {
                param.putParam(key, value);
            }
        });
        return param;
    }

    /** 返回去除一个或多个声明专用键后的可写副本。 */
    private Map<String, Object> without(Map<String, Object> source, String... keys) {
        Map<String, Object> result = new LinkedHashMap<>(source);
        for (String key : keys) {
            result.remove(key);
        }
        return result;
    }

    /** 构建忽略 null 的有序查询条件。 */
    private Map<String, Object> filters(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) {
            if (values[index + 1] != null) {
                result.put(String.valueOf(values[index]), values[index + 1]);
            }
        }
        return result;
    }

    /** 读取必要文本，缺失时用字段名指出无效声明。 */
    private String requiredText(Map<String, Object> source, String key) {
        String value = text(source.get(key));
        if (value.isEmpty()) {
            throw new IllegalStateException("应用默认配置缺少字段：" + key);
        }
        return value;
    }

    /** 把可选值规范为去除首尾空格的文本。 */
    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    /** 把 JSON 对象安全转换为有序 Map，缺失时返回空 Map。 */
    @SuppressWarnings("unchecked")
    private Map<String, Object> object(Object value) {
        return value instanceof Map<?, ?> ? new LinkedHashMap<>((Map<String, Object>) value) : Map.of();
    }

    /** 把 JSON 数组安全转换为对象列表，缺失时返回空列表。 */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> list(Object value) {
        if (!(value instanceof List<?> source)) {
            return List.of();
        }
        return source.stream()
                .filter(Map.class::isInstance)
                .<Map<String, Object>>map(item ->
                        new LinkedHashMap<>((Map<String, Object>) item))
                .toList();
    }
}
