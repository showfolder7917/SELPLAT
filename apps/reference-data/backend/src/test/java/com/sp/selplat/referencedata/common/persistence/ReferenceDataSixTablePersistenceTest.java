package com.sp.selplat.referencedata.common.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

/** 使用隔离 H2 文件验证六表结构、独立号段、共享逻辑号段、code 查询与页面原子保存。 */
class ReferenceDataSixTablePersistenceTest {

    /**
     * 验证全新数据库只创建六张业务表和一张全局号段表。
     * 真实传参示例：JUnit 临时目录中的空 H2 文件。
     * 真实返回示例：PUBLIC 下恰好七张表，六张表各有主键号段并保留 {@code ReferenceDataObjectId}。
     * 异常或副作用示例：只写临时目录，连接池关闭后不影响正式数据库。
     *
     * @param temporaryDirectory JUnit 隔离临时目录
     */
    @Test
    void shouldCreateOnlyFinalSixBusinessTables(@TempDir Path temporaryDirectory) {
        try (HikariDataSource dataSource = open(temporaryDirectory.resolve("six-table"), "SixTablePool")) {
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            List<String> tables = jdbc.queryForList(
                    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' ORDER BY TABLE_NAME",
                    String.class);
            assertEquals(List.of("CommonSequenceSegment", "ReferenceDataControlLayout", "ReferenceDataTable",
                    "ReferenceDataTableElement", "ReferenceDataTreeNode", "ReferenceDataType", "ReferenceDataWindow"), tables);
            assertEquals(List.of(
                    "ReferenceDataControlLayoutId", "ReferenceDataObjectId", "ReferenceDataTableElementId",
                    "ReferenceDataTableId", "ReferenceDataTreeNodeId", "ReferenceDataTypeId", "ReferenceDataWindowId"), jdbc.queryForList(
                    "SELECT seqCode FROM CommonSequenceSegment ORDER BY seqCode", String.class));
            assertFalse(tables.contains("ReferenceDataOption"));
            assertFalse(tables.contains("ReferenceDataContextMenuItem"));
            assertFalse(tables.contains("ReferenceDataTableColumn"));
            assertFalse(tables.contains("ReferenceDataControlBinding"));
            assertEquals(0, deprecatedControlLayoutColumnCount(jdbc));
            assertEquals(0, deprecatedTypeAndTreeColumnCount(jdbc));
            assertEquals(List.of(
                    "id", "code", "tenantId", "lastOperateUserId", "optionSetCode", "valueCode", "parentTypeCode",
                    "nameZh", "nameJa", "nameEn", "status", "sortnum", "createdAt", "updatedAt"),
                    typeColumnNames(jdbc));
            assertEquals(List.of(
                    "id", "code", "tenantId", "lastOperateUserId", "projectCode", "pageCode", "parentId",
                    "nodeValue", "labelZh", "labelJa", "labelEn", "status", "sortnum", "createdAt", "updatedAt"),
                    treeNodeColumnNames(jdbc));
            assertEquals(7L, jdbc.queryForObject("SELECT COUNT(*) FROM ReferenceDataWindow", Long.class));
            assertEquals(1L, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataWindow "
                            + "WHERE code='window101064' AND status=1 AND triggerControlCode='selWindowTypeManagementId'",
                    Long.class));
            assertEquals(1L, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataWindow "
                            + "WHERE code='window103013' AND projectCode='japanese' "
                            + "AND triggerControlCode='selWindowJapaneseN2BlueBookQuestionId'",
                    Long.class));
            assertEquals(2L, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataType "
                            + "WHERE optionSetCode='optionSet103006' AND status=1",
                    Long.class));
            assertEquals(List.of("REVIEWER", "ENGINEER"), jdbc.queryForList(
                    "SELECT valueCode FROM ReferenceDataType "
                            + "WHERE optionSetCode='optionSet103006' ORDER BY sortnum,id",
                    String.class));
        }
    }

    /**
     * 验证旧树节点表补充归属字段时使用唯一页面坐标回填，且不改变树关系。
     * 真实传参示例：旧库树节点 {@code treeNode101001} 缺少 projectCode、pageCode，唯一页面为
     *     {@code qa/page101000}。
     * 真实返回示例：升级后字段位于审计字段之后且为非空，节点 code、parentId 和数量保持不变。
     * 异常或副作用示例：只修改 JUnit 临时文件库；正式数据库不会被连接。
     *
     * @param temporaryDirectory JUnit 隔离临时目录
     */
    @Test
    void shouldBackfillTreeNodeOwnershipWithoutChangingTreeRelation(@TempDir Path temporaryDirectory) {
        Path databaseBase = temporaryDirectory.resolve("tree-node-ownership-upgrade");
        try (HikariDataSource dataSource = open(databaseBase, "TreeOwnershipLegacyPool")) {
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            jdbc.update("INSERT INTO ReferenceDataControlLayout "
                            + "(id,code,projectCode,pageCode,controlKind,sourceTableName,layoutMode) "
                            + "VALUES (?,?,?,?,?,?,?)",
                    101000L, "page101000", "qa", "page101000", "PAGE",
                    "ReferenceDataControlLayout", "FLOW");
            jdbc.update("INSERT INTO ReferenceDataTreeNode "
                            + "(id,code,projectCode,pageCode,parentId,nodeValue,labelZh) VALUES (?,?,?,?,?,?,?)",
                    101001L, "treeNode101001", "qa", "page101000", null, "ROOT", "根节点");
            jdbc.execute("DROP INDEX IF EXISTS idx_reference_data_tree_node_page_parent_sort");
            jdbc.execute("ALTER TABLE ReferenceDataTreeNode DROP COLUMN pageCode");
            jdbc.execute("ALTER TABLE ReferenceDataTreeNode DROP COLUMN projectCode");
        }

        try (HikariDataSource dataSource = open(databaseBase, "TreeOwnershipUpgradePool")) {
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            assertEquals(Map.of(
                    "code", "treeNode101001",
                    "projectCode", "qa",
                    "pageCode", "page101000",
                    "nodeValue", "ROOT"),
                    jdbc.queryForMap(
                            "SELECT code,projectCode,pageCode,nodeValue FROM ReferenceDataTreeNode WHERE id=101001"));
            assertEquals(1L, jdbc.queryForObject("SELECT COUNT(*) FROM ReferenceDataTreeNode", Long.class));
            assertEquals(2L, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='PUBLIC' "
                            + "AND TABLE_NAME='ReferenceDataTreeNode' "
                            + "AND COLUMN_NAME IN ('projectCode','pageCode') AND IS_NULLABLE='NO'",
                    Long.class));
        }
    }

    /**
     * 验证已有库升级会删除无读取链的控件约束列，同时保留原有页面记录。
     * 真实传参示例：旧库含页面 {@code page101000} 和七个已废弃布局列。
     * 真实返回示例：重复初始化后七列数量为 0，页面记录数量仍为 1。
     * 异常或副作用示例：只修改 JUnit 临时目录；正式 reference-data 文件库不会被连接。
     *
     * @param temporaryDirectory JUnit 隔离临时目录
     */
    @Test
    void shouldRemoveDeprecatedControlLayoutColumnsFromExistingDatabase(@TempDir Path temporaryDirectory) {
        Path databaseBase = temporaryDirectory.resolve("control-layout-column-upgrade");
        try (HikariDataSource dataSource = open(databaseBase, "ControlLayoutLegacyPool")) {
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            // 当前结构临时补回旧列并写入真实页面记录，模拟升级前已经长期运行的文件库。
            for (String column : List.of(
                    "minWidth VARCHAR(32)", "maxWidth VARCHAR(32)",
                    "minHeight VARCHAR(32)", "maxHeight VARCHAR(32)",
                    "gapBefore VARCHAR(32)", "gapAfter VARCHAR(32)", "gridColumnSpan INTEGER")) {
                jdbc.execute("ALTER TABLE ReferenceDataControlLayout ADD COLUMN " + column);
            }
            jdbc.update("INSERT INTO ReferenceDataControlLayout "
                    + "(id,code,projectCode,pageCode,controlKind,sourceTableName,layoutMode) VALUES (?,?,?,?,?,?,?)",
                    101000L, "page101000", "reference-data", "page101000", "PAGE",
                    "ReferenceDataControlLayout", "FLOW");
            assertEquals(7, deprecatedControlLayoutColumnCount(jdbc));
        }

        // 同一文件库再次执行正式初始化脚本 → 旧列全部删除，既有业务记录保持不变。
        try (HikariDataSource dataSource = open(databaseBase, "ControlLayoutUpgradePool")) {
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            assertEquals(0, deprecatedControlLayoutColumnCount(jdbc));
            assertEquals(1L, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataControlLayout WHERE code='page101000'", Long.class));
        }
    }

    /**
     * 验证已有类型表调整物理字段顺序，并清除职责错误的 TREE 类型。
     * 真实传参示例：旧库保存 TREE 和 DROPDOWN 两条分类，字段顺序为 {@code id,...,code,categoryCode}。
     * 真实返回示例：重新初始化后 TREE 被物理删除，{@code type101002/optionSet101002/DROPDOWN} 保留。
     * 异常或副作用示例：只修改 JUnit 临时文件库；迁移失败会使测试失败且不会触碰正式数据库。
     *
     * @param temporaryDirectory JUnit 隔离临时目录
     */
    @Test
    void shouldReorderExistingTypeColumnsAndRemoveMisclassifiedTreeType(@TempDir Path temporaryDirectory) {
        Path databaseBase = temporaryDirectory.resolve("type-column-order-upgrade");
        try (HikariDataSource legacyDataSource = openWithoutInitialization(databaseBase, "TypeOrderLegacyPool")) {
            // 专属旧结构 fixture → 建立 code/categoryCode 位于末尾的真实文件库。
            ResourceDatabasePopulator populator = new ResourceDatabasePopulator(new ClassPathResource(
                    "fixtures/ReferenceDataSixTablePersistenceTest/shouldReorderExistingTypeColumnsWithoutChangingRows.sql"));
            populator.execute(legacyDataSource);
            assertEquals(List.of(
                    "id", "tenantId", "lastOperateUserId", "nameZh", "nameJa", "nameEn",
                    "status", "sortnum", "createdAt", "updatedAt", "code", "categoryCode"),
                    typeColumnNames(new JdbcTemplate(legacyDataSource)));
        }

        // 正式初始化入口重开同一文件库 → 原地迁移字段顺序、删除 TREE 并保留有效菜单类型。
        try (HikariDataSource upgradedDataSource = open(databaseBase, "TypeOrderUpgradePool")) {
            JdbcTemplate jdbc = new JdbcTemplate(upgradedDataSource);
            assertEquals(List.of(
                    "id", "code", "tenantId", "lastOperateUserId", "optionSetCode", "valueCode", "parentTypeCode",
                    "nameZh", "nameJa", "nameEn", "status", "sortnum", "createdAt", "updatedAt"),
                    typeColumnNames(jdbc));
            assertEquals(0L, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM ReferenceDataType WHERE valueCode='TREE'", Long.class));
            assertEquals(Map.of(
                    "code", "type101002", "optionSetCode", "optionSet101002", "valueCode", "DROPDOWN", "nameZh", "下拉框"),
                    jdbc.queryForMap(
                            "SELECT code,optionSetCode,valueCode,nameZh FROM ReferenceDataType WHERE id=101002"));
        }
    }

    /**
     * 验证历史六条逻辑表定义原地合并为一条真实 Grid，全部元素按 viewCode 保留。
     * 真实传参示例：同一页面六个旧 dataTableName 父记录和各一条子元素。
     * 真实返回示例：保留 table101020，六条元素均改挂 101020 且覆盖六种 viewCode。
     * 异常或副作用示例：只迁移 JUnit 临时文件库，不连接正式 reference-data 数据库。
     *
     * @param temporaryDirectory JUnit 隔离临时目录
     */
    @Test
    void shouldMergeLegacyTableDefinitionsIntoSingleGrid(@TempDir Path temporaryDirectory) {
        Path databaseBase = temporaryDirectory.resolve("single-grid-upgrade");
        try (HikariDataSource legacyDataSource = openWithoutInitialization(databaseBase, "SingleGridLegacyPool")) {
            ResourceDatabasePopulator populator = new ResourceDatabasePopulator(new ClassPathResource(
                    "fixtures/ReferenceDataSixTablePersistenceTest/shouldMergeLegacyTableDefinitionsIntoSingleGrid.sql"));
            populator.execute(legacyDataSource);
        }

        try (HikariDataSource upgradedDataSource = open(databaseBase, "SingleGridUpgradePool")) {
            JdbcTemplate jdbc = new JdbcTemplate(upgradedDataSource);
            assertEquals(1L, jdbc.queryForObject("SELECT COUNT(*) FROM ReferenceDataTable", Long.class));
            assertEquals(Map.of(
                    "id", 101020L,
                    "code", "table101020",
                    "gridId", "selGridReferenceDataManagementId"),
                    jdbc.queryForMap("SELECT id,code,gridId FROM ReferenceDataTable"));
            assertEquals(6L, jdbc.queryForObject("SELECT COUNT(*) FROM ReferenceDataTableElement", Long.class));
            assertEquals(1L, jdbc.queryForObject(
                    "SELECT COUNT(DISTINCT tableId) FROM ReferenceDataTableElement", Long.class));
            assertEquals(List.of("CONTROL", "TABLE", "TABLE_ELEMENT", "TREE", "TYPE", "WINDOW"),
                    jdbc.queryForList(
                            "SELECT DISTINCT viewCode FROM ReferenceDataTableElement ORDER BY viewCode",
                            String.class));
            assertEquals(0L, jdbc.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='PUBLIC' "
                            + "AND TABLE_NAME='ReferenceDataTable' AND COLUMN_NAME='dataTableName'",
                    Long.class));
        }
    }

    /**
     * 验证页面配置按 code 查询、按 tableId 关联并以版本号保存列宽。
     * 真实传参示例：页面 {@code page101000} 保存元素 {@code tableElement101002} 宽度为 240px。
     * 真实返回示例：查询来源为 ReferenceDataTableElement，保存后版本为 2 且数据库宽度为 240px。
     * 异常或副作用示例：只修改测试临时库；请求身份不由测试参数提供。
     *
     * @param temporaryDirectory JUnit 隔离临时目录
     */
    @Test
    void shouldResolveCodeAndSavePageConfiguration(@TempDir Path temporaryDirectory) {
        try (HikariDataSource dataSource = open(temporaryDirectory.resolve("page-save"), "PageSavePool")) {
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            jdbc.update("INSERT INTO ReferenceDataControlLayout "
                    + "(id,code,projectCode,pageCode,controlKind,sourceTableName,layoutMode,breakpoint,editable,versionNo) "
                    + "VALUES (?,?,?,?,?,?,?,?,?,?)", 101000L, "page101000", "reference-data",
                    "page101000", "PAGE", "ReferenceDataControlLayout", "FLOW", "DESKTOP", true, 1L);
            jdbc.update("INSERT INTO ReferenceDataTable "
                    + "(id,code,projectCode,pageCode,gridId,nameZh) VALUES (?,?,?,?,?,?)",
                    101001L, "table101001", "reference-data", "page101000",
                    "selGridReferenceDataManagementId", "引用数据管理表格");
            jdbc.update("INSERT INTO ReferenceDataTableElement "
                    + "(id,code,projectCode,tableId,viewCode,fieldName,labelZh,width) VALUES (?,?,?,?,?,?,?,?)",
                    101002L, "tableElement101002", "reference-data", 101001L,
                    "TYPE", "nameZh", "中文名称", "160px");
            // 搜索输入和查询按钮是同一工具栏下的两条独立记录，保存输入矩形不得覆盖按钮位置。
            jdbc.update("INSERT INTO ReferenceDataControlLayout "
                    + "(id,code,projectCode,pageCode,parentKind,parentCode,controlKind,sourceTableName,layoutMode,"
                    + "orderNo,width,height,x,y,breakpoint,editable,versionNo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    101003L, "control101003", "reference-data", "page101000", "TOOLBAR", "control101005",
                    "SEARCH", "ReferenceDataControlLayout", "ABSOLUTE", 10, "280px", "42px", 16, 23,
                    "DESKTOP", true, 1L);
            jdbc.update("INSERT INTO ReferenceDataControlLayout "
                    + "(id,code,projectCode,pageCode,parentKind,parentCode,controlKind,sourceTableName,layoutMode,"
                    + "orderNo,width,height,x,y,breakpoint,editable,versionNo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    101004L, "control101004", "reference-data", "page101000", "TOOLBAR", "control101005",
                    "BUTTON", "ReferenceDataControlLayout", "ABSOLUTE", 20, "86px", "42px", 304, 23,
                    "DESKTOP", true, 1L);
            assertEquals(Map.of("tableId", 101001L, "viewCode", "TYPE"), jdbc.queryForMap(
                    "SELECT tableId,viewCode FROM ReferenceDataTableElement WHERE code='tableElement101002'"));
            jdbc.update("UPDATE ReferenceDataTableElement SET width=? WHERE code=?", "240px", "tableElement101002");
            jdbc.update("UPDATE ReferenceDataControlLayout SET width=?,height=?,x=?,y=? WHERE code=?",
                    "360px", "42px", 28, 20, "control101003");
            jdbc.update("UPDATE ReferenceDataControlLayout SET versionNo=versionNo+1 WHERE code=?", "page101000");
            assertEquals("240px", jdbc.queryForObject(
                    "SELECT width FROM ReferenceDataTableElement WHERE code='tableElement101002'", String.class));
            assertEquals(2L, jdbc.queryForObject(
                    "SELECT versionNo FROM ReferenceDataControlLayout WHERE code='page101000'", Long.class));
            assertEquals("360px", jdbc.queryForObject(
                    "SELECT width FROM ReferenceDataControlLayout WHERE code='control101003'", String.class));
            assertEquals(28, jdbc.queryForObject(
                    "SELECT x FROM ReferenceDataControlLayout WHERE code='control101003'", Integer.class));
            assertEquals("86px", jdbc.queryForObject(
                    "SELECT width FROM ReferenceDataControlLayout WHERE code='control101004'", String.class));
            assertEquals(304, jdbc.queryForObject(
                    "SELECT x FROM ReferenceDataControlLayout WHERE code='control101004'", Integer.class));
        }
    }

    /**
     * 创建并初始化一个只属于当前测试的 reference-data H2 文件库。
     * 真实传参示例：数据库基础路径 {@code /tmp/six-table}，池名 {@code SixTablePool}。
     * 真实返回示例：返回已执行六个业务表结构、公共号段结构和号段数据脚本的 HikariDataSource。
     * 异常或副作用示例：初始化失败时抛出系统异常；成功时调用方必须关闭连接池。
     *
     * @param databaseBase 临时数据库基础路径
     * @param poolName 测试连接池名称
     * @return 已初始化的临时连接池
     */
    private HikariDataSource open(Path databaseBase, String poolName) {
        HikariConfig config = databaseConfig(databaseBase, poolName);
        return new ReferenceDataPersistenceConfiguration().referenceDataDataSource(config);
    }

    /**
     * 打开尚未执行正式初始化脚本的隔离 H2 文件库，用于构造旧版本结构。
     * 真实传参示例：数据库基础路径 {@code /tmp/type-order-upgrade}，池名 {@code TypeOrderLegacyPool}。
     * 真实返回示例：返回空文件库连接池，测试 fixture 可以先创建历史 ReferenceDataType。
     * 异常或副作用示例：连接池由调用方关闭；方法不读取正式数据库。
     *
     * @param databaseBase 临时数据库基础路径
     * @param poolName 测试连接池名称
     * @return 未执行 Reference Data 初始化器的连接池
     */
    private HikariDataSource openWithoutInitialization(Path databaseBase, String poolName) {
        return new HikariDataSource(databaseConfig(databaseBase, poolName));
    }

    /**
     * 创建隔离文件库共用的 Hikari 参数。
     * 真实传参示例：{@code type-column-order-upgrade/TypeOrderUpgradePool}。
     * 真实返回示例：返回账号 sa、空测试密码、最多两个连接的 H2 配置。
     * 异常或副作用示例：只创建参数对象，不打开连接或生成数据库文件。
     *
     * @param databaseBase 临时数据库基础路径
     * @param poolName 测试连接池名称
     * @return 可供初始化前后连接池复用的 Hikari 参数
     */
    private HikariConfig databaseConfig(Path databaseBase, String poolName) {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:file:" + databaseBase.toAbsolutePath().normalize()
                + ";MODE=MySQL;DATABASE_TO_UPPER=false");
        config.setPoolName(poolName);
        config.setUsername("sa");
        config.setPassword("");
        config.setDriverClassName("org.h2.Driver");
        config.setMaximumPoolSize(2);
        return config;
    }

    /**
     * 统计页面控件表仍存在的废弃布局列。
     * 真实传参示例：包含旧 minWidth 和 gapBefore 的隔离 H2 数据库。
     * 真实返回示例：升级前返回 7，执行最终结构脚本后返回 0。
     * 异常或副作用示例：只读取 INFORMATION_SCHEMA，不修改任何业务记录。
     *
     * @param jdbc 当前隔离测试库的 JDBC 入口
     * @return 七个目标字段中仍存在的字段数量
     */
    private int deprecatedControlLayoutColumnCount(JdbcTemplate jdbc) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                        + "WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME='ReferenceDataControlLayout' "
                        + "AND COLUMN_NAME IN ('minWidth','maxWidth','minHeight','maxHeight',"
                        + "'gapBefore','gapAfter','gridColumnSpan')",
                Integer.class);
        return count == null ? 0 : count;
    }

    /**
     * 统计类型表和树节点表中已明确废弃的行为字段。
     * 真实传参示例：执行最终 schema 后的隔离 H2 数据库。
     * 真实返回示例：类型 categoryCode、控件 typeId 与树表旧字段均不存在，返回 0。
     * 异常或副作用示例：只读取 INFORMATION_SCHEMA，不修改数据库。
     *
     * @param jdbc 当前隔离测试库的 JDBC 入口
     * @return 已废弃字段中仍存在的数量
     */
    private int deprecatedTypeAndTreeColumnCount(JdbcTemplate jdbc) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='PUBLIC' AND "
                        + "((TABLE_NAME='ReferenceDataType' AND COLUMN_NAME IN "
                        + "('projectCode','resourceCode','type','categoryCode','controlCode','descriptionZh','descriptionJa','descriptionEn',"
                        + "'multiple','searchable','clearable','attributesJson')) OR "
                        + "(TABLE_NAME='ReferenceDataControlLayout' AND COLUMN_NAME='typeId') OR "
                        + "(TABLE_NAME='ReferenceDataTreeNode' AND COLUMN_NAME IN "
                        + "('typeId','nodeCode','attributesJson','icon','commandCode','disabled','selectable')))",
                Integer.class);
        return count == null ? 0 : count;
    }

    /**
     * 按数据库物理顺序读取 ReferenceDataType 最终字段名。
     * 真实传参示例：执行最终 schema 后的隔离 H2 数据库。
     * 真实返回示例：{@code [id,code,tenantId,lastOperateUserId,optionSetCode,valueCode,parentTypeCode,nameZh,nameJa,nameEn,status,sortnum,createdAt,updatedAt]}。
     * 异常或副作用示例：只读 INFORMATION_SCHEMA；目标表缺失时返回空列表。
     *
     * @param jdbc 当前隔离测试库的 JDBC 入口
     * @return 按 ORDINAL_POSITION 排列的字段名
     */
    private List<String> typeColumnNames(JdbcTemplate jdbc) {
        return jdbc.queryForList(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                        + "WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME='ReferenceDataType' ORDER BY ORDINAL_POSITION",
                String.class);
    }

    /**
     * 按数据库物理顺序读取 ReferenceDataTreeNode 最终字段名。
     * 真实传参示例：执行最终 schema 或旧库归属迁移后的隔离 H2 数据库。
     * 真实返回示例：projectCode、pageCode 位于 lastOperateUserId 和 parentId 之间。
     * 异常或副作用示例：只读 INFORMATION_SCHEMA；目标表缺失时返回空列表。
     *
     * @param jdbc 当前隔离测试库的 JDBC 入口
     * @return 按 ORDINAL_POSITION 排列的字段名
     */
    private List<String> treeNodeColumnNames(JdbcTemplate jdbc) {
        return jdbc.queryForList(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                        + "WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME='ReferenceDataTreeNode' ORDER BY ORDINAL_POSITION",
                String.class);
    }
}
