package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.common.db.config.CommonDbSource;
import com.sp.selplat.common.db.config.DatabaseType;
import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.db.dao.BaseTemplateDao;
import com.sp.selplat.common.db.dialect.DatabaseDialectFactory;
import com.sp.selplat.common.db.domain.CommonDynamicQuery;
import com.sp.selplat.common.db.domain.QueryCondition;
import com.sp.selplat.common.db.domain.QueryOperator;
import com.sp.selplat.common.db.domain.QueryOrder;
import com.sp.selplat.common.db.domain.QueryOrderDirection;
import com.sp.selplat.common.db.metadata.DatabaseMetadataReader;
import com.sp.selplat.common.db.metadata.DefaultDatabaseMetadataReader;
import com.sp.selplat.common.db.query.CommonQueryExecutor;
import com.sp.selplat.common.db.query.CommonQuerySqlBuilder;
import com.sp.selplat.common.db.query.CommonQueryValidator;
import com.sp.selplat.common.db.query.DefaultCommonQueryExecutor;
import com.sp.selplat.common.db.query.DefaultCommonQuerySqlBuilder;
import com.sp.selplat.common.db.query.DefaultCommonQueryValidator;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserSaveIn;
import com.sp.selplat.uniauth.user.domain.out.UniauthUserItemOut;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.stereotype.Repository;

// 用户 DAO 实现同时桥接 BaseDao 通用模板能力和业务 XML 自定义 SQL。
@Repository
public class UniauthUserDaoImpl extends BaseDao implements UniauthUserDao {

    // XML 命名空间统一绑定到当前 DAO 接口，保证实现类调用 statement 时和业务目录结构保持一致。
    private static final String XML_NAMESPACE = "com.sp.selplat.uniauth.user.dao.UniauthUserDao";
    // USER_SELECT_FIELDS 固定声明正式读取接口允许返回的字段，避免通用查询退化成不受控的 select *。
    private static final List<String> USER_SELECT_FIELDS = buildUserSelectFields();
    // 用户自定义 XML 查询统一通过 SqlSessionTemplate 调度，避免再暴露独立 Mapper Bean。
    private final SqlSessionTemplate sqlSessionTemplate;
    // dataSource 承接当前 Spring 工程装配好的真实数据源，供通用查询链路构建数据源实体和获取 JDBC 连接。
    private final DataSource dataSource;
    // commonQueryExecutor 承接结构化查询执行链路，供当前 DAO 把正式读取接口切到 common-db 默认实现。
    private final CommonQueryExecutor commonQueryExecutor;

    // 创建用户 DAO 实现时同时注入公共模板 DAO 和 MyBatis 会话模板，保证模板查询与 XML SQL 都由同一个实现类承接。
    public UniauthUserDaoImpl(
        BaseTemplateDao baseTemplateDao,
        SqlSessionTemplate sqlSessionTemplate,
        DataSource dataSource
    ) {
        // 先把公共模板 Mapper 交给父类保存，供 BaseDao#getList 等通用能力复用。
        super(baseTemplateDao);
        // 保存 MyBatis 会话模板，供当前 DAO 直接按 statement 名称调用业务 XML SQL。
        this.sqlSessionTemplate = sqlSessionTemplate;
        // 保存真实数据源，供通用查询读取链路按当前工程配置命中正确数据库连接。
        this.dataSource = dataSource;
        // 创建 JDBC 元数据读取器，供通用查询在运行期按真实表结构校验字段合法性。
        DatabaseMetadataReader metadataReader = new DefaultDatabaseMetadataReader();
        // 创建默认查询校验器，保证动态字段、条件和排序都受真实表结构约束。
        CommonQueryValidator queryValidator = new DefaultCommonQueryValidator(metadataReader);
        // 创建方言工厂，供 SQL 构建阶段按数据库类型统一分发分页和 like 规则。
        DatabaseDialectFactory dialectFactory = new DatabaseDialectFactory();
        // 创建 SQL 构建器，负责把结构化查询对象翻译成受控 SQL 和参数列表。
        CommonQuerySqlBuilder querySqlBuilder = new DefaultCommonQuerySqlBuilder(queryValidator, dialectFactory);
        // 创建通用查询执行器，供正式读取接口直接复用 common-db 默认查询链路。
        this.commonQueryExecutor = new DefaultCommonQueryExecutor(querySqlBuilder);
    }

