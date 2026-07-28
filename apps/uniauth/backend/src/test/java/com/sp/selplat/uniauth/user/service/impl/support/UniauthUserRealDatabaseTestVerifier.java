package com.sp.selplat.uniauth.user.service.impl.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.support.CommonHashSupport;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.uniauth.user.dao.UniauthUserDao;
import com.sp.selplat.uniauth.user.service.impl.UniauthUserServiceImpl;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 用户真实数据库验证器集中承接调用参数、数据库期待查询和断言，让每个测试方法只表达一个 Case 验证动作。
 */
public final class UniauthUserRealDatabaseTestVerifier {

    /**
     * 验证器只提供静态 Case 入口，禁止创建无业务状态的辅助对象。
     */
    private UniauthUserRealDatabaseTestVerifier() {
    }

    /**
     * 验证用户 Service 通过 BaseServiceImpl 泛型绑定 DAO 并继承默认 CRUD，业务类不重复保存公共依赖。
     */
    public static void verifyServiceDaoAccessStructure() {
        // 读取用户 Service 的直接泛型父类，确认 DAO 类型在继承入口一次性声明。
        Type genericSuperclass = UniauthUserServiceImpl.class.getGenericSuperclass();
        // 业务 Service 必须保留可解析的参数化父类，Spring 才能按泛型选择正确 DAO。
        assertTrue(genericSuperclass instanceof ParameterizedType);
        // 解析父类唯一 DAO 泛型参数，验证它精确绑定 UniauthUserDao。
        Type daoType = ((ParameterizedType) genericSuperclass).getActualTypeArguments()[0];
        // getDao() 的运行期依赖必须是用户 DAO 接口，不得退化成具体实现或原始 BaseDao。
        assertEquals(UniauthUserDao.class, daoType);
        // 遍历业务 Service 自身字段，确认 DAO 依赖已经完全下沉到基础类。
        for (Field field : UniauthUserServiceImpl.class.getDeclaredFields()) {
            // 业务 Service 不得再声明 UniauthUserDao 或其他 BaseDao 类型字段。
            assertFalse(UniauthUserDao.class.isAssignableFrom(field.getType()));
            // 公共发号器必须由 BaseExtendsServiceImpl 统一保存，业务 Service 不得重复声明。
            assertFalse(SequenceGenerator.class.isAssignableFrom(field.getType()));
        }
        // Java 会为无显式构造函数的类生成一个零参数构造入口，当前结构只允许这一种。
        Constructor<?>[] constructors = UniauthUserServiceImpl.class.getDeclaredConstructors();
        // 删除业务依赖构造函数后只能保留一个默认构造入口。
        assertEquals(1, constructors.length);
        // 默认构造入口不得接收 DAO、发号器或其他业务依赖参数。
        assertEquals(0, constructors[0].getParameterCount());
    }

