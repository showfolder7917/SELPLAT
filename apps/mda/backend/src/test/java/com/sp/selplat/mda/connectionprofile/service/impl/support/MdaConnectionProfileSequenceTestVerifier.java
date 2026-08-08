package com.sp.selplat.mda.connectionprofile.service.impl.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.mda.connectionprofile.dao.MdaConnectionProfileDao;
import com.sp.selplat.mda.connectionprofile.dao.MdaConnectionProfileDaoImpl;
import com.sp.selplat.mda.connectionprofile.service.MdaConnectionProfileService;
import com.sp.selplat.mda.connectionprofile.service.impl.MdaConnectionProfileServiceImpl;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * MDA 连接配置号段验证器集中构造真实 Service 入参，并以独立 SQL 核对最终控制库状态。
 * 验证器不使用 Mock、Stub 或预设 DAO 返回值。
 */
public final class MdaConnectionProfileSequenceTestVerifier {

    /**
     * 验证器没有跨 Case 状态，禁止创建无业务意义的实例。
     */
    private MdaConnectionProfileSequenceTestVerifier() {
    }

    /**
     * 验证单条与批量新增都从 MDA 项目号段连续取号，并通过公共 Base DAO 写入普通主键列。
     *
     * @param service Spring 注入且绑定隔离 MDA 控制库的真实连接配置 Service
     * @param jdbcTemplate 绑定同一隔离控制库的期待查询模板
     * 执行结果示例：单条返回 {@code id=100000}，批量返回 {@code [100001,100002]}，
     * 数据库号段游标推进到 {@code 101000}。
     */
    public static void verifySingleAndBatchInsert(
            MdaConnectionProfileService service,
            JdbcTemplate jdbcTemplate) {
        // 应用 DAO 接口恢复为 BaseDao 类型标记，不再声明 identity 专用写入方法。
        assertEquals(0, MdaConnectionProfileDao.class.getDeclaredMethods().length);
        assertEquals(0, MdaConnectionProfileDaoImpl.class.getDeclaredMethods().length);
        // 连接配置接口和实现都只绑定公共 Base CRUD，不再声明目标数据库运行方法或同义覆盖。
        assertEquals(0, MdaConnectionProfileService.class.getDeclaredMethods().length);
        assertEquals(0, MdaConnectionProfileServiceImpl.class.getDeclaredMethods().length);

        // 第一条页面连接参数 → 规范化后由 MdaConnectionProfileId 返回 100000。
        CommonResult singleResult = service.insert(connection("单条号段连接", "mem:mda_sequence_single"));
        Map<?, ?> singleRecord = (Map<?, ?>) singleResult.getData();
        assertTrue(singleResult.isSuccess());
        assertEquals(100000L, ((Number) singleRecord.get("id")).longValue());

        // 两条批量连接继续复用同一已领取号段 → 100001、100002，并执行一次真实 JDBC batch。
        CommonBatchParam batchParam = new CommonBatchParam();
        batchParam.setItems(List.of(
            connection("批量号段连接一", "mem:mda_sequence_batch_one"),
            connection("批量号段连接二", "mem:mda_sequence_batch_two")
        ));
        CommonResult batchResult = service.insertBatch(batchParam);
        List<?> batchRecords = (List<?>) batchResult.getData();
        assertTrue(batchResult.isSuccess());
        assertEquals(2, batchResult.getAffectedRows());
        assertEquals(100001L, id(batchRecords.get(0)));
        assertEquals(100002L, id(batchRecords.get(1)));

        // 数据库真实表状态必须包含三条新增记录，不能只相信 Service 返回对象。
        assertEquals(3L, jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM MdaConnectionProfile",
            Long.class
        ));
        // 首次领取一千个编号后，后续两次从 JVM 缓存发号，数据库游标只推进一次。
        assertEquals(101000L, jdbcTemplate.queryForObject(
            "SELECT nextStartId FROM CommonSequenceSegment WHERE seqCode = 'MdaConnectionProfileId'",
            Long.class
        ));
        assertEquals(1, jdbcTemplate.queryForObject(
            "SELECT versionNo FROM CommonSequenceSegment WHERE seqCode = 'MdaConnectionProfileId'",
            Integer.class
        ));
        // MdaConnectionProfile.id 已是普通 BIGINT 主键，数据库不再隐式生成业务 ID。
        assertEquals("NO", jdbcTemplate.queryForObject(
            "SELECT IS_IDENTITY FROM INFORMATION_SCHEMA.COLUMNS "
                + "WHERE TABLE_NAME = 'MdaConnectionProfile' AND COLUMN_NAME = 'id'",
            String.class
        ));
    }

    /**
     * 构造满足 MDA 真实表约束的页面连接字段。
     *
     * @param connectionName 页面显示的唯一连接名称，例如 {@code "单条号段连接"}
     * @param databaseName H2 测试目标库名称，例如 {@code "mem:mda_sequence_single"}
     * @return 可直接进入真实连接配置 Service 的参数，例如
     *     {@code {"connectionName":"单条号段连接","databaseType":"H2","databaseName":"mem:mda_sequence_single"}}
     */
    private static CommonParam connection(String connectionName, String databaseName) {
        CommonParam param = new CommonParam();
        param.putParam("connectionName", connectionName);
        param.putParam("databaseType", "H2");
        param.putParam("databaseName", databaseName);
        param.putParam("username", "sa");
        param.putParam("password", "");
        return param;
    }

    /**
     * 从批量返回项中读取号段生成的主键。
     *
     * @param record 公共批量结果中的连接字段映射，例如 {@code {"id":100001,"connectionName":"批量号段连接一"}}
     * @return 连接配置主键，例如 {@code 100001L}
     */
    private static long id(Object record) {
        return ((Number) ((CommonParam) record).getParam("id")).longValue();
    }
}