    // 返回 ua_user 物理表名，供公共模板查询和写入统一命中用户主表。
    @Override
    protected String getTableName() {
        return "ua_user";
    }

    // 返回 ua_user 的主键列名，供公共更新和删除模板按唯一标识命中目标记录。
    @Override
    protected String getIdColumn() {
        return "id";
    }

    // 返回 store 兼容接口默认读取的列清单，保证前端列表能拿到主表核心字段。
    @Override
    protected String getSelectColumns() {
        return """
            id,
            tenantId,
            loginName,
            displayName,
            displayNameKana,
            locale,
            email,
            phone,
            userStatus,
            lockedFlag,
            expiredAt,
            createdAt,
            updatedAt
            """;
    }

    // store 查询把用户查询对象转换成模板 where 条件后再复用 BaseDao 的等值列表能力。
    @Override
    public List<Map<String, Object>> getStoreList(UniauthUserIn queryIn) {
        // 先把业务查询对象转换成受控字段映射，避免服务层直接接触数据库列名。
        Map<String, Object> queryColumnValueMap = buildStoreQueryColumnValueMap(queryIn);
        // 固定按主键倒序返回，保持旧式 store 列表和当前 XML 列表默认顺序一致。
        return getList(queryColumnValueMap, "id DESC");
    }

    // 把用户查询对象转换成模板 DAO 认识的字段和值映射，供通用等值查询复用。
    private Map<String, Object> buildStoreQueryColumnValueMap(UniauthUserIn queryIn) {
        // 使用有序映射承接受控查询字段，保证调试输出和模板 SQL 展开顺序稳定。
        Map<String, Object> queryColumnValueMap = new LinkedHashMap<>();
        // 查询对象为空时直接返回空条件，让 store 兼容接口回落为全量列表。
        if (queryIn == null) {
            return queryColumnValueMap;
        }
        // tenantId 属于主表等值字段，可直接走模板等值查询。
        if (queryIn.getTenantId() != null) {
            queryColumnValueMap.put("tenantId", queryIn.getTenantId());
        }
        // loginName 在模板场景先按等值匹配处理，保证简单条件可以直接复用公共模板。
        if (hasText(queryIn.getLoginName())) {
            queryColumnValueMap.put("loginName", queryIn.getLoginName().trim());
        }
        // displayName 在模板场景先按等值匹配处理，保证简单条件可以直接复用公共模板。
        if (hasText(queryIn.getDisplayName())) {
            queryColumnValueMap.put("displayName", queryIn.getDisplayName().trim());
        }
        // userStatus 属于主表等值字段，可直接走模板等值查询。
        if (hasText(queryIn.getUserStatus())) {
            queryColumnValueMap.put("userStatus", queryIn.getUserStatus().trim());
        }
        // lockedFlag 属于布尔等值字段，可直接走模板等值查询。
        if (queryIn.getLockedFlag() != null) {
            queryColumnValueMap.put("lockedFlag", queryIn.getLockedFlag());
        }
        return queryColumnValueMap;
    }

    // 文本有值判断统一收口，避免字段映射过程中重复手写 trim 判空逻辑。
    private boolean hasText(String value) {
        // 空值或空白字符串都不应进入模板 where 条件，避免误生成空条件。
        return value != null && !value.trim().isEmpty();
    }

    //====================================================

