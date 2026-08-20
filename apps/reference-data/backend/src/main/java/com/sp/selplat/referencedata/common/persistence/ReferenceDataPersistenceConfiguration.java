package com.sp.selplat.referencedata.common.persistence;

import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDao;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDaoImpl;
import com.sp.selplat.common.db.template.BaseTemplateDao;
import com.sp.selplat.common.db.template.BaseTemplateMapper;
import com.sp.selplat.common.exception.CommonSystemException;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.PlatformTransactionManager;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.transaction.SpringManagedTransactionFactory;

/**
 * 创建 reference-data 自己的永久文件数据库并执行可重复初始化脚本。
 * 数据源使用模块限定名且不标记为 Primary，避免改变 Host 中其他应用的数据源选择。
 */
@Configuration(proxyBeanMethods = false)
@PropertySource("classpath:reference-data-module.properties")
public class ReferenceDataPersistenceConfiguration {

    // 数据库脚本按外键父表到子表的固定职责顺序执行，避免依赖文件系统遍历顺序。
    private static final String[] DATABASE_RESOURCES = {
        "db/reference-data/sql/schema-CommonSequenceSegment.sql",
        "db/reference-data/sql/schema-ReferenceDataTable.sql",
        "db/reference-data/sql/schema-ReferenceDataControlLayout.sql",
        "db/reference-data/sql/schema-ReferenceDataType.sql",
        "db/reference-data/sql/schema-ReferenceDataTreeNode.sql",
        "db/reference-data/sql/schema-ReferenceDataTableElement.sql",
        "db/reference-data/sql/schema-ReferenceDataWindow.sql",
        "db/reference-data/sql/data-ReferenceDataType.sql",
        "db/reference-data/sql/data-ReferenceDataWindow.sql",
        "db/reference-data/sql/data-CommonSequenceSegment.sql"
    };
    // 旧正式库的业务表曾使用 identity；只按固定白名单迁移，禁止动态拼接外部表名。
    private static final String[] BUSINESS_TABLES = {
        "ReferenceDataType",
        "ReferenceDataTreeNode",
        "ReferenceDataTable",
        "ReferenceDataTableElement",
        "ReferenceDataControlLayout",
        "ReferenceDataWindow"
    };
    // 类型值物理列固定遵循“主键、公开坐标、身份、选项组、层级值、名称、状态排序、时间”的顺序。
    private static final List<String> REFERENCE_DATA_TYPE_COLUMNS = List.of(
            "id", "code", "tenantId", "lastOperateUserId", "optionSetCode", "valueCode", "parentTypeCode",
            "nameZh", "nameJa", "nameEn", "status", "sortnum", "createdAt", "updatedAt");

    /**
     * 把模块资源中的私有数据库参数绑定到 Hikari 官方配置对象。
     *
     * @return Reference Data 连接池参数，例如
     *     {@code {"poolName":"ReferenceDataPool","maximumPoolSize":4}}
     * 异常或副作用示例：该方法只创建未启动的配置对象，不打开数据库连接。
     */
    @Bean("referenceDataHikariConfig")
    @ConfigurationProperties(prefix = "reference-data.datasource")
    public HikariConfig referenceDataHikariConfig() {
        // 模块 properties → Hikari 标准参数；连接池的创建和关闭仍由下一个具名 Bean 管理。
        return new HikariConfig();
    }

