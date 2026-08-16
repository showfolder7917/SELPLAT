package com.sp.selplat.referencedata.referencedatatype.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.service.sequence.SequenceGeneratorImpl;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.referencedatatype.dao.ReferenceDataTypeDao;
import com.sp.selplat.referencedata.referencedatatype.service.ReferenceDataTypeService;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

/**
 * 使用独立 H2 和正式 Spring 调用链覆盖引用数据的批量、校验、转换和数据库故障分支。
 * 现有 Controller 契约测试继续负责完整 CRUD，本类只补齐 JaCoCo 报告识别出的稳定边界。
 */
@SpringBootTest(
        classes = ReferenceDataCoverageRealDatabaseTest.TestApplication.class,
        properties = {
            "reference-data.datasource.jdbc-url=jdbc:h2:mem:reference_data_coverage_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false",
            "reference-data.datasource.pool-name=ReferenceDataCoverageTestPool",
            "spring.datasource.url=jdbc:h2:mem:reference_data_coverage_support_test;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_UPPER=false"
        })
@Import(SequenceGeneratorImpl.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ReferenceDataCoverageRealDatabaseTest {

    // service 通过真实 Spring 代理调用生产实现，批量方法使用正式事务和号段 DAO。
    @Autowired
    private ReferenceDataTypeService typeService;

    // typeDao 只验证 Service 不会自然传入的底层筛选和数据库故障边界。
    @Autowired
    private ReferenceDataTypeDao typeDao;

    // reference-data 专用模板既执行 fixture，也独立核对最终数据库状态。
    @Autowired
    @Qualifier("referenceDataJdbcTemplate")
    private JdbcTemplate jdbcTemplate;

    /**
     * 验证默认分页、分类筛选及类型批量新增、更新、删除均经过真实数据库。
     *
     * 执行结果示例：两条批量记录依次新增、更新和假删除，各阶段影响行数均为 {@code 2}。
     */
    @Test
    @Order(1)
    void shouldExecuteTypeBatchCrudAndQueryBranches() {
        verifyTypeBatchCrudAndQueryBranches();
    }

    /**
     * 验证空请求、非法主键、字段长度、审计 ID、状态、排序值和重复分类。
     *
     * 执行结果示例：非法状态返回 {@code REFERENCE_DATA_TYPE_STATUS_INVALID}，不会进入写入 SQL。
     */
    @Test
    @Order(2)
    void shouldRejectInvalidTypeInputs() {
        verifyInvalidTypeInputs();
    }

    /**
     * 验证真实类型表不可用时两个 DAO 扩展入口统一包装为系统异常。
     *
     * 执行结果示例：删除测试表后分页和坐标判断均返回 {@code REFERENCE_DATA_DATABASE_FAILED}。
     */
    @Test
    @Order(4)
    void shouldWrapTypeDatabaseFailures() {
        verifyTypeDatabaseFailures();
    }

    /**
     * 执行类型批量 CRUD、分页与分类分支的完整真实数据库验证。
     *
     * 执行结果示例：默认列表返回三条 fixture，批量新增、更新、删除分别影响两行。
     */
    private void verifyTypeBatchCrudAndQueryBranches() {
        applyFixture("shouldExecuteTypeBatchCrudAndQueryBranches");

        CommonPageResult defaultPage = typeService.getStore(null);
        assertEquals(3, defaultPage.getTotalCount());
        assertEquals(20, defaultPage.getPageSize());
        // 类型目录直接回显选项组和值，不再生成兼容 resourceKinds 字段。
        Map<String, Object> emptyKind = defaultPage.getRecords().stream()
                .filter(record -> "CONTEXT_MENU".equals(record.get("valueCode")))
                .findFirst()
                .orElseThrow();
        assertEquals("optionSet100000", emptyKind.get("optionSetCode"));
        assertEquals("type100001", emptyKind.get("parentTypeCode"));
        assertFalse(emptyKind.containsKey("resourceKinds"));

        CommonPageParam filteredQuery = new CommonPageParam();
        filteredQuery.putParam("codeLike", "type100002");
        filteredQuery.putParam("status", "1");
        CommonPageResult filteredPage = typeService.getStore(filteredQuery);
        assertEquals(1, filteredPage.getTotalCount());
        // code 与 parentTypeCode 分开查询，组合时只能使用 AND。
        CommonPageParam typeAndParent = pageParam("codeLike", "type100001");
        typeAndParent.putParam("parentTypeCodeLike", "type100001");
        assertEquals(0, typeService.getStore(typeAndParent).getTotalCount());
        // 精确 code 关系查询均走 BaseDao 字段白名单，不做 id 转换或 JOIN。
        assertEquals(1, typeService.getStore(pageParam("code", "type100001")).getTotalCount());
        assertEquals(3, typeService.getStore(pageParam("optionSetCode", "optionSet100000")).getTotalCount());
        assertEquals(1, typeService.getStore(pageParam("valueCode", "DROPDOWN")).getTotalCount());
        assertEquals(1, typeService.getStore(pageParam("parentTypeCode", "type100001")).getTotalCount());
        assertTrue(typeService.getById(idParam(100002)).isSuccess());

        CommonBatchParam insertBatch = batch(
                typeParam("GRID_MENU", "表格菜单", 1, "60"),
                typeParam("PANEL_MENU", "面板菜单", 2, ""));
        insertBatch.getItems().get(0).putParam("tenantId", 2);
        insertBatch.getItems().get(0).putParam("lastOperateUserId", 3);
        insertBatch.getItems().get(1).putParam("nameJa", " ");
        CommonResult insertResult = typeService.insertBatch(insertBatch);
        assertEquals(2, insertResult.getAffectedRows());
        assertEquals(2, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataType WHERE valueCode IN ('GRID_MENU','PANEL_MENU') "
                        + "AND tenantId = 1 AND lastOperateUserId = 1",
                Integer.class));
        assertEquals(0, typeService.insertBatch(new CommonBatchParam()).getAffectedRows());

        CommonBatchParam updateBatch = batch(
                typeParam("DROPDOWN", "下拉选项", 2, "85"),
                typeParam("CONTEXT_MENU", "上下文菜单", 1, "75"));
        updateBatch.getItems().get(0).putParam("id", 100002);
        updateBatch.getItems().get(1).putParam("id", 100003);
        assertEquals(2, typeService.updateBatch(updateBatch).getAffectedRows());
        assertEquals(0, typeService.updateBatch(new CommonBatchParam()).getAffectedRows());

        CommonParam singleUpdate = typeParam("DROPDOWN", "下拉框（单条更新）", 1, "86");
        singleUpdate.putParam("id", 100002);
        assertEquals("下拉框（单条更新）", ((Map<?, ?>) typeService.update(singleUpdate).getData()).get("nameZh"));

        assertEquals(2, typeService.deleteBatch(batch(idParam(100002), idParam(100003))).getAffectedRows());
        assertEquals(0, typeService.deleteBatch(new CommonBatchParam()).getAffectedRows());
        assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataType WHERE id IN (100002, 100003) AND status <> 0",
                Integer.class));
    }

    /**
     * 执行所有可由真实请求稳定制造的类型 Service 参数与业务错误验证。
     *
     * 执行结果示例：缺字段、非法数字和重复分类分别返回稳定错误编码；伪造身份被忽略。
     */
    private void verifyInvalidTypeInputs() {
        applyFixture("shouldRejectInvalidTypeInputs");

        assertEquals(4, typeService.getStore(new CommonPageParam()).getTotalCount());
        assertEquals(1, typeService.getStore(pageParam("status", "2")).getTotalCount());

        assertBusiness("REFERENCE_DATA_TYPE_ID_INVALID", () -> typeService.getById(null));
        assertBusiness("REFERENCE_DATA_TYPE_ID_INVALID", () -> typeService.getById(idParam("invalid")));
        assertBusiness("REFERENCE_DATA_TYPE_NOT_FOUND", () -> typeService.getById(idParam(0)));
        assertBusiness("REFERENCE_DATA_TYPE_NOT_FOUND", () -> typeService.getById(idParam(999999)));

        assertBusiness("REFERENCE_DATA_TYPE_FIELD_REQUIRED", () -> typeService.insert(null));
        CommonParam missingCategory = new CommonParam();
        missingCategory.putParam("nameZh", "缺少分类");
        assertBusiness("REFERENCE_DATA_TYPE_FIELD_REQUIRED", () -> typeService.insert(missingCategory));
        assertBusiness("REFERENCE_DATA_TYPE_FIELD_REQUIRED", () -> typeService.insert(typeParam(" ", "空分类", 1, "1")));
        assertBusiness("REFERENCE_DATA_TYPE_VALUE_RESERVED", () -> typeService.insert(typeParam("TREE", "树", 1, "1")));
        assertBusiness("REFERENCE_DATA_TYPE_FIELD_TOO_LONG", () -> typeService.insert(typeParam("PANEL_MENU", "中".repeat(121), 1, "1")));
        CommonParam longOptionalText = typeParam("PANEL_MENU", "可选字段过长", 1, "1");
        longOptionalText.putParam("nameEn", "e".repeat(121));
        assertBusiness("REFERENCE_DATA_TYPE_FIELD_TOO_LONG", () -> typeService.insert(longOptionalText));
        assertBusiness("REFERENCE_DATA_TYPE_STATUS_INVALID", () -> typeService.insert(typeParam("PANEL_MENU", "非法状态", 3, "1")));
        CommonParam invalidOptionSet = typeParam("UNKNOWN", "非法选项组", 1, "1");
        invalidOptionSet.putParam("optionSetCode", "missing999999");
        assertBusiness("REFERENCE_DATA_OPTION_SET_CODE_INVALID", () -> typeService.insert(invalidOptionSet));
        assertBusiness("REFERENCE_DATA_TYPE_NUMBER_INVALID", () -> typeService.insert(typeParam("PANEL_MENU", "文字状态", "invalid", "1")));
        assertBusiness("REFERENCE_DATA_TYPE_NUMBER_INVALID", () -> typeService.insert(typeParam("PANEL_MENU", "非法排序", 1, "invalid")));

        CommonParam forgedIdentity = typeParam("PANEL_MENU", "面板菜单", null, " ");
        forgedIdentity.putParam("tenantId", 0);
        forgedIdentity.putParam("lastOperateUserId", 0);
        forgedIdentity.putParam("nameEn", " ");
        assertTrue(typeService.insert(forgedIdentity).isSuccess());
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataType WHERE valueCode='PANEL_MENU' "
                        + "AND tenantId = 1 AND lastOperateUserId = 1 AND nameEn IS NULL",
                Integer.class));
        assertBusiness("REFERENCE_DATA_TYPE_ID_INVALID", () -> typeService.update(null));
        CommonParam missingUpdate = typeParam("PANEL_MENU", "不存在更新", 1, "1");
        missingUpdate.putParam("id", 999999);
        assertBusiness("REFERENCE_DATA_TYPE_NOT_FOUND", () -> typeService.update(missingUpdate));
        CommonParam duplicateUpdate = typeParam("DROPDOWN", "重复分类", 1, "1");
        duplicateUpdate.putParam("id", 100003);
        assertBusiness("REFERENCE_DATA_TYPE_DUPLICATE", () -> typeService.update(duplicateUpdate));
        assertBusiness("REFERENCE_DATA_TYPE_ID_INVALID", () -> typeService.delete(null));
        assertTrue(typeService.delete(idParam(100001)).isSuccess());
        assertTrue(typeService.delete(idParam(100002)).isSuccess());
        assertTrue(typeService.delete(idParam(100004)).isSuccess());
        assertEquals(1, typeService.deleteBatch(batch(idParam(100003))).getAffectedRows());

        assertBusiness("REFERENCE_DATA_TYPE_FIELD_REQUIRED", () -> typeService.insertBatch(null));
        assertBusiness("REFERENCE_DATA_TYPE_FIELD_REQUIRED", () -> typeService.updateBatch(null));
        assertBusiness("REFERENCE_DATA_TYPE_FIELD_REQUIRED", () -> typeService.deleteBatch(null));
    }

    /**
     * 删除隔离测试表后调用两个真实类型 DAO 入口，验证技术异常统一包装。
     *
     * 执行结果示例：两个调用均抛出 {@code REFERENCE_DATA_DATABASE_FAILED} 且 cause 非空。
     */
    private void verifyTypeDatabaseFailures() {
        applyFixture("shouldWrapTypeDatabaseFailures");
        jdbcTemplate.execute("DROP TABLE ReferenceDataType CASCADE");
        assertSystem(() -> typeDao.existsOptionSetValue(1L, "optionSet100000", "MENU_GROUP", null));
        assertSystem(() -> typeDao.findEnabledByCode("type100001"));
    }

    /**
     * 执行当前测试方法唯一归属的 SQL fixture。
     *
     * @param testMethodName 当前测试方法名，例如 {@code shouldRejectInvalidTypeInputs}
     * 执行结果示例：引用数据表恢复为当前 Case 明确声明的隔离数据。
     */
    private void applyFixture(String testMethodName) {
        String fixturePath = "fixtures/ReferenceDataCoverageRealDatabaseTest/" + testMethodName + ".sql";
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator();
        populator.addScript(new ClassPathResource(fixturePath));
        populator.execute(Objects.requireNonNull(jdbcTemplate.getDataSource()));
    }

    /**
     * 构造包含类型保存字段的真实公共参数。
     *
     * @param valueCode 类型值编码，例如 {@code MENU_GROUP}
     * @param nameZh 中文名称，例如 {@code 菜单组}
     * @param status 状态，例如 {@code 1}；省略时由 Service 使用默认启用状态
     * @param sortnum 排序值，例如 {@code 80}
     * @return 保存参数，例如 {@code {"optionSetCode":"optionSet100000","valueCode":"MENU_GROUP","status":1}}
     */
    private CommonParam typeParam(
            String valueCode,
            String nameZh,
            Object status,
            String sortnum) {
        CommonParam param = new CommonParam();
        param.putParam("optionSetCode", "optionSet100000");
        param.putParam("valueCode", valueCode);
        param.putParam("nameZh", nameZh);
        if (status != null) {
            param.putParam("status", status);
        }
        param.putParam("sortnum", sortnum);
        return param;
    }

    /**
     * 构造单主键公共参数。
     *
     * @param id 请求主键，例如 {@code 100002} 或非法边界 {@code invalid}
     * @return 主键参数，例如 {@code {"id":100002}}
     */
    private CommonParam idParam(Object id) {
        CommonParam param = new CommonParam();
        param.putParam("id", id);
        return param;
    }

    /**
     * 构造单字段分页参数。
     *
     * @param key 筛选字段，例如 {@code status}
     * @param value 筛选值，例如 {@code 2}
     * @return 分页参数，例如 {@code {"status":2,"pageNo":1,"pageSize":20}}
     */
    private CommonPageParam pageParam(String key, Object value) {
        CommonPageParam param = new CommonPageParam();
        param.putParam(key, value);
        return param;
    }

    /**
     * 按传入顺序构造批量公共参数。
     *
     * @param items 批量业务项，例如 {@code [{"id":100002},{"id":100003}]}
     * @return 保持原顺序的批量参数，例如 {@code {"items":[{"id":100002},{"id":100003}]}}
     */
    private CommonBatchParam batch(CommonParam... items) {
        CommonBatchParam batch = new CommonBatchParam();
        batch.setItems(Arrays.asList(items));
        return batch;
    }

    /**
     * 断言业务动作返回指定稳定错误编码。
     *
     * @param expectedCode 预期业务错误编码，例如 {@code REFERENCE_DATA_TYPE_NOT_FOUND}
     * @param action 触发真实 Service 校验的业务动作
     * 执行结果示例：动作抛出相同 errorCode 的 {@link CommonBusinessException}。
     */
    private void assertBusiness(String expectedCode, Runnable action) {
        CommonBusinessException exception = assertThrows(CommonBusinessException.class, action::run);
        assertEquals(expectedCode, exception.getErrorCode());
    }

    /**
     * 断言真实数据库故障被转换为统一系统异常并保留原始原因。
     *
     * @param action 访问已删除测试表的 DAO 动作
     * 执行结果示例：返回 {@code REFERENCE_DATA_DATABASE_FAILED} 且 cause 为 H2 数据访问异常。
     */
    private void assertSystem(Runnable action) {
        CommonSystemException exception = assertThrows(CommonSystemException.class, action::run);
        assertEquals("REFERENCE_DATA_DATABASE_FAILED", exception.getErrorCode());
        assertNotNull(exception.getCause());
    }

    /** 测试专用最小 Spring Boot 入口扫描 reference-data 与公共 Web 组件。 */
    @SpringBootApplication(scanBasePackages = {
        "com.sp.selplat.referencedata",
        "com.sp.selplat.common.web"
    })
    static class TestApplication {
    }
}