    // 正式列表接口直接走 common-db 通用查询链路，保证 like 检索和组合筛选改由结构化查询统一控制。
    @Override
    public List<UniauthUserItemOut> selectUserList(UniauthUserIn query) {
        // 先把用户列表查询对象转换成通用结构化查询，供 common-db 默认实现统一做字段校验和 SQL 生成。
        CommonDynamicQuery commonQuery = buildUserListQuery(query);
        // 执行结构化列表查询，返回键值结果后再映射成正式用户输出对象。
        List<Map<String, Object>> rowList = commonQueryExecutor.query(commonQuery);
        // 把通用查询结果逐行映射成正式输出对象，保持控制层返回结构不变。
        return mapUserItemOutList(rowList);
    }

    // 正式详情接口直接走 common-db 通用查询链路，保证详情回显和删除前校验复用统一字段校验与映射规则。
    @Override
    public UniauthUserItemOut selectUserById(Long id) {
        // 先按主键构建正式详情查询对象，保证单条详情读取也复用统一的通用查询链路。
        CommonDynamicQuery commonQuery = buildSingleUserQuery("id", QueryOperator.EQ, id);
        // 执行单行查询并返回当前账号结果，不存在时按空结果返回给服务层做统一判空。
        return mapUserItemOut(commonQueryExecutor.queryOne(commonQuery));
    }

    // 登录名唯一性查询直接走 common-db 通用查询链路，保证新增和更新共用同一套唯一性校验口径。
    @Override
    public UniauthUserItemOut selectUserByLoginName(String loginName) {
        // 登录名为空时没有必要继续命中数据库，直接返回空结果给服务层走后续业务判断。
        if (!hasText(loginName)) {
            return null;
        }
        // 先按登录名构建正式唯一性查询对象，保证账号回查和列表查询共用统一校验与 SQL 生成链路。
        CommonDynamicQuery commonQuery = buildSingleUserQuery(
            "loginName",
            QueryOperator.EQ,
            loginName.trim()
        );
        // 执行单行查询并返回当前账号结果，不存在时按空结果返回给服务层做唯一性判断。
        return mapUserItemOut(commonQueryExecutor.queryOne(commonQuery));
    }

    // 新增接口直接转调业务 XML statement，并通过参数映射把保存对象和密码哈希一并交给 MyBatis 执行写入。
    @Override
    public int insertUser(UniauthUserSaveIn in, String passwordHash) {
        // 使用有序映射显式组织 XML 所需参数，保证 in 和 passwordHash 名称与现有 SQL 占位符完全一致。
        Map<String, Object> parameterMap = new LinkedHashMap<>();
        // 保存对象承接账号主表字段和值，供 XML 新增 SQL 统一读取。
        parameterMap.put("in", in);
        // 密码哈希单独传入，供 XML 直接写入与实体同名的 passwordHash 列。
        parameterMap.put("passwordHash", passwordHash);
        // 返回新增影响行数，并让 XML 继续负责数据库主键回填。
        return sqlSessionTemplate.insert(statement("insertUser"), parameterMap);
    }

    // 更新接口直接转调业务 XML statement，并通过参数映射把保存对象和可选密码哈希交给 MyBatis 执行覆盖。
    @Override
    public int updateUser(UniauthUserSaveIn in, String passwordHash) {
        // 使用有序映射显式组织 XML 所需参数，保证更新 SQL 继续按 in 和 passwordHash 读取业务值。
        Map<String, Object> parameterMap = new LinkedHashMap<>();
        // 保存对象承接要覆盖的账号字段和值，供 XML 更新 SQL 统一读取。
        parameterMap.put("in", in);
        // 密码哈希允许为空字符串，供 XML 判断本次是否需要覆盖密码字段。
        parameterMap.put("passwordHash", passwordHash);
        // 返回更新影响行数，供服务层继续沿用现有更新结果控制流程。
        return sqlSessionTemplate.update(statement("updateUser"), parameterMap);
    }