    /**
     * 创建并初始化 reference-data 独立 Hikari 连接池。
     *
     * @param config 模块资源或隔离测试绑定的 Hikari 参数，例如
     *     {@code {"jdbcUrl":"jdbc:h2:mem:reference_data_test","poolName":"ReferenceDataTestPool"}}
     * @return 可注入 DAO 的模块私有连接池；本地默认指向
     *     {@code apps/reference-data/db/reference-data.mv.db}
     * @throws CommonSystemException 当工程根、目录、连接池或数据库脚本无法初始化时抛出，例如
     *     {@code CommonSystemException("REFERENCE_DATA_DATABASE_INITIALIZATION_FAILED", "引用数据数据库初始化失败。", cause)}
     */
    @Bean(name = "referenceDataDataSource", destroyMethod = "close")
    public HikariDataSource referenceDataDataSource(
            @Qualifier("referenceDataHikariConfig") HikariConfig config) {
        HikariDataSource dataSource = null;
        try {
            // 测试显式 URL 或工程永久路径 → 连接池唯一 JDBC 地址。
            config.setJdbcUrl(resolveDatabaseUrl(config.getJdbcUrl()));
            // HikariConfig → 模块私有连接池；具名 Bean 保证 Host 不按类型误选其他项目数据源。
            dataSource = new HikariDataSource(config);
            // 固定 SQL 清单依次执行 → 创建缺失六表结构，并幂等补充角色类型、Window 与号段种子。
            initializeDatabase(dataSource);
            // 初始化完成的连接池 → DAO、全局号段和 BaseDataSourceContext 共用同一数据库。
            return dataSource;
        } catch (RuntimeException exception) {
            // 初始化中途失败 → 先关闭已经启动的池，避免 Host 重试时残留连接与文件锁。
            if (dataSource != null) {
                dataSource.close();
            }
            // 路径、驱动或 SQL 初始化失败 → 保留技术原因并输出稳定系统异常。
            throw new CommonSystemException(
                    "REFERENCE_DATA_DATABASE_INITIALIZATION_FAILED",
                    "引用数据数据库初始化失败。",
                    exception);
        }
    }

    /**
     * 创建只访问 reference-data 永久库的 JDBC 模板。
     *
     * @param dataSource 带限定名的 reference-data 模块私有数据源
     * @return ReferenceDataType 自定义查询使用的 JDBC 模板
     */
    @Bean("referenceDataJdbcTemplate")
    public JdbcTemplate referenceDataJdbcTemplate(
            @Qualifier("referenceDataDataSource") DataSource dataSource) {
        // 模块私有数据源 → DAO 自定义查询使用的唯一 JDBC 模板。
        return new JdbcTemplate(dataSource);
    }

    /**
     * 创建 Reference Data 永久库专用事务管理器，避免 Host 多数据源运行时误选其他应用数据库。
     *
     * @param dataSource Reference Data 模块私有连接池，例如池名 {@code ReferenceDataPool}
     * @return 只提交或回滚 Reference Data 六张业务表操作的事务管理器
     * 异常或副作用示例：页面配置批量更新中任一 code 未命中时，管理器回滚同批次已经执行的更新。
     */
    @Bean("referenceDataTransactionManager")
    public PlatformTransactionManager referenceDataTransactionManager(
            @Qualifier("referenceDataDataSource") DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }

    /**
     * 创建只在 reference-data 私有数据库中查询和推进号段的项目 DAO。
     *
     * @param dataSource reference-data 配置按限定名提供的私有数据源
     * @return 可查询各表独立号段和通用逻辑对象号段的 DAO
     * 异常或副作用示例：多个进程并发抢号时只原子推进目标 seqCode 的 nextStartId 和 versionNo。
     */
    @Bean("referenceDataCommonSequenceSegmentDao")
    public CommonSequenceSegmentDao referenceDataCommonSequenceSegmentDao(
            @Qualifier("referenceDataDataSource") DataSource dataSource) {
        // reference-data 私有数据源 → 六张表独立主键号段及通用逻辑对象号段的查询和推进边界。
        return new CommonSequenceSegmentDaoImpl(dataSource);
    }

