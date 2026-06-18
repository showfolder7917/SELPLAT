package com.sp.selplat.common.db.dao;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

// BaseDaoTest 验证公共 DAO 基类已经正确桥接 BaseTemplateDao，并能独立承接最常用 CRUD 场景。
class BaseDaoTest {

    // 种子数据 JSON 统一承接 demo_user 表的初始两条记录，保证每个测试都从一致状态出发。
    private static final String DEMO_TABLE_RESOURCE = "/com/sp/selplat/common/db/base-template-dao/input/demo-user.json";
    /**
     * 验证公共 BaseDao 可以基于模板 DAO 返回受控字段列表，供后台简单列表页直接复用。
     */
    @Test
    void shouldGetListUsingTemplateBackedBaseDao() throws Exception {
        // 基于统一种子数据创建隔离测试上下文，保证当前列表断言只验证公共 DAO 组装逻辑。
        try (BaseDaoTestSupport.BaseDaoTestContext context = BaseDaoTestSupport.createContext(DEMO_TABLE_RESOURCE)) {
            // 创建面向 demo_user 表的测试公共 DAO，模拟业务模块只配置表信息后直接复用公共方法。
            DemoUserBaseDao baseDao = new DemoUserBaseDao(context.mapper());
            // 只按启用状态构造等值筛选条件，验证公共 DAO 是否能正确桥接模板查询入参。
            Map<String, Object> queryColumnValueMap = new LinkedHashMap<>();
            queryColumnValueMap.put("user_status", "ACTIVE");
            // 从 JSON 资源读取期望列表，保证当前 BaseDao 查询仍与种子数据的真实业务口径保持一致。
            List<Map<String, Object>> expectedList = BaseDaoTestJsonUtils.readJsonResource(
                "/com/sp/selplat/common/db/base-template-dao/expect/select-list-by-query.json",
                new TypeReference<List<Map<String, Object>>>() {
                }
            );
            // 调用公共 DAO 的列表方法，验证表名、列清单、where 条件和排序是否能被统一桥接。
            List<Map<String, Object>> actualList = baseDao.getList(queryColumnValueMap, "id ASC");
            // 查询结果必须与 JSON 期望完全一致，证明公共 DAO 已能稳定复用模板查询链路。
            assertEquals(expectedList, actualList);
        }
    }

    /**
     * 验证公共 BaseDao 可以把字段映射写入目标表，供简单后台主数据直接复用通用新增能力。
     */
    @Test
    void shouldInsertUsingTemplateBackedBaseDao() throws Exception {
        // 基于统一种子数据创建隔离测试上下文，保证新增断言从固定初始状态出发。
        try (BaseDaoTestSupport.BaseDaoTestContext context = BaseDaoTestSupport.createContext(DEMO_TABLE_RESOURCE)) {
            // 创建面向 demo_user 表的测试公共 DAO，模拟业务模块在新增场景下调用公共基类。
            DemoUserBaseDao baseDao = new DemoUserBaseDao(context.mapper());
            // 构造新增字段映射，验证公共 DAO 是否能把业务字段桥接成模板新增入参。
            Map<String, Object> insertColumnValueMap = new LinkedHashMap<>();
            insertColumnValueMap.put("id", 3L);
            insertColumnValueMap.put("login_name", "auditor");
            insertColumnValueMap.put("display_name", "审计管理员");
            insertColumnValueMap.put("user_status", "ACTIVE");
            // 执行公共新增方法，把新用户写入当前测试数据库。
            int insertedRows = baseDao.insert(insertColumnValueMap);
            // 新增必须正好影响一行，证明公共 DAO 已成功命中目标表。
            assertEquals(1, insertedRows);

            // 读取新增后的期望结果，验证公共 DAO 落库后的数据库状态是否符合预期。
            Map<String, Object> expectedAfterInsert = BaseDaoTestJsonUtils.readJsonResource(
                "/com/sp/selplat/common/db/base-template-dao/expect/after-insert.json",
                new TypeReference<Map<String, Object>>() {
                }
            );
            // 通过公共 DAO 的受保护回查能力读取刚插入的记录，验证新增结果是否真实落库。
            Map<String, Object> actualAfterInsert = baseDao.getCurrentById(3L);
            // 回查结果必须与 JSON 期望完全一致，证明公共新增链路闭环正常。
            assertEquals(expectedAfterInsert, actualAfterInsert);
        }
    }