    // 删除接口直接转调业务 XML statement，保证正式删除口径仍由业务 XML 控制。
    @Override
    public int deleteUserById(Long id) {
        // 把用户主键作为单参数传入 XML，命中按主键删除的正式 SQL。
        return sqlSessionTemplate.delete(statement("deleteUserById"), id);
    }

    // XML statement 名称统一在 DAO 内部拼接，避免业务方法散落硬编码 namespace 字符串。
    private String statement(String statementId) {
        // 命名空间和 statementId 用点号拼接，形成 SqlSessionTemplate 可直接执行的完整 statement 名称。
        return XML_NAMESPACE + "." + statementId;
    }

    // 正式列表查询统一把业务筛选对象转换成通用结构化查询，供 common-db 默认实现按真实表结构执行。
    private CommonDynamicQuery buildUserListQuery(UniauthUserIn queryIn) {
        // 创建通用查询对象，准备承接数据源、表名、字段、条件、排序和可选分页信息。
        CommonDynamicQuery commonQuery = new CommonDynamicQuery();
        // 当前查询固定命中当前工程装配的数据源实体，保证通用查询使用真实业务数据库连接。
        commonQuery.setDataSource(buildCommonDbSource());
        // 当前列表固定查询 ua_user 主表，保持正式读取接口目标表稳定可控。
        commonQuery.setTableName(getTableName());
        // 当前列表只返回正式输出对象需要的字段，避免把密码摘要等敏感列暴露给读取接口。
        commonQuery.setSelectFields(USER_SELECT_FIELDS);
        // 当前列表把业务查询对象转换成结构化条件集合，供通用查询统一生成 where 子句。
        commonQuery.setConditions(buildUserListConditions(queryIn));
        // 当前列表固定按主键倒序输出，保持与原 XML 列表接口一致的默认展示顺序。
        commonQuery.setOrders(buildDefaultOrders());
        // 只有调用方显式使用非默认分页参数时才启用分页，避免现有全量列表语义被默认页参改变。
        if (shouldApplyPaging(queryIn)) {
            commonQuery.setPageNo(queryIn.getPageNo());
            commonQuery.setPageSize(queryIn.getPageSize());
        }
        // 返回完整结构化查询对象，供执行器继续完成校验、SQL 构建和 JDBC 执行。
        return commonQuery;
    }

    // 单条用户读取统一收口成一条结构化查询，供详情和唯一性校验复用同一套正式读取链路。
    private CommonDynamicQuery buildSingleUserQuery(
        String fieldName,
        QueryOperator operator,
        Object value
    ) {
        // 创建通用查询对象，准备承接当前单条回查所需的数据源、字段和条件信息。
        CommonDynamicQuery commonQuery = new CommonDynamicQuery();
        // 当前单条回查固定命中当前工程装配的数据源实体，保证查询来源和列表链路一致。
        commonQuery.setDataSource(buildCommonDbSource());
        // 当前单条回查固定查询 ua_user 主表，避免详情和唯一性检查越过业务表边界。
        commonQuery.setTableName(getTableName());
        // 当前单条回查继续沿用正式输出字段清单，保持详情和列表的返回口径一致。
        commonQuery.setSelectFields(USER_SELECT_FIELDS);
        // 当前单条回查只需要一个精确条件即可定位目标用户，统一交给结构化条件对象承接。
        commonQuery.setConditions(Collections.singletonList(buildCondition(fieldName, operator, value)));
        // 当前单条回查仍按主键倒序声明默认排序，保证生成的 SQL 在方言层保持稳定。
        commonQuery.setOrders(buildDefaultOrders());
        // 返回完整单条读取查询对象，供执行器统一执行并映射成正式输出对象。
        return commonQuery;
    }