    /**
     * 绑定 reference-data 永久库与只访问同一数据库的公共模板 DAO。
     *
     * @param dataSource 带限定名的 reference-data 模块私有数据源
     * @return ReferenceDataType 等固定表使用的数据源上下文
     */
    @Bean("referenceDataBaseDataSourceContext")
    public BaseDataSourceContext referenceDataBaseDataSourceContext(
            @Qualifier("referenceDataDataSource") DataSource dataSource) {
        org.apache.ibatis.session.Configuration configuration = new org.apache.ibatis.session.Configuration();
        configuration.setEnvironment(new Environment(
                "reference-data",
                new SpringManagedTransactionFactory(),
                dataSource));
        configuration.addMapper(BaseTemplateMapper.class);
        SqlSessionFactory sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
        SqlSessionTemplate sqlSessionTemplate = new SqlSessionTemplate(sqlSessionFactory);
        BaseTemplateMapper mapper = sqlSessionTemplate.getMapper(BaseTemplateMapper.class);
        return new BaseDataSourceContext(dataSource, new BaseTemplateDao(mapper, dataSource));
    }

    /**
     * 解析测试 URL 或工程内永久数据库路径。
     *
     * @param configuredUrl 配置文件或测试传入的 URL，例如 {@code jdbc:h2:mem:reference_data_test}
     * @return 实际 JDBC URL；本地默认形如
     *     {@code jdbc:h2:file:/workspace/SELPLAT/apps/reference-data/db/reference-data;MODE=MySQL}
     */
    private String resolveDatabaseUrl(String configuredUrl) {
        // 显式 URL 主要供隔离测试和部署覆盖，禁止再推导工程目录。
        if (configuredUrl != null && !configuredUrl.trim().isEmpty()) {
            return configuredUrl.trim();
        }
        // 当前进程目录 → 向上识别包含 settings.gradle 和 reference-data 模块的 SELPLAT 根。
        Path projectRoot = locateProjectRoot(Path.of(System.getProperty("user.dir")));
        // 权威数据库目录固定属于 reference-data，服务重启不删除此目录。
        Path databaseDirectory = projectRoot.resolve("apps/reference-data/db").normalize();
        try {
            // 首次启动创建数据目录 → 后续 H2 在相同路径打开已有数据库。
            Files.createDirectories(databaseDirectory);
        } catch (Exception exception) {
            throw new IllegalStateException("无法创建引用数据数据库目录: " + databaseDirectory, exception);
        }
        // 不附加 .mv.db 扩展名，由 H2 按文件数据库约定生成实际数据文件。
        Path databaseFile = databaseDirectory.resolve("reference-data").toAbsolutePath().normalize();
        return "jdbc:h2:file:" + databaseFile
                + ";MODE=MySQL;DATABASE_TO_UPPER=false";
    }

    /**
     * 从当前工作目录向上定位唯一 SELPLAT 工程根。
     *
     * @param startPath Java 进程当前目录，例如 {@code apps/host/backend}
     * @return 同时包含 {@code settings.gradle} 与 {@code apps/reference-data} 的工程根路径
     * @throws IllegalStateException 当向上遍历仍无法定位工程根时抛出，例如
     *     {@code IllegalStateException("无法定位 SELPLAT 工程根")}
     */
    private Path locateProjectRoot(Path startPath) {
        // 从真实绝对目录开始逐级向上，避免依赖机器固定绝对路径。
        Path currentPath = startPath.toAbsolutePath().normalize();
        while (currentPath != null) {
            // 根构建入口与目标应用同时存在 → 当前目录是唯一工程根。
            if (Files.isRegularFile(currentPath.resolve("settings.gradle"))
                    && Files.isDirectory(currentPath.resolve("apps/reference-data"))) {
                return currentPath;
            }
            // 未命中时检查父目录，直到文件系统根为止。
            currentPath = currentPath.getParent();
        }
        // 无根目录时禁止退回用户目录或临时路径，避免业务数据落到未知位置。
        throw new IllegalStateException("无法定位 SELPLAT 工程根");
    }

