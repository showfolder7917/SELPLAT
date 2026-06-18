package com.sp.selplat.common.db;

import com.fasterxml.jackson.core.type.TypeReference;
import com.sp.selplat.common.db.domain.CommonTemplateLikeQuery;
import com.sp.selplat.common.db.domain.CommonTemplateQuery;
import com.sp.selplat.common.db.domain.CommonTemplateSave;
import com.sp.selplat.common.db.domain.CommonTemplateUpdate;
import com.sp.selplat.common.db.support.BaseTemplateDaoTestJsonUtils;
import com.sp.selplat.common.db.support.BaseTemplateDaoTestSupport;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

// BaseTemplateDaoTest 使用 JSON 输入和期望结果验证公共模板的查询、新增、更新和删除链路。
class BaseTemplateDaoTest {

    // 种子数据 JSON 统一承接 demo_user 表的初始两条记录，保证每个测试都从一致状态出发。
    private static final String DEMO_TABLE_RESOURCE = "/com/sp/selplat/common/db/base-template-dao/input/demo-user.json";
    // 主键查询期望结果 JSON 单独收口，便于后续继续扩展更多场景而不污染测试代码。
    private static final String SELECT_BY_ID_EXPECT_RESOURCE = "/com/sp/selplat/common/db/base-template-dao/expect/select-by-id.json";
    // 等值查询入参 JSON 单独收口，保持测试条件和测试代码解耦。
    private static final String ACTIVE_QUERY_RESOURCE = "/com/sp/selplat/common/db/base-template-dao/input/active-query.json";
    // 等值查询列表期望结果 JSON 单独收口，方便后续调整输出结构。
    private static final String ACTIVE_LIST_EXPECT_RESOURCE = "/com/sp/selplat/common/db/base-template-dao/expect/select-list-by-query.json";
    // 模糊查询入参 JSON 单独收口，便于后续复用更多 like 场景。
    private static final String LIKE_QUERY_RESOURCE = "/com/sp/selplat/common/db/base-template-dao/input/display-name-like-query.json";
    // 模糊查询期望结果 JSON 单独收口，方便校验名称检索链路。
    private static final String LIKE_QUERY_EXPECT_RESOURCE = "/com/sp/selplat/common/db/base-template-dao/expect/select-list-by-like.json";
    // 新增入参 JSON 单独收口，保持新增模板验证完全由资源驱动。
    private static final String INSERT_RESOURCE = "/com/sp/selplat/common/db/base-template-dao/input/insert-user.json";
    // 新增后回查结果 JSON 单独收口，方便验证 insert 是否真实落库。
    private static final String AFTER_INSERT_EXPECT_RESOURCE = "/com/sp/selplat/common/db/base-template-dao/expect/after-insert.json";
    // 更新入参 JSON 单独收口，保持更新模板验证完全由资源驱动。
    private static final String UPDATE_RESOURCE = "/com/sp/selplat/common/db/base-template-dao/input/update-user.json";
    // 更新后回查结果 JSON 单独收口，方便验证 updateById 是否按主键覆盖字段。
    private static final String AFTER_UPDATE_EXPECT_RESOURCE = "/com/sp/selplat/common/db/base-template-dao/expect/after-update.json";

    /**
     * 验证公共模板可以按主键命中单条记录，并返回和 JSON 期望一致的业务字段。
     */
    @Test
    void shouldSelectByIdUsingJsonExpect() throws Exception {
        // 基于统一种子数据创建隔离测试上下文，确保当前断言不受其他测试写操作影响。
        try (BaseTemplateDaoTestSupport.BaseTemplateDaoTestContext context = BaseTemplateDaoTestSupport.createContext(DEMO_TABLE_RESOURCE)) {
            // 读取 JSON 里的期望结果，让主键查询断言完全由资源文件驱动。
            Map<String, Object> expected = BaseTemplateDaoTestJsonUtils.readJsonResource(
                SELECT_BY_ID_EXPECT_RESOURCE,
                new TypeReference<Map<String, Object>>() {
                }
            );
            // 调用公共模板的主键查询，验证动态表名、列清单和主键字段拼装是否正确。
            Map<String, Object> actual = context.mapper().selectById("demo_user", "id, login_name, display_name, user_status", "id", 1L);
            // 断言数据库实际返回和 JSON 期望完全一致，证明 selectById 模板链路可用。
            assertEquals(expected, actual);
        }
    }

    /**
     * 验证公共模板可以读取 JSON 等值查询入参，并同时正确返回列表结果和总数结果。
     */
    @Test
    void shouldSelectListAndCountByQueryUsingJsonInputAndExpect() throws Exception {
        // 基于统一种子数据创建隔离测试上下文，保证等值查询始终面对相同初始数据。
        try (BaseTemplateDaoTestSupport.BaseTemplateDaoTestContext context = BaseTemplateDaoTestSupport.createContext(DEMO_TABLE_RESOURCE)) {
            // 从 JSON 资源装载等值查询条件，让模板入参和测试场景保持文件化管理。
            CommonTemplateQuery query = BaseTemplateDaoTestJsonUtils.readJsonResource(ACTIVE_QUERY_RESOURCE, CommonTemplateQuery.class);
            // 从 JSON 资源装载期望列表，作为 selectListByQuery 的对照结果。
            List<Map<String, Object>> expectedList = BaseTemplateDaoTestJsonUtils.readJsonResource(
                ACTIVE_LIST_EXPECT_RESOURCE,
                new TypeReference<List<Map<String, Object>>>() {
                }
            );
            // 调用公共模板的等值查询列表方法，验证动态 where 条件和排序拼装是否正确。
            List<Map<String, Object>> actualList = context.mapper().selectListByQuery(query);
            // 调用公共模板的总数查询方法，验证等值条件在 count 模板里也能复用。
            long actualCount = context.mapper().selectCountByQuery(query);
            // 列表结果必须和 JSON 期望完全一致，证明公共模板读取字段和值映射后能稳定返回业务数据。
            assertEquals(expectedList, actualList);
            // 总数结果必须等于期望列表条数，证明 selectCountByQuery 和 selectListByQuery 条件口径一致。
            assertEquals(expectedList.size(), actualCount);
        }
    }