    // 业务列表筛选统一转换成结构化条件集合，供通用查询链路按字段白名单生成正式 where 子句。
    private List<QueryCondition> buildUserListConditions(UniauthUserIn queryIn) {
        // 创建条件集合承接当前列表接口允许使用的业务筛选项，保持筛选字段显式可控。
        List<QueryCondition> conditions = new ArrayList<>();
        // 查询对象为空时直接返回空条件集合，让正式列表接口回落为默认排序的全量读取。
        if (queryIn == null) {
            return conditions;
        }
        // tenantId 属于精确筛选字段，直接转换成等值条件，供租户级账号列表使用。
        if (queryIn.getTenantId() != null) {
            conditions.add(buildCondition("tenantId", QueryOperator.EQ, queryIn.getTenantId()));
        }
        // loginName 在正式列表里按模糊检索处理，保持与原 XML 列表接口一致的账号关键字搜索语义。
        if (hasText(queryIn.getLoginName())) {
            conditions.add(buildCondition("loginName", QueryOperator.LIKE, queryIn.getLoginName().trim()));
        }
        // displayName 在正式列表里按模糊检索处理，保持与原 XML 列表接口一致的显示名搜索语义。
        if (hasText(queryIn.getDisplayName())) {
            conditions.add(buildCondition("displayName", QueryOperator.LIKE, queryIn.getDisplayName().trim()));
        }
        // userStatus 属于精确筛选字段，直接转换成等值条件，供状态过滤场景使用。
        if (hasText(queryIn.getUserStatus())) {
            conditions.add(buildCondition("userStatus", QueryOperator.EQ, queryIn.getUserStatus().trim()));
        }
        // lockedFlag 属于布尔精确筛选字段，直接转换成等值条件，供锁定状态过滤使用。
        if (queryIn.getLockedFlag() != null) {
            conditions.add(buildCondition("lockedFlag", QueryOperator.EQ, queryIn.getLockedFlag()));
        }
        // 返回结构化条件集合，供通用查询链路统一校验字段合法性并生成 SQL。
        return conditions;
    }

    // 默认排序统一收口成结构化对象，供通用查询链路安全生成 order by 片段。
    private List<QueryOrder> buildDefaultOrders() {
        // 创建排序对象承接正式列表和单条回查的默认主键倒序规则。
        QueryOrder order = new QueryOrder();
        // 当前默认排序字段固定为主键 id，保持与原 XML 列表接口一致的顺序语义。
        order.setFieldName("id");
        // 当前默认排序方向固定为倒序，保证新账号或大主键账号优先出现在列表前面。
        order.setDirection(QueryOrderDirection.DESC);
        // 返回只包含一个排序项的不可变列表，供通用查询链路直接复用。
        return Collections.singletonList(order);
    }

    // 单个结构化条件对象统一收口，避免不同查询方法重复写字段、操作符和值的装配代码。
    private QueryCondition buildCondition(String fieldName, QueryOperator operator, Object value) {
        // 创建条件对象承接当前字段筛选规则，供通用查询校验器和 SQL 构建器统一消费。
        QueryCondition condition = new QueryCondition();
        // 写入当前条件命中的字段名，保证后续 where 子句围绕受控业务字段生成。
        condition.setFieldName(fieldName);
        // 写入当前条件的比较操作符，供 SQL 构建器选择等值或模糊等正式语法。
        condition.setOperator(operator);
        // 写入当前条件的实际比较值，供 PreparedStatement 在执行阶段安全绑定参数。
        condition.setValue(value);
        // 返回完整结构化条件对象，结束当前筛选项的参数装配过程。
        return condition;
    }