    /**
     * 验证 getStore 默认排序同时匹配服务返回、数据库期待顺序、总数和分页回参。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyGetStoreDefaultSortnum(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        // 当前 Case 使用第一页三条记录，确保 fixture 中全部排序样本进入同一页。
        CommonPageParam queryIn = pageParam(1, 3);
        // 通过真实生产服务执行默认分页查询。
        CommonPageResult pageResult = userService.getStore(queryIn);
        // 从真实数据库独立读取 sortnum 倒序结果，作为服务返回之外的期待证据。
        List<String> expectedLoginNames = jdbcTemplate.queryForList(
            "SELECT loginName FROM UniauthUser ORDER BY sortnum DESC",
            String.class
        );
        // 服务结果必须与数据库独立期待查询完全一致。
        assertEquals(expectedLoginNames, loginNames(pageResult));
        // 判别性 fixture 的固定顺序保证实现不能退化成 id 排序。
        assertEquals(List.of("sort-high", "sort-middle", "sort-low"), loginNames(pageResult));
        // 真实 count SQL 必须返回当前 Case 的三条记录。
        assertEquals(3L, pageResult.getTotalCount());
        // 分页结果必须回填调用方实际请求的第一页。
        assertEquals(1, pageResult.getPageNo());
        // 分页结果必须回填调用方实际请求的三条页大小。
        assertEquals(3, pageResult.getPageSize());
    }

    /**
     * 验证 getStore 的 Like 条件进入真实 SQL 且命中项继续按默认排序返回。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyGetStoreFilter(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        // 当前筛选 Case 一页最多读取十条，避免分页截断两个命中样本。
        CommonPageParam queryIn = pageParam(1, 10);
        // Like 后缀表达登录名模糊查询，直接模拟前端动态参数。
        queryIn.putParam("loginNameLike", "alpha");
        // 通过真实生产服务执行带筛选条件的分页查询。
        CommonPageResult pageResult = userService.getStore(queryIn);
        // 数据库独立期待查询验证模糊条件和排序均来自真实表状态。
        List<String> expectedLoginNames = jdbcTemplate.queryForList(
            "SELECT loginName FROM UniauthUser WHERE loginName LIKE '%alpha%' ORDER BY sortnum DESC",
            String.class
        );
        // 服务返回必须与数据库独立期待查询的两条命中记录一致。
        assertEquals(expectedLoginNames, loginNames(pageResult));
        // 未匹配 beta 的记录不得进入真实服务返回。
        assertEquals(List.of("alpha-high", "alpha-low"), loginNames(pageResult));
        // 筛选后的真实总数必须只统计两个 alpha 用户。
        assertEquals(2L, pageResult.getTotalCount());
    }

    /**
     * 验证 getStore 请求空页时列表和总数仍保持正确分页语义。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     */
    public static void verifyGetStoreEmptyPage(UniauthUserService userService) {
        // 当前 Case 请求第三页且每页一条，明确越过 fixture 的最后一页。
        CommonPageResult pageResult = userService.getStore(pageParam(3, 1));
        // 越界页不得返回其他页或初始化数据。
        assertTrue(pageResult.getRecords().isEmpty());
        // 空页仍必须通过真实 count SQL返回两条总数。
        assertEquals(2L, pageResult.getTotalCount());
        // 返回页码必须保留调用方请求的第三页。
        assertEquals(3, pageResult.getPageNo());
        // 返回页大小必须保留调用方请求的一条。
        assertEquals(1, pageResult.getPageSize());
    }