    /**
     * 验证公共 BaseDao 可以按主键更新目标记录，供简单后台编辑页直接复用通用更新能力。
     */
    @Test
    void shouldUpdateUsingTemplateBackedBaseDao() throws Exception {
        // 基于统一种子数据创建隔离测试上下文，保证更新断言从可预测的数据库状态开始。
        try (BaseDaoTestSupport.BaseDaoTestContext context = BaseDaoTestSupport.createContext(DEMO_TABLE_RESOURCE)) {
            // 创建面向 demo_user 表的测试公共 DAO，模拟业务模块在更新场景下调用公共基类。
            DemoUserBaseDao baseDao = new DemoUserBaseDao(context.mapper());
            // 先插入一条待更新记录，保证当前测试能独立验证更新链路而不依赖其他测试副作用。
            Map<String, Object> seedInsertColumnValueMap = new LinkedHashMap<>();
            seedInsertColumnValueMap.put("id", 3L);
            seedInsertColumnValueMap.put("login_name", "auditor");
            seedInsertColumnValueMap.put("display_name", "审计管理员");
            seedInsertColumnValueMap.put("user_status", "ACTIVE");
            // 把待更新记录先写入数据库，为后续 update 场景准备真实目标行。
            baseDao.insert(seedInsertColumnValueMap);

            // 构造待更新字段映射，验证公共 DAO 是否能把更新值桥接成模板 update 入参。
            Map<String, Object> updateColumnValueMap = new LinkedHashMap<>();
            updateColumnValueMap.put("display_name", "审计专员");
            updateColumnValueMap.put("user_status", "DISABLED");
            // 执行公共更新方法，把目标记录改成新的显示名和状态。
            int updatedRows = baseDao.update(3L, updateColumnValueMap);
            // 更新必须正好影响一行，证明公共 DAO 已按主键命中目标记录。
            assertEquals(1, updatedRows);

            // 读取更新后的期望结果，验证当前数据库最终状态是否符合业务预期。
            Map<String, Object> expectedAfterUpdate = BaseDaoTestJsonUtils.readJsonResource(
                "/com/sp/selplat/common/db/base-template-dao/expect/after-update.json",
                new TypeReference<Map<String, Object>>() {
                }
            );
            // 通过公共 DAO 回查更新后的记录，验证模板更新后的真实数据库结果。
            Map<String, Object> actualAfterUpdate = baseDao.getCurrentById(3L);
            // 更新后的记录必须与 JSON 期望完全一致，证明公共更新链路闭环正常。
            assertEquals(expectedAfterUpdate, actualAfterUpdate);
        }
    }

    /**
     * 验证公共 BaseDao 可以按主键删除目标记录，供简单后台删除操作直接复用通用删除能力。
     */
    @Test
    void shouldDeleteUsingTemplateBackedBaseDao() throws Exception {
        // 基于统一种子数据创建隔离测试上下文，保证删除断言从固定初始状态开始。
        try (BaseDaoTestSupport.BaseDaoTestContext context = BaseDaoTestSupport.createContext(DEMO_TABLE_RESOURCE)) {
            // 创建面向 demo_user 表的测试公共 DAO，模拟业务模块在删除场景下调用公共基类。
            DemoUserBaseDao baseDao = new DemoUserBaseDao(context.mapper());
            // 先插入一条待删除记录，保证删除测试能独立运行且不依赖其他测试写操作。
            Map<String, Object> seedInsertColumnValueMap = new LinkedHashMap<>();
            seedInsertColumnValueMap.put("id", 3L);
            seedInsertColumnValueMap.put("login_name", "tenant-admin");
            seedInsertColumnValueMap.put("display_name", "租户管理员");
            seedInsertColumnValueMap.put("user_status", "enabled");
            // 把待删除记录先写入数据库，为后续 del 场景准备真实目标行。
            baseDao.insert(seedInsertColumnValueMap);

            // 执行公共删除方法，验证公共 DAO 是否能把主键删除请求桥接到模板删除链路。
            int deletedRows = baseDao.del(3L);
            // 删除必须正好影响一行，证明公共 DAO 已按主键命中并清理目标记录。
            assertEquals(1, deletedRows);

            // 删除后再次按主键回查同一条记录，验证数据库里该目标行是否已经消失。
            Map<String, Object> actualAfterDelete = baseDao.getCurrentById(3L);
            // 删除后的主键回查必须为空，证明公共删除链路已经真实落库生效。
            assertNull(actualAfterDelete);
        }
    }

    // DemoUserBaseDao 用最小表信息配置模拟业务模块继承公共 DAO 后的实际使用方式。
    private static final class DemoUserBaseDao extends BaseDao {

        // 创建测试 DAO 时直接注入模板 DAO，保持和真实业务模块相同的桥接结构。
        private DemoUserBaseDao(BaseTemplateDao baseTemplateDao) {
            // 交给公共基类保存模板 DAO，供通用 CRUD 方法统一复用。
            super(baseTemplateDao);
        }

        // 返回当前测试 DAO 对应的物理表，供公共基类统一拼接模板入参。
        @Override
        protected String getTableName() {
            return "demo_user";
        }

        // 返回当前测试 DAO 的主键列名，供公共基类统一拼接更新和删除条件。
        @Override
        protected String getIdColumn() {
            return "id";
        }

        // 返回当前测试 DAO 默认读取的字段清单，供公共基类统一控制返回结构。
        @Override
        protected String getSelectColumns() {
            return "id, login_name, display_name, user_status";
        }

        // 对外暴露当前测试记录回查方法，方便测试方法直接验证增删改后的数据库状态。
        private Map<String, Object> getCurrentById(Long id) {
            // 复用公共基类的主键回查能力，避免测试侧重复拼接表信息和字段清单。
            return getById(id);
        }
    }
}