    // 当前工程数据源统一包装成 CommonDbSource，供 common-db 默认实现获知连接来源和数据库类型。
    private CommonDbSource buildCommonDbSource() {
        // 创建通用数据源实体，准备承接当前真实数据源和连接上下文信息。
        CommonDbSource commonDbSource = new CommonDbSource();
        // 当前示例固定使用主数据源标识，便于后续日志和多数据源扩展识别当前连接来源。
        commonDbSource.setSourceKey("main");
        // 把 Spring 已装配好的真实数据源对象写入通用实体，供执行器和元数据读取器直接获取连接。
        commonDbSource.setDataSource(dataSource);
        // 通过真实连接读取数据库类型和连接上下文，保证方言选择来自当前工程实际配置。
        try (Connection connection = dataSource.getConnection()) {
            // 根据数据库产品名称识别数据库类型，供 SQL 构建阶段选择正确方言实现。
            commonDbSource.setDatabaseType(resolveDatabaseType(connection));
            // 把当前连接命中的 catalog 写入通用实体，供元数据读取器后续精确定位目标库。
            commonDbSource.setCatalogName(connection.getCatalog());
            // 把当前连接命中的 schema 写入通用实体，供元数据读取器后续精确定位目标对象。
            commonDbSource.setSchemaName(connection.getSchema());
        } catch (SQLException exception) {
            // 无法从当前工程数据源读取连接上下文时直接中止，避免通用查询在未知数据库类型下继续执行。
            throw new IllegalStateException("无法从当前数据源构建 CommonDbSource", exception);
        }
        // 返回完整通用数据源实体，供结构化查询对象继续携带到执行链路。
        return commonDbSource;
    }

    // 真实数据库类型识别统一收口，避免在不同查询方法里散落数据库产品名判断逻辑。
    private DatabaseType resolveDatabaseType(Connection connection) throws SQLException {
        // 读取当前连接的数据库产品名称，作为数据库类型分发的唯一输入。
        String productName = connection.getMetaData().getDatabaseProductName();
        // H2 产品名命中时返回 H2 方言，兼容当前 uniauth 默认内存库启动场景。
        if (productName != null && productName.toUpperCase().contains("H2")) {
            return DatabaseType.H2;
        }
        // MySQL 产品名命中时返回 MySQL 方言，兼容后续真实业务库迁移场景。
        if (productName != null && productName.toUpperCase().contains("MYSQL")) {
            return DatabaseType.MYSQL;
        }
        // SQL Server 产品名命中时返回 SQL Server 方言，兼容微软数据库生态下的部署场景。
        if (productName != null && productName.toUpperCase().contains("SQL SERVER")) {
            return DatabaseType.SQLSERVER;
        }
        // Oracle 产品名命中时返回 Oracle 方言，兼容传统企业数据库场景。
        if (productName != null && productName.toUpperCase().contains("ORACLE")) {
            return DatabaseType.ORACLE;
        }
        // PostgreSQL 产品名命中时返回 PostgreSQL 方言，兼容 PostgreSQL 生态部署场景。
        if (productName != null && productName.toUpperCase().contains("POSTGRESQL")) {
            return DatabaseType.POSTGRESQL;
        }
        // 未命中的数据库产品直接拒绝继续处理，避免在未知方言下拼接出错误 SQL。
        throw new IllegalArgumentException("不支持的数据库产品类型: " + productName);
    }

    // 通用查询结果列表统一映射成正式输出对象集合，保持控制层和服务层仍然面向明确的业务模型编程。
    private List<UniauthUserItemOut> mapUserItemOutList(List<Map<String, Object>> rowList) {
        // 创建输出集合承接逐行映射后的正式用户对象，保持返回顺序和数据库结果顺序一致。
        List<UniauthUserItemOut> userItemOutList = new ArrayList<>();
        // 通用查询没有返回任何行时直接返回空集合，避免上层继续处理空指针。
        if (rowList == null || rowList.isEmpty()) {
            return userItemOutList;
        }
        // 逐行把键值结果映射成正式输出对象，保证控制层返回结构仍然稳定。
        for (Map<String, Object> rowMap : rowList) {
            // 把当前结果行转换成正式输出对象后加入列表，供控制层统一序列化返回。
            userItemOutList.add(mapUserItemOut(rowMap));
        }
        // 返回正式输出对象集合，结束当前列表映射流程。
        return userItemOutList;
    }