    /**
     * 按固定顺序执行 reference-data 建表、号段和表格定义演示数据脚本。
     *
     * @param dataSource 当前独立文件库或隔离测试库
     * 执行结果示例：数据库包含六张业务表、一张公共号段表、AI 工厂角色类型选项组、
     *     六个表主键号段和 ReferenceDataObjectId 通用号段；再次执行不会覆盖管理员维护的数据。
     */
    private void initializeDatabase(DataSource dataSource) {
        // 固定结构和数据资源清单 → 可重复执行的数据库初始化器。
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        for (String databaseResource : DATABASE_RESOURCES) {
            // 每个职责脚本按数组顺序加入，禁止把多张表重新合并到同一个 SQL 文件。
            populator.addScript(new ClassPathResource(databaseResource));
        }
        // 当前数据源执行完整脚本；任一 SQL 失败都会阻止模块以半初始化状态启动。
        populator.execute(dataSource);
        // 旧通用号段只改职责说明，不重置游标、步长或版本。
        normalizeSharedSequenceMetadata(dataSource);
        // 已有正式库可能仍保留旧 identity 元数据 → 数据保留不变，只移除业务表自增属性。
        migrateLegacyIdentityColumns(dataSource);
        // 旧控件直属分类 → 可复用 optionSetCode，并物理删除 categoryCode/controlCode。
        migrateReferenceDataTypeOptionSet(dataSource);
        // TREE 只属于树节点表 → 清除历史误入类型表的记录，避免每次启动重新展示。
        removeMisclassifiedTreeTypes(dataSource);
        // 树节点补充只用于展示的工程和页面归属，code + parentId 建树逻辑保持不变。
        migrateReferenceDataTreeNodeOwnership(dataSource);
        // 六个历史逻辑表格 → 一个真实 Grid；51 条表格元素保留并用 viewCode 区分视图。
        migrateReferenceDataSingleGrid(dataSource);
    }

    /**
     * 把旧 ReferenceDataObjectId 的说明收口为共享逻辑对象号段，不改变已领取游标。
     * 真实传参示例：旧记录名称为“引用数据全局对象主键”，nextStartId 为 107000。
     * 真实返回示例：名称改为“引用数据通用逻辑对象”，nextStartId 仍为 107000。
     * 异常或副作用示例：数据库更新失败时模块启动失败；不会插入重复号段或回退版本。
     *
     * @param dataSource 当前 reference-data 私有数据源
     */
    private void normalizeSharedSequenceMetadata(DataSource dataSource) {
        new JdbcTemplate(dataSource).update(
                "UPDATE CommonSequenceSegment SET seqName=?,remark=? WHERE seqCode=?",
                "引用数据通用逻辑对象",
                "无独立实体表的通用逻辑编码号段；当前用于 optionSetCode，不用于六张业务表主键",
                "ReferenceDataObjectId");
    }