    /**
     * 验证公共模板可以读取 JSON 模糊查询入参，并按指定字段返回匹配列表。
     */
    @Test
    void shouldSelectListByLikeUsingJsonInputAndExpect() throws Exception {
        // 基于统一种子数据创建隔离测试上下文，保证 like 查询验证只关注模板本身。
        try (BaseTemplateDaoTestSupport.BaseTemplateDaoTestContext context = BaseTemplateDaoTestSupport.createContext(DEMO_TABLE_RESOURCE)) {
            // 从 JSON 资源装载模糊查询条件，验证模板入参可以完全通过文件驱动。
            CommonTemplateLikeQuery likeQuery = BaseTemplateDaoTestJsonUtils.readJsonResource(LIKE_QUERY_RESOURCE, CommonTemplateLikeQuery.class);
            // 从 JSON 资源装载模糊查询期望结果，作为 like 模板返回值的对照。
            List<Map<String, Object>> expectedList = BaseTemplateDaoTestJsonUtils.readJsonResource(
                LIKE_QUERY_EXPECT_RESOURCE,
                new TypeReference<List<Map<String, Object>>>() {
                }
            );
            // 调用公共模板的模糊查询方法，验证动态字段名和 like 关键字拼装是否正确。
            List<Map<String, Object>> actualList = context.mapper().selectListByLike(likeQuery);
            // 断言模糊查询结果和 JSON 期望一致，证明 selectListByLike 模板链路可用。
            assertEquals(expectedList, actualList);
        }
    }

    /**
     * 验证公共模板可以完成新增、更新和删除，并让每一步结果都和 JSON 期望保持一致。
     */
    @Test
    void shouldInsertUpdateAndDeleteUsingJsonInputAndExpect() throws Exception {
        // 基于统一种子数据创建隔离测试上下文，保证写操作验证从固定初始状态开始。
        try (BaseTemplateDaoTestSupport.BaseTemplateDaoTestContext context = BaseTemplateDaoTestSupport.createContext(DEMO_TABLE_RESOURCE)) {
            // 从 JSON 资源装载新增入参，验证 insert 模板的列值映射完全支持文件化驱动。
            CommonTemplateSave saveIn = BaseTemplateDaoTestJsonUtils.readJsonResource(INSERT_RESOURCE, CommonTemplateSave.class);
            // 调用公共模板新增方法，把测试资源定义的新用户写入数据库。
            int insertedRows = context.mapper().insert(saveIn);
            // 新增后必须正好影响一行，证明 insert 模板成功命中目标表。
            assertEquals(1, insertedRows);

            // 读取新增后的期望结果，验证刚插入的新用户字段和值是否准确落库。
            Map<String, Object> expectedAfterInsert = BaseTemplateDaoTestJsonUtils.readJsonResource(
                AFTER_INSERT_EXPECT_RESOURCE,
                new TypeReference<Map<String, Object>>() {
                }
            );
            // 通过主键回查新增结果，验证 insert 后数据库状态和 JSON 期望一致。
            Map<String, Object> actualAfterInsert = context.mapper().selectById("demo_user", "id, login_name, display_name, user_status", "id", 3L);
            // 断言新增后的单条记录和 JSON 期望完全一致，证明 insert 模板真实落库成功。
            assertEquals(expectedAfterInsert, actualAfterInsert);

            // 从 JSON 资源装载更新入参，验证 update 模板的主键和值映射也支持文件化驱动。
            CommonTemplateUpdate updateIn = BaseTemplateDaoTestJsonUtils.readJsonResource(UPDATE_RESOURCE, CommonTemplateUpdate.class);
            // 调用公共模板更新方法，把刚插入的新用户改成新的名称和状态。
            int updatedRows = context.mapper().updateById(updateIn);
            // 更新后必须正好影响一行，证明 updateById 模板按主键命中了目标记录。
            assertEquals(1, updatedRows);

            // 读取更新后的期望结果，验证更新后的字段和值是否符合资源定义。
            Map<String, Object> expectedAfterUpdate = BaseTemplateDaoTestJsonUtils.readJsonResource(
                AFTER_UPDATE_EXPECT_RESOURCE,
                new TypeReference<Map<String, Object>>() {
                }
            );
            // 通过主键回查更新结果，验证数据库最终状态是否和 JSON 期望一致。
            Map<String, Object> actualAfterUpdate = context.mapper().selectById("demo_user", "id, login_name, display_name, user_status", "id", 3L);
            // 断言更新后的记录和 JSON 期望完全一致，证明 update 模板生效正确。
            assertEquals(expectedAfterUpdate, actualAfterUpdate);

            // 调用公共模板删除方法，验证 deleteById 可以按主键清理刚刚写入的测试数据。
            int deletedRows = context.mapper().deleteById("demo_user", "id", 3L);
            // 删除后必须正好影响一行，证明 delete 模板按主键命中了目标记录。
            assertEquals(1, deletedRows);

            // 删除后再次按主键回查，结果应为空，证明 deleteById 已真实删除目标行。
            Map<String, Object> actualAfterDelete = context.mapper().selectById("demo_user", "id, login_name, display_name, user_status", "id", 3L);
            // 删除后的主键回查必须为空，证明 delete 模板链路闭环正常。
            assertEquals(null, actualAfterDelete);
        }
    }
}