    // 单行通用查询结果统一映射成正式输出对象，保持详情和唯一性校验继续使用明确业务模型。
    private UniauthUserItemOut mapUserItemOut(Map<String, Object> rowMap) {
        // 查询结果为空时直接返回空对象，供服务层继续沿用现有判空和业务异常处理逻辑。
        if (rowMap == null || rowMap.isEmpty()) {
            return null;
        }
        // 创建正式输出对象，准备承接通用查询返回的各字段值。
        UniauthUserItemOut userItemOut = new UniauthUserItemOut();
        // 把主键字段映射成 Long，保证服务层后续更新、删除和冲突判断仍可稳定使用主键。
        userItemOut.setId(toLong(rowMap.get("id")));
        // 把租户主键映射成 Long，保证返回对象能表达当前账号归属哪个租户。
        userItemOut.setTenantId(toLong(rowMap.get("tenantId")));
        // 把登录账号映射成字符串，保证控制层返回和唯一性校验都使用统一登录名字段。
        userItemOut.setLoginName(toStringValue(rowMap.get("loginName")));
        // 把显示姓名映射成字符串，保证列表和详情都能稳定展示用户名称。
        userItemOut.setDisplayName(toStringValue(rowMap.get("displayName")));
        // 把假名显示姓名映射成字符串，兼容日语环境下的姓名展示与回显场景。
        userItemOut.setDisplayNameKana(toStringValue(rowMap.get("displayNameKana")));
        // 把语言区域映射成字符串，保证前端可以读取当前账号默认语言。
        userItemOut.setLocale(toStringValue(rowMap.get("locale")));
        // 把邮箱映射成字符串，保证详情和列表都能读取账号联系信息。
        userItemOut.setEmail(toStringValue(rowMap.get("email")));
        // 把电话映射成字符串，保证详情和列表都能读取账号联系电话。
        userItemOut.setPhone(toStringValue(rowMap.get("phone")));
        // 把账号状态映射成字符串，保证前端可按正式字段读取当前账号状态。
        userItemOut.setUserStatus(toStringValue(rowMap.get("userStatus")));
        // 把锁定标记映射成布尔值，保证服务层和前端读取到统一的锁定状态语义。
        userItemOut.setLockedFlag(toBoolean(rowMap.get("lockedFlag")));
        // 把到期时间映射成 LocalDateTime，保证时间字段返回口径与原 XML 结果映射一致。
        userItemOut.setExpiredAt(toLocalDateTime(rowMap.get("expiredAt")));
        // 把创建时间映射成 LocalDateTime，保证列表和详情都能稳定读取主表创建时间。
        userItemOut.setCreatedAt(toLocalDateTime(rowMap.get("createdAt")));
        // 把更新时间映射成 LocalDateTime，保证列表和详情都能稳定读取主表最后更新时间。
        userItemOut.setUpdatedAt(toLocalDateTime(rowMap.get("updatedAt")));
        // 返回正式输出对象，结束当前结果行到业务模型的映射过程。
        return userItemOut;
    }

    // Long 类型转换统一收口，避免不同字段映射时重复处理 Number 和字符串两类来源。
    private Long toLong(Object value) {
        // 空值直接映射成 null，保持数据库空值与业务空值语义一致。
        if (value == null) {
            return null;
        }
        // JDBC 常见数值结果优先按 Number 转 Long，避免多余的字符串转换损耗。
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        // 其余情况回退按字符串解析 Long，兼容部分驱动返回字符型主键值的场景。
        return Long.valueOf(String.valueOf(value));
    }

    // 字符串转换统一收口，避免字段映射时重复写 String.valueOf 及空值判断逻辑。
    private String toStringValue(Object value) {
        // 空值直接映射成 null，保持数据库空值与业务空值语义一致。
        if (value == null) {
            return null;
        }
        // 其余值统一按字符串输出，兼容 JDBC 返回字符型和其他基础类型值。
        return String.valueOf(value);
    }