    /**
     * 把旧正式库业务表的 identity 主键原地迁移为公共号段主键。
     *
     * @param dataSource 当前 reference-data 私有数据源，例如旧库中 ReferenceDataType.id 仍为 identity
     * 执行结果示例：六张业务表的现有 id 和外键保持不变，IS_IDENTITY 统一变为 NO
     * 异常或副作用示例：ALTER 失败时数据库初始化整体失败，不会创建替代表或重写已有记录。
     */
    private void migrateLegacyIdentityColumns(DataSource dataSource) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        for (String tableName : BUSINESS_TABLES) {
            // 固定表名查询元数据 → 只在旧列仍声明 identity 时执行一次兼容 ALTER。
            Integer identityCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                            + "WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_NAME = ? "
                            + "AND COLUMN_NAME = 'id' AND IS_IDENTITY = 'YES'",
                    Integer.class,
                    tableName);
            if (identityCount != null && identityCount > 0) {
                // H2 原地删除自增属性；主键值、索引和引用当前 id 的外键均保持不变。
                jdbcTemplate.execute("ALTER TABLE " + tableName + " ALTER COLUMN id DROP IDENTITY");
            }
        }
    }

    /**
     * 把旧全局分类原地迁移为真实页面控件拥有的分级类型值。
     * 真实传参示例：旧记录为 {@code type101001/categoryCode=DROPDOWN}，页面存在 orderNo=30 的类型筛选控件。
     * 真实返回示例：记录变为 {@code optionSetCode=optionSet103005,valueCode=DROPDOWN,parentTypeCode=null}。
     * 异常或副作用示例：字段集合无法识别时阻断启动，不猜测或丢弃旧分类值。
     *
     * @param dataSource 当前 reference-data 私有数据源
     */
    private void migrateReferenceDataTypeOptionSet(DataSource dataSource) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        List<String> actualColumns = jdbcTemplate.queryForList(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                        + "WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_NAME='ReferenceDataType' ORDER BY ORDINAL_POSITION",
                String.class);
        if (REFERENCE_DATA_TYPE_COLUMNS.equals(actualColumns)) {
            return;
        }
        if (!actualColumns.containsAll(List.of(
                "id", "code", "tenantId", "lastOperateUserId", "nameZh", "nameJa", "nameEn",
                "status", "sortnum", "createdAt", "updatedAt"))) {
            throw new IllegalStateException("ReferenceDataType 字段集合不符合最终结构：" + actualColumns);
        }
        // 释放旧控件绑定与过渡列约束和索引，随后原地重建最终物理顺序。
        // 父级外键依赖旧组合唯一约束，必须先删除外键再删除其被引用约束。
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP CONSTRAINT IF EXISTS fk_reference_data_type_parent");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP CONSTRAINT IF EXISTS fk_reference_data_type_control");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP CONSTRAINT IF EXISTS uk_reference_data_type_code");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP CONSTRAINT IF EXISTS uk_reference_data_type_category_code");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP CONSTRAINT IF EXISTS ck_reference_data_type_category_code");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP CONSTRAINT IF EXISTS uk_reference_data_type_control_value");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP CONSTRAINT IF EXISTS uk_reference_data_type_control_code");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP CONSTRAINT IF EXISTS ck_reference_data_type_parent_not_self");
        jdbcTemplate.execute("DROP INDEX IF EXISTS idx_reference_data_type_control_parent_sort");
        jdbcTemplate.execute("DROP INDEX IF EXISTS idx_reference_data_type_option_parent_sort");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP CONSTRAINT IF EXISTS uk_reference_data_type_option_value");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP CONSTRAINT IF EXISTS uk_reference_data_type_option_code");
        if (actualColumns.indexOf("code") != 1) {
            jdbcTemplate.execute("ALTER TABLE ReferenceDataType ALTER COLUMN code RENAME TO legacyCodeOrder");
            jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD COLUMN code VARCHAR(100) AFTER id");
            jdbcTemplate.update("UPDATE ReferenceDataType SET code=legacyCodeOrder");
            jdbcTemplate.execute("ALTER TABLE ReferenceDataType ALTER COLUMN code SET NOT NULL");
            jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP COLUMN legacyCodeOrder");
        }
        if (!actualColumns.contains("optionSetCode")) {
            jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD COLUMN optionSetCode VARCHAR(100)");
        }
        if (!actualColumns.contains("valueCode")) {
            jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD COLUMN valueCode VARCHAR(100)");
        }
        if (!actualColumns.contains("parentTypeCode")) {
            jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD COLUMN parentTypeCode VARCHAR(100)");
        }
        if (actualColumns.contains("categoryCode")) {
            jdbcTemplate.update("UPDATE ReferenceDataType SET valueCode=categoryCode WHERE valueCode IS NULL");
        }
        if (actualColumns.contains("controlCode")) {
            // 历史 controlCode 的数字来自旧 ReferenceDataObjectId，迁移时复用该已发号码形成稳定选项组。
            jdbcTemplate.update("UPDATE ReferenceDataType SET optionSetCode=CONCAT('optionSet',"
                    + "CASE WHEN REGEXP_REPLACE(controlCode,'[^0-9]','')='' THEN CAST(id AS VARCHAR) "
                    + "ELSE REGEXP_REPLACE(controlCode,'[^0-9]','') END) WHERE optionSetCode IS NULL");
            List<Map<String, Object>> bindings = jdbcTemplate.queryForList(
                    "SELECT controlCode,MIN(optionSetCode) optionSetCode FROM ReferenceDataType "
                            + "WHERE controlCode IS NOT NULL GROUP BY controlCode");
            for (Map<String, Object> binding : bindings) {
                jdbcTemplate.update(
                        "UPDATE ReferenceDataControlLayout SET optionSetCode=? WHERE code=?",
                        binding.get("optionSetCode"), binding.get("controlCode"));
            }
        }
        jdbcTemplate.update("UPDATE ReferenceDataType SET optionSetCode=CONCAT('optionSet',CAST(id AS VARCHAR)) "
                + "WHERE optionSetCode IS NULL");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ALTER COLUMN optionSetCode RENAME TO legacyOptionSetCode");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ALTER COLUMN valueCode RENAME TO legacyValueCode");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ALTER COLUMN parentTypeCode RENAME TO legacyParentTypeCode");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD COLUMN optionSetCode VARCHAR(100) AFTER lastOperateUserId");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD COLUMN valueCode VARCHAR(100) AFTER optionSetCode");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD COLUMN parentTypeCode VARCHAR(100) AFTER valueCode");
        jdbcTemplate.update("UPDATE ReferenceDataType SET optionSetCode=legacyOptionSetCode,"
                + "valueCode=legacyValueCode,parentTypeCode=legacyParentTypeCode");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP COLUMN legacyOptionSetCode");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP COLUMN legacyValueCode");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP COLUMN legacyParentTypeCode");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP COLUMN IF EXISTS controlCode");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType DROP COLUMN IF EXISTS categoryCode");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ALTER COLUMN optionSetCode SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ALTER COLUMN valueCode SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD CONSTRAINT uk_reference_data_type_code UNIQUE(code)");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD CONSTRAINT uk_reference_data_type_option_value "
                + "UNIQUE(tenantId,optionSetCode,valueCode)");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD CONSTRAINT uk_reference_data_type_option_code "
                + "UNIQUE(optionSetCode,code)");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD CONSTRAINT fk_reference_data_type_parent "
                + "FOREIGN KEY(optionSetCode,parentTypeCode) REFERENCES ReferenceDataType(optionSetCode,code)");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataType ADD CONSTRAINT ck_reference_data_type_parent_not_self "
                + "CHECK(parentTypeCode IS NULL OR parentTypeCode<>code)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_reference_data_type_option_parent_sort "
                + "ON ReferenceDataType(optionSetCode,parentTypeCode,status,sortnum,id)");
        jdbcTemplate.execute("COMMENT ON COLUMN ReferenceDataType.code IS '类型记录的唯一公开编码'");
        jdbcTemplate.execute("COMMENT ON COLUMN ReferenceDataType.optionSetCode IS '多个页面或Window控件可共享的选项组code'");
        jdbcTemplate.execute("COMMENT ON COLUMN ReferenceDataType.valueCode IS '控件提交给业务接口的稳定类型值'");
        jdbcTemplate.execute("COMMENT ON COLUMN ReferenceDataType.parentTypeCode IS '同一选项组内的上级类型code，顶级为空'");
    }

    /**
     * 物理删除职责错误的 TREE 类型，并先解除可能存在的子类型父级关系。
     * 真实传参示例：类型表包含 {@code type101000/valueCode=TREE}，其他菜单类型可能引用其 code。
     * 真实返回示例：TREE 记录被删除，引用它的菜单类型改为顶级，ReferenceDataTreeNode 数据保持不变。
     * 异常或副作用示例：数据库更新失败时初始化整体失败；只删除 valueCode 精确等于 TREE 的类型记录。
     *
     * @param dataSource 当前 reference-data 私有数据源
     */
    private void removeMisclassifiedTreeTypes(DataSource dataSource) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        List<String> treeTypeCodes = jdbcTemplate.queryForList(
                "SELECT code FROM ReferenceDataType WHERE UPPER(valueCode)='TREE' ORDER BY id",
                String.class);
        for (String treeTypeCode : treeTypeCodes) {
            // 子类型仍是有效菜单分类，只解除错误的 TREE 父级，不做级联删除。
            jdbcTemplate.update(
                    "UPDATE ReferenceDataType SET parentTypeCode=NULL WHERE parentTypeCode=?",
                    treeTypeCode);
            jdbcTemplate.update(
                    "DELETE FROM ReferenceDataType WHERE code=? AND UPPER(valueCode)='TREE'",
                    treeTypeCode);
        }
    }

    /**
     * 为旧树节点回填唯一可确认的工程和页面归属，并收紧最终非空结构。
     * 真实传参示例：旧库有四条树节点，页面控件唯一坐标为
     *     {@code reference-data/page101017}。
     * 真实返回示例：四条记录均获得相同 projectCode、pageCode，树的 code 和 parentId 保持不变。
     * 异常或副作用示例：旧节点缺少归属且数据库中不存在唯一页面坐标时阻断启动，禁止猜测来源。
     *
     * @param dataSource 当前 reference-data 私有数据源
     */
    private void migrateReferenceDataTreeNodeOwnership(DataSource dataSource) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        Long missingOwnershipCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataTreeNode "
                        + "WHERE projectCode IS NULL OR TRIM(projectCode)='' "
                        + "OR pageCode IS NULL OR TRIM(pageCode)=''",
                Long.class);
        if (missingOwnershipCount != null && missingOwnershipCount > 0L) {
            List<Map<String, Object>> pages = jdbcTemplate.queryForList(
                    "SELECT DISTINCT projectCode,pageCode FROM ReferenceDataControlLayout "
                            + "WHERE controlKind='PAGE' AND status<>0 ORDER BY projectCode,pageCode");
            if (pages.size() != 1) {
                throw new IllegalStateException(
                        "ReferenceDataTreeNode 旧数据无法唯一确认工程和页面归属：" + pages);
            }
            Map<String, Object> page = pages.get(0);
            jdbcTemplate.update(
                    "UPDATE ReferenceDataTreeNode SET projectCode=?,pageCode=? "
                            + "WHERE projectCode IS NULL OR TRIM(projectCode)='' "
                            + "OR pageCode IS NULL OR TRIM(pageCode)=''",
                    page.get("projectCode"), page.get("pageCode"));
        }
        jdbcTemplate.execute("ALTER TABLE ReferenceDataTreeNode ALTER COLUMN projectCode SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataTreeNode ALTER COLUMN pageCode SET NOT NULL");
    }

    /**
     * 把同一页面物理 Grid 的历史多条表格定义合并为一条，并保留全部子元素。
     * 真实传参示例：旧库包含六条表格定义和分别归属六个 tableId 的 51 条元素。
     * 真实返回示例：保留 ReferenceDataTable 视图父记录，全部元素改挂该 id 并写入六种 viewCode。
     * 异常或副作用示例：存在未知 dataTableName 或页面内没有可选保留记录时阻断启动，不删除任何父记录。
     *
     * @param dataSource 当前 reference-data 私有数据源
     */
    private void migrateReferenceDataSingleGrid(DataSource dataSource) {
        JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
        // 旧字段仍存在表示尚未完成单 Grid 合并；新库和已迁移库直接验证最终非空约束。
        Integer legacyColumnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='PUBLIC' "
                        + "AND TABLE_NAME='ReferenceDataTable' AND COLUMN_NAME='dataTableName'",
                Integer.class);
        if (legacyColumnCount != null && legacyColumnCount > 0) {
            List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                    "SELECT id,pageCode,dataTableName FROM ReferenceDataTable ORDER BY id");
            // 每个页面分别选择 TABLE 视图记录作为保留父级；缺少时稳定回退该页最小 id。
            Map<String, Long> survivorByPage = new java.util.LinkedHashMap<>();
            for (Map<String, Object> table : tables) {
                String pageCode = String.valueOf(table.get("pageCode"));
                long tableId = ((Number) table.get("id")).longValue();
                survivorByPage.putIfAbsent(pageCode, tableId);
                if ("ReferenceDataTable".equals(String.valueOf(table.get("dataTableName")))) {
                    survivorByPage.put(pageCode, tableId);
                }
            }
            Map<String, String> viewCodes = Map.of(
                    "ReferenceDataType", "TYPE",
                    "ReferenceDataTreeNode", "TREE",
                    "ReferenceDataControlLayout", "CONTROL",
                    "ReferenceDataWindow", "WINDOW",
                    "ReferenceDataTable", "TABLE",
                    "ReferenceDataTableElement", "TABLE_ELEMENT");
            // 所有旧来源必须先映射为明确视图，禁止删除父记录后留下无法识别的列配置。
            for (Map<String, Object> table : tables) {
                String dataTableName = String.valueOf(table.get("dataTableName"));
                String viewCode = viewCodes.get(dataTableName);
                if (viewCode == null) {
                    throw new IllegalStateException("ReferenceDataTable 存在未知数据视图：" + dataTableName);
                }
                long oldTableId = ((Number) table.get("id")).longValue();
                String pageCode = String.valueOf(table.get("pageCode"));
                Long survivorId = survivorByPage.get(pageCode);
                if (survivorId == null) {
                    throw new IllegalStateException("ReferenceDataTable 页面缺少保留记录：" + pageCode);
                }
                // 第一阶段只写视图；若此处同时改 tableId，后续处理保留父级时会误覆盖已迁入元素的 viewCode。
                jdbcTemplate.update(
                        "UPDATE ReferenceDataTableElement SET viewCode=? WHERE tableId=?",
                        viewCode, oldTableId);
            }
            // 第二阶段在全部元素都已固化原来源视图后统一迁移外键，避免保留 tableId 的处理顺序污染视图。
            for (Map<String, Object> table : tables) {
                long oldTableId = ((Number) table.get("id")).longValue();
                String pageCode = String.valueOf(table.get("pageCode"));
                Long survivorId = survivorByPage.get(pageCode);
                jdbcTemplate.update(
                        "UPDATE ReferenceDataTableElement SET tableId=? WHERE tableId=?",
                        survivorId, oldTableId);
                jdbcTemplate.update(
                        "UPDATE ReferenceDataControlLayout SET tableId=? WHERE tableId=?",
                        survivorId, oldTableId);
            }
            // 保留记录成为页面唯一物理 Grid，其余父记录在全部外键迁移后删除。
            survivorByPage.forEach((pageCode, survivorId) -> {
                jdbcTemplate.update(
                        "UPDATE ReferenceDataTable SET gridId='selGridReferenceDataManagementId',"
                                + "nameZh='引用数据工作台表格',description='引用数据工作台唯一公共 Grid' WHERE id=?",
                        survivorId);
                jdbcTemplate.update("DELETE FROM ReferenceDataTable WHERE pageCode=? AND id<>?", pageCode, survivorId);
            });
            jdbcTemplate.execute("ALTER TABLE ReferenceDataTable DROP COLUMN dataTableName");
        }
        // 最终结构只接受真实 Grid ID 和六种明确视图，重复启动保持幂等。
        jdbcTemplate.execute("ALTER TABLE ReferenceDataTable ALTER COLUMN gridId SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataTableElement ALTER COLUMN viewCode SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataTable ADD CONSTRAINT IF NOT EXISTS "
                + "uk_reference_data_table_page_grid UNIQUE(tenantId,pageCode,gridId)");
        jdbcTemplate.execute("ALTER TABLE ReferenceDataTableElement ADD CONSTRAINT IF NOT EXISTS "
                + "ck_reference_data_table_element_view CHECK(viewCode IN "
                + "('TYPE','TREE','CONTROL','WINDOW','TABLE','TABLE_ELEMENT'))");
    }
}