    /**
     * 验证 getById 使用数字主键命中真实用户详情。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyGetByIdFoundNumber(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        // 数字 id 直接模拟常规 JSON 数字主键。
        CommonResult result = userService.getById(param("id", 2101L));
        // 读取共通结果中的真实用户字段映射。
        Map<?, ?> userRecord = resultData(result);
        // 服务返回主键必须与 fixture 和数据库记录一致。
        assertEquals(2101L, ((Number) userRecord.get("id")).longValue());
        // 服务返回账号必须来自当前 getById Case。
        assertEquals("detail-number", userRecord.get("loginName"));
        // 数据库独立查询确认当前主键真实存在且账号一致。
        assertEquals(
            "detail-number",
            jdbcTemplate.queryForObject("SELECT loginName FROM UniauthUser WHERE id = 2101", String.class)
        );
        // 详情服务必须使用统一成功结果。
        assertTrue(result.isSuccess());
    }

    /**
     * 验证 getById 能把前端字符串主键通过同一个 CommonParam 交给真实 DAO 并命中详情。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyGetByIdFoundString(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        // 字符串 id 模拟表单或查询字符串进入 CommonParam 的常见前端形态。
        CommonResult result = userService.getById(param("id", "2102"));
        // 读取共通结果中的真实用户字段映射。
        Map<?, ?> userRecord = resultData(result);
        // 字符串主键由真实数据库参数绑定能力处理后必须命中 2102 对应记录。
        assertEquals(2102L, ((Number) userRecord.get("id")).longValue());
        // 服务结果和数据库独立查询必须返回同一账号。
        assertEquals(
            jdbcTemplate.queryForObject("SELECT loginName FROM UniauthUser WHERE id = 2102", String.class),
            userRecord.get("loginName")
        );
    }

    /**
     * 验证 getById 在真实表中未命中记录时返回明确异常。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     */
    public static void verifyGetByIdNotFound(UniauthUserService userService) {
        // 不存在 Case 固定查询 2199，当前 fixture 已保证用户表为空。
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> userService.getById(param("id", 2199L))
        );
        // 未命中统一使用公共 Service 的数据不存在提示，不再携带应用专属名词。
        assertTrue(exception.getMessage().contains("未找到对应的数据"));
    }

    /**
     * 验证 getById 缺少主键时在进入数据库前拒绝请求。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     */
    public static void verifyGetByIdMissingId(UniauthUserService userService) {
        // 空 CommonParam 不包含任何主键字段，应命中业务必填校验。
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> userService.getById(new CommonParam())
        );
        // 空参数由 DAO 门面按未命中返回，父类 Service 统一使用数据不存在提示。
        assertTrue(exception.getMessage().contains("未找到对应的数据"));
    }

    /**
     * 验证 getById 收到空参数对象时仍按主键缺失规则稳定失败。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     */
    public static void verifyGetByIdNullInput(UniauthUserService userService) {
        // null 模拟控制层极端场景下没有创建 CommonParam。
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> userService.getById(null)
        );
        // 空对象与空字段必须使用同一公共数据不存在提示。
        assertTrue(exception.getMessage().contains("未找到对应的数据"));
    }

    /**
     * 验证 getById 非法字符串主键直接进入真实 DAO 后仍不能形成错误成功结果。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     */
    public static void verifyGetByIdInvalidId(UniauthUserService userService) {
        // 非数字字符串模拟前端提交了数据库主键类型无法接受的 id。
        RuntimeException exception = assertThrows(
            RuntimeException.class,
            () -> userService.getById(param("id", "invalid-id"))
        );
        // 当前阶段不在 Service 重建类型验证，真实数据库参数错误必须沿调用链明确抛出。
        assertNotNull(exception.getMessage());
    }

    /**
     * 验证 Service 批量查询通过真实 BaseDao 返回两条指定用户。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     */
    public static void verifyBatchGetByIds(UniauthUserService userService) {
        // 创建批量主键请求。
        CommonBatchParam queryIn = new CommonBatchParam();
        // 两项分别查询 fixture 中的真实用户。
        queryIn.getItems().add(param("id", 7101L));
        queryIn.getItems().add(param("id", 7102L));
        // 调用真实批量 Service 链路。
        CommonResult result = userService.getByIds(queryIn);
        // 批量查询必须返回成功和两条真实数据。
        assertTrue(result.isSuccess());
        assertEquals(2, ((List<?>) result.getData()).size());
    }

    /**
     * 验证批量新增逐项发号、摘要密码并真实写入用户表。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyBatchInsert(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        // 创建两名字段结构一致的批量新增用户。
        CommonBatchParam saveIn = new CommonBatchParam();
        saveIn.getItems().add(batchInsertItem("batch-insert-1", "批量新增一"));
        saveIn.getItems().add(batchInsertItem("batch-insert-2", "批量新增二"));
        // 调用真实事务批量新增。
        CommonResult result = userService.insertBatch(saveIn);
        // CommonResult.data 必须直接返回两项业务数据，不得为了影响行数再增加一层 Map。
        assertEquals(2, resultItems(result).size());
        // DAO 累计新增行数必须使用 CommonResult 顶层固定字段返回。
        assertEquals(2, result.getAffectedRows());
        assertEquals(2L, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM UniauthUser", Long.class));
        // 服务返回不得包含密码摘要。
        assertFalse(saveIn.getItems().get(0).getParamMap().containsKey("passwordHash"));
    }

    /**
     * 验证批量新增中任一用户违反真实唯一约束时，Service 事务不会留下部分成功数据。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyBatchInsertRollback(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        try {
            // 创建两个登录名相同的用户，让第二项通过数据库唯一约束稳定触发批处理失败。
            CommonBatchParam saveIn = new CommonBatchParam();
            // 第一项在 JDBC 批处理中本可正常写入，用于识别是否发生部分提交。
            saveIn.getItems().add(batchInsertItem("batch-rollback-duplicate", "回滚用户一"));
            // 第二项复用同一登录名，确保真实数据库拒绝整组批量新增。
            saveIn.getItems().add(batchInsertItem("batch-rollback-duplicate", "回滚用户二"));
            // 生产 Service 必须把数据库批处理异常向上抛出，不能伪装成成功结果。
            assertThrows(RuntimeException.class, () -> userService.insertBatch(saveIn));
            // 事务回滚后用户表必须仍为空，证明第一项没有形成部分成功。
            assertEquals(0L, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM UniauthUser", Long.class));
        } finally {
            // 当前 Case 主动关闭了测试外层事务，必须清理已提交的 fixture 号段，避免刷新上下文时重复初始化。
            jdbcTemplate.update("DELETE FROM UniauthUser");
            jdbcTemplate.update("DELETE FROM CommonSequenceSegment");
        }
    }

    /**
     * 验证批量更新支持不同字段结构，并保持密码安全转换。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyBatchUpdate(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        // 创建两条不同字段结构的批量更新请求。
        CommonBatchParam saveIn = new CommonBatchParam();
        // 第一条只更新展示名。
        CommonParam firstItem = param("id", 7201L);
        firstItem.putParam("displayName", "批量更新一");
        saveIn.getItems().add(firstItem);
        // 第二条同时更新展示名和密码。
        CommonParam secondItem = param("id", 7202L);
        secondItem.putParam("displayName", "批量更新二");
        secondItem.putParam("password", "batch-new-password");
        saveIn.getItems().add(secondItem);
        // 调用真实事务批量更新并核对直接返回的批量项数量。
        CommonResult result = userService.updateBatch(saveIn);
        assertEquals(2, resultItems(result).size());
        // DAO 累计更新行数必须与真实批量结果一致。
        assertEquals(2, result.getAffectedRows());
        // 独立数据库查询确认展示名和密码摘要。
        assertEquals("批量更新一", jdbcTemplate.queryForObject("SELECT displayName FROM UniauthUser WHERE id = 7201", String.class));
        assertEquals(
            CommonHashSupport.sha256("batch-new-password"),
            jdbcTemplate.queryForObject("SELECT passwordHash FROM UniauthUser WHERE id = 7202", String.class)
        );
    }

    /**
     * 验证批量删除只修改状态和审计字段，不物理删除用户。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyBatchDelete(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        // 创建两条批量假删除请求。
        CommonBatchParam deleteIn = new CommonBatchParam();
        // 第一条保存主键和审计用户。
        CommonParam firstItem = param("id", 7301L);
        firstItem.putParam("lastOperateUserId", 91L);
        deleteIn.getItems().add(firstItem);
        // 第二条保存另一主键和审计用户。
        CommonParam secondItem = param("id", 7302L);
        secondItem.putParam("lastOperateUserId", 92L);
        deleteIn.getItems().add(secondItem);
        // 调用真实事务批量假删除并核对直接返回的批量项数量。
        CommonResult result = userService.deleteBatch(deleteIn);
        assertEquals(2, resultItems(result).size());
        // DAO 累计假删除行数必须与真实数据库状态变化一致。
        assertEquals(2, result.getAffectedRows());
        // 两条记录必须保留且状态均为零。
        assertEquals(2L, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM UniauthUser", Long.class));
        assertEquals(2L, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM UniauthUser WHERE status = 0", Long.class));
    }

    /**
     * 验证 insert 使用真实号段、密码摘要和公共模板 SQL新增用户。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyInsertNormal(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        // 构造前端新增参数，只提供真实业务字段而不提供数据库主键或密码摘要。
        CommonParam saveIn = new CommonParam();
        // 租户字段满足用户主表归属约束。
        saveIn.putParam("tenantId", 3L);
        // 最近操作用户记录当前新增责任人。
        saveIn.putParam("lastOperateUserId", 9L);
        // 登录名唯一标识当前 insert Case。
        saveIn.putParam("loginName", "insert-real-user");
        // 明文密码只允许进入服务层，数据库不得保存该值。
        saveIn.putParam("password", "insert-secret");
        // 展示名满足正式 schema 的必填约束。
        saveIn.putParam("displayName", "真实新增用户");
        // 排序值形成新增记录的完整业务字段。
        saveIn.putParam("sortnum", 15);
        // 有效状态显式写入当前新增 Case。
        saveIn.putParam("status", 1);
        // 通过真实生产服务执行发号、摘要和新增 SQL。
        CommonResult result = userService.insert(saveIn);
        // 从服务结果读取真实发号器生成并回填的主键。
        long generatedId = ((Number) resultData(result).get("id")).longValue();
        // 按生成主键从真实数据库独立回查新增记录。
        Map<String, Object> databaseRecord = jdbcTemplate.queryForMap(
            "SELECT * FROM UniauthUser WHERE id = ?",
            generatedId
        );
        // 当前测试号段第一次生成的主键必须来自 fixture 配置的起点。
        assertEquals(310000L, generatedId);
        // 数据库账号必须与前端提交值一致。
        assertEquals("insert-real-user", databaseRecord.get("loginName"));
        // 数据库不得保存前端明文密码。
        assertNotEquals("insert-secret", databaseRecord.get("passwordHash"));
        // 数据库密码摘要必须与公共 SHA-256 口径一致。
        assertEquals(CommonHashSupport.sha256("insert-secret"), databaseRecord.get("passwordHash"));
        // 服务回参不得包含数据库密码摘要。
        assertFalse(resultData(result).containsKey("passwordHash"));
        // 服务回参不得继续包含前端明文密码。
        assertFalse(resultData(result).containsKey("password"));
        // 真实号段表必须在当前事务内推进一个完整步长。
        assertEquals(
            310010L,
            jdbcTemplate.queryForObject(
                "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'UniauthUserId'",
                Long.class
            )
        );
    }

    /**
     * 验证 update 未传密码时只更新前端提交字段并保留原摘要。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyUpdateWithoutPassword(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        // 构造普通资料更新参数并指定真实目标主键。
        CommonParam saveIn = param("id", 4101L);
        // 最近操作用户应随更新真实写入审计列。
        saveIn.putParam("lastOperateUserId", 19L);
        // 展示名是当前 Case 唯一需要修改的业务字段。
        saveIn.putParam("displayName", "更新后名称");
        // 通过真实生产服务执行公共主键更新。
        CommonResult result = userService.update(saveIn);
        // 从数据库独立读取更新后的核心字段。
        Map<String, Object> databaseRecord = jdbcTemplate.queryForMap(
            "SELECT displayName, passwordHash, lastOperateUserId FROM UniauthUser WHERE id = 4101"
        );
        // 展示名必须真实更新为前端提交值。
        assertEquals("更新后名称", databaseRecord.get("displayName"));
        // 未传 password 时原数据库摘要必须保持不变。
        assertEquals("original-password-hash", databaseRecord.get("passwordHash"));
        // 最近操作用户必须真实更新。
        assertEquals(19L, ((Number) databaseRecord.get("lastOperateUserId")).longValue());
        // 服务结果必须继续回显更新后的业务字段。
        assertEquals("更新后名称", resultData(result).get("displayName"));
    }

    /**
     * 验证 update 传入密码时转换摘要并从服务结果移除敏感字段。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifyUpdateWithPassword(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        // 构造密码更新参数并指定真实目标主键。
        CommonParam saveIn = param("id", 4102L);
        // 最近操作用户应随密码更新真实写入审计列。
        saveIn.putParam("lastOperateUserId", 20L);
        // 明文密码只在服务入口存在，DAO 接收摘要字段。
        saveIn.putParam("password", "updated-secret");
        // 通过真实生产服务执行密码转换和公共主键更新。
        CommonResult result = userService.update(saveIn);
        // 从数据库独立读取最终密码摘要。
        String passwordHash = jdbcTemplate.queryForObject(
            "SELECT passwordHash FROM UniauthUser WHERE id = 4102",
            String.class
        );
        // 新数据库摘要必须与前端明文不同。
        assertNotEquals("updated-secret", passwordHash);
        // 新数据库摘要必须符合公共 SHA-256 结果。
        assertEquals(CommonHashSupport.sha256("updated-secret"), passwordHash);
        // 服务回参不得包含数据库密码摘要。
        assertFalse(resultData(result).containsKey("passwordHash"));
        // 服务回参不得包含已消费的前端明文密码。
        assertFalse(resultData(result).containsKey("password"));
    }

    /**
     * 验证 delete 通过真实公共更新执行逻辑删除而不物理移除记录。
     *
     * @param userService Spring 注入并连接当前真实测试库的用户服务，例如 UniauthUserServiceImpl 实例
     * @param jdbcTemplate 连接当前 Case 真实 H2 数据库的查询模板，用于独立核对落库结果
     */
    public static void verifySoftDelete(UniauthUserService userService, JdbcTemplate jdbcTemplate) {
        // 构造逻辑删除参数并指定真实目标主键。
        CommonParam deleteIn = param("id", 5101L);
        // 最近操作用户用于验证删除审计字段真实落库。
        deleteIn.putParam("lastOperateUserId", 29L);
        // 通过真实生产服务执行公共逻辑删除。
        CommonResult result = userService.delete(deleteIn);
        // 从数据库独立读取逻辑删除后的状态和审计字段。
        Map<String, Object> databaseRecord = jdbcTemplate.queryForMap(
            "SELECT status, lastOperateUserId, updatedAt FROM UniauthUser WHERE id = 5101"
        );
        // 记录必须仍然存在且状态被更新为逻辑删除值。
        assertEquals(0, ((Number) databaseRecord.get("status")).intValue());
        // 最近操作用户必须保存当前删除责任人。
        assertEquals(29L, ((Number) databaseRecord.get("lastOperateUserId")).longValue());
        // 公共逻辑删除必须写入服务端更新时间。
        assertNotNull(databaseRecord.get("updatedAt"));
        // 服务结果必须直接使用 DAO 写回的同一参数映射。
        assertSame(deleteIn.getParamMap(), result.getData());
        // 服务结果必须明确回传逻辑删除状态。
        assertEquals(0, resultData(result).get("status"));
        // 数据库中目标记录数量保持一条，证明当前动作不是物理删除。
        assertEquals(
            1L,
            jdbcTemplate.queryForObject("SELECT COUNT(*) FROM UniauthUser WHERE id = 5101", Long.class)
        );
    }

    /**
     * 创建稳定分页参数，避免各个 Case 在测试方法中重复设置页码和页大小。
     *
     * @param pageNo 当前页码，例如 {@code 1}
     * @param pageSize 每页条数，例如 {@code 10}
     * @return 可进入生产服务的分页参数，例如 {@code {"pageNo":1,"pageSize":10,"paramMap":{}}}
     */
    private static CommonPageParam pageParam(int pageNo, int pageSize) {
        // 创建前端分页容器。
        CommonPageParam queryIn = new CommonPageParam();
        // 写入当前 Case 页码。
        queryIn.setPageNo(pageNo);
        // 写入当前 Case 页大小。
        queryIn.setPageSize(pageSize);
        // 返回可直接交给生产服务的分页参数。
        return queryIn;
    }

    /**
     * 创建包含一个动态字段的 CommonParam，供主键型 Case 保持统一输入形式。
     *
     * @param key 动态字段名，例如 {@code id}
     * @param value 字段值，例如 {@code 2101L}
     * @return 通用参数，例如 {@code {"paramMap":{"id":2101}}}
     */
    private static CommonParam param(String key, Object value) {
        // 创建前端通用参数容器。
        CommonParam input = new CommonParam();
        // 写入当前 Case 唯一的初始业务字段。
        input.putParam(key, value);
        // 返回可继续补字段或直接调用服务的参数。
        return input;
    }

    /**
     * 创建字段结构一致的批量新增用户参数，供真实 JDBC batch 使用。
     *
     * @param loginName 唯一登录名，例如 {@code batch-insert-1}
     * @param displayName 展示姓名，例如 {@code 批量新增一}
     * @return 完整新增项，例如
     *     {@code {"paramMap":{"tenantId":7,"loginName":"batch-insert-1","displayName":"批量新增一"}}
     */
    private static CommonParam batchInsertItem(String loginName, String displayName) {
        // 新建当前用户的动态前端参数。
        CommonParam saveItem = new CommonParam();
        // 写入满足正式表约束的业务字段。
        saveItem.putParam("tenantId", 7L);
        saveItem.putParam("lastOperateUserId", 7L);
        saveItem.putParam("loginName", loginName);
        saveItem.putParam("password", "batch-password");
        saveItem.putParam("displayName", displayName);
        saveItem.putParam("sortnum", 10);
        saveItem.putParam("status", 1);
        // 返回可直接进入批量 Service 的当前项。
        return saveItem;
    }

    /**
     * 从分页结果中只提取可识别业务顺序的登录名。
     *
     * @param pageResult 生产服务返回的真实分页结果
     * @return 登录名顺序，例如 {@code ["sort-high", "sort-middle", "sort-low"]}
     */
    private static List<String> loginNames(CommonPageResult pageResult) {
        // 按生产 SQL 返回顺序读取每条记录的 loginName。
        return pageResult.getRecords().stream()
            // 登录名统一转成字符串，避免具体数据库驱动类型干扰业务断言。
            .map(record -> String.valueOf(record.get("loginName")))
            // 收集完整当前页顺序供期待结果比较。
            .toList();
    }

    /**
     * 把共通结果中的用户数据统一转换成字段映射。
     *
     * @param result 生产服务返回的固定结果，例如
     *     {@code {"success":true,"data":{"id":2101,"loginName":"detail-number"}}
     * @return 用户字段映射，例如 {@code {"id":2101,"loginName":"detail-number"}}
     */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> resultData(CommonResult result) {
        // 每个真实业务 Case 都必须返回成功的共通结果。
        assertTrue(result.isSuccess());
        // 业务数据必须存在，避免只返回成功标记却丢失实际结果。
        assertNotNull(result.getData());
        // 当前用户服务统一返回字段映射，集中转换后供各 Case 读取。
        return (Map<String, Object>) result.getData();
    }

    /**
     * 从批量共通结果中读取直接返回的 items，禁止测试继续依赖历史 data 包装 Map。
     *
     * @param result 批量服务返回的固定结果，例如
     *     {@code {"success":true,"affectedRows":2,"data":[{"id":7101},{"id":7102}]}
     * @return 直接批量项，例如 {@code [{"id":7101},{"id":7102}]}
     */
    private static List<?> resultItems(CommonResult result) {
        // 批量业务也必须返回统一成功状态。
        assertTrue(result.isSuccess());
        // data 必须直接存在并承接批量项。
        assertNotNull(result.getData());
        // 固定批量结构要求 data 本身就是 List，出现 Map 说明业务层仍在二次包装。
        assertTrue(result.getData() instanceof List<?>);
        // 返回批量项供各个真实数据库 Case 核对数量和内容。
        return (List<?>) result.getData();
    }
}