    // 布尔转换统一收口，避免不同数据库驱动对布尔列返回类型差异影响业务映射。
    private Boolean toBoolean(Object value) {
        // 空值直接映射成 null，保持数据库空值与业务空值语义一致。
        if (value == null) {
            return null;
        }
        // 驱动直接返回布尔值时原样返回，保持最小转换成本。
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        // 驱动返回数值型布尔标记时，统一按非零即真转换成业务布尔值。
        if (value instanceof Number) {
            return ((Number) value).intValue() != 0;
        }
        // 其余情况回退按字符串解析布尔值，兼容驱动返回 true/false 文本的场景。
        return Boolean.valueOf(String.valueOf(value));
    }

    // 时间转换统一收口，避免不同数据库驱动对时间列返回类型差异影响业务映射。
    private LocalDateTime toLocalDateTime(Object value) {
        // 空值直接映射成 null，保持数据库空值与业务空值语义一致。
        if (value == null) {
            return null;
        }
        // 驱动已经返回 LocalDateTime 时原样返回，避免重复做时间类型转换。
        if (value instanceof LocalDateTime) {
            return (LocalDateTime) value;
        }
        // 驱动返回 Timestamp 时统一转成 LocalDateTime，保持和实体字段类型一致。
        if (value instanceof Timestamp) {
            return ((Timestamp) value).toLocalDateTime();
        }
        // 其余类型当前不做隐式时间解析，直接报错以避免悄悄生成错误时间值。
        throw new IllegalArgumentException("无法转换为 LocalDateTime: " + value.getClass().getName());
    }

    // 正式用户读取字段清单统一收口成固定列表，便于列表、详情和唯一性校验复用同一套返回字段口径。
    private static List<String> buildUserSelectFields() {
        // 创建字段列表承接正式用户读取允许返回的字段，避免不同方法散落手写列名。
        List<String> selectFields = new ArrayList<>();
        // 返回主键字段，供详情、更新和删除链路稳定识别目标用户。
        selectFields.add("id");
        // 返回租户主键字段，供前端和服务层识别用户归属租户。
        selectFields.add("tenantId");
        // 返回登录账号字段，供详情展示和唯一性校验结果回读。
        selectFields.add("loginName");
        // 返回显示姓名字段，供列表和详情直接展示用户名称。
        selectFields.add("displayName");
        // 返回假名显示姓名字段，兼容日语环境下的人名展示。
        selectFields.add("displayNameKana");
        // 返回语言区域字段，供前端读取当前账号默认语言。
        selectFields.add("locale");
        // 返回邮箱字段，供详情和列表读取联系信息。
        selectFields.add("email");
        // 返回电话字段，供详情和列表读取联系电话。
        selectFields.add("phone");
        // 返回账号状态字段，供前端按正式字段判断账号状态。
        selectFields.add("userStatus");
        // 返回锁定标记字段，供前端和服务层识别当前账号是否已锁定。
        selectFields.add("lockedFlag");
        // 返回到期时间字段，供详情和列表读取账号失效时间。
        selectFields.add("expiredAt");
        // 返回创建时间字段，供前端展示账号创建时间。
        selectFields.add("createdAt");
        // 返回更新时间字段，供前端展示账号最近更新时间。
        selectFields.add("updatedAt");
        // 返回不可变字段列表，避免运行期意外改写正式读取字段口径。
        return Collections.unmodifiableList(selectFields);
    }

    // 是否启用分页统一收口，避免列表接口因为 Page 默认值而意外改变现有全量查询语义。
    private boolean shouldApplyPaging(UniauthUserIn queryIn) {
        // 查询对象为空时无法携带显式分页意图，当前列表保持全量读取语义。
        if (queryIn == null) {
            return false;
        }
        // 只有调用方传入非默认页码时，才说明当前列表明确要求按页查询。
        if (queryIn.getPageNo() != null && queryIn.getPageNo() != 1) {
            return true;
        }
        // 只有调用方传入非默认页大小时，才说明当前列表明确要求分页截断结果集。
        return queryIn.getPageSize() != null && queryIn.getPageSize() != 20;
    }
}
