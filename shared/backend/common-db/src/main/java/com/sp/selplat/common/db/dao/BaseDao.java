package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.sequence.model.IdSequenceDefinition;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageResult;
import java.util.List;
import java.util.Map;

/**
 * 声明简单单表模块唯一允许调用的公共 DAO 能力。
 * 接口负责固定分页、查询、写入和假删除契约，不暴露深层元数据、SQL 构建或模板执行细节。
 */
public interface BaseDao {

    /**
     * 按当前 DAO 表名和真实主键元数据生成各主键字段的独立号段编码。
     *
     * @return 单主键示例 {@code {"id":"UniauthUserId"}}；复合主键示例
     *     {@code {"tenantId":"UniauthUserTenantId","orderId":"UniauthUserOrderId"}}
     */
    IdSequenceDefinition getIdSequenceDefinition();

    /**
     * 按动态等值或后缀条件和公共默认排序查询当前页。
     *
     * @param queryColumnValueMap 来自 Service 的前端查询字段，例如 {@code {"status":1,"loginNameLike":"admin"}}
     * @param pageNo 来自前端分页请求的页码，例如 {@code 1}
     * @param pageSize 来自前端分页请求的每页条数，例如 {@code 10}
     * @return 分页结果，例如
     *     {@code {"records":[{"id":2,"loginName":"admin-b"},{"id":1,"loginName":"admin-a"}],}
     *     {@code "totalCount":2,"pageNo":1,"pageSize":10}}
     */
    CommonPageResult getPageList(Map<String, Object> queryColumnValueMap, Integer pageNo, Integer pageSize);

    /**
     * 按动态条件和调用方指定的受控排序表达式查询当前页。
     *
     * @param queryColumnValueMap 来自 Service 的前端查询字段，例如 {@code {"status":1}}
     * @param orderBy 由 Service 选择的排序表达式，例如 {@code "sortnum desc id asc"}
     * @param pageNo 来自前端分页请求的页码，例如 {@code 1}
     * @param pageSize 来自前端分页请求的每页条数，例如 {@code 10}
     * @return 自定义排序后的分页结果，例如
     *     {@code {"records":[{"id":2,"sortnum":20.00},{"id":1,"sortnum":10.00}],}
     *     {@code "totalCount":2,"pageNo":1,"pageSize":10}}
     */
    CommonPageResult getPageList(Map<String, Object> queryColumnValueMap, String orderBy, Integer pageNo, Integer pageSize);

    /**
     * 从前端通用参数中按真实主键元数据提取单主键或复合主键并查询一条记录。
     *
     * @param queryIn 前端主键参数；单主键例如 {@code {"id":1}}，复合主键例如
     *     {@code {"tenantId":10,"orderId":20}}
     * @return 命中的数据库记录，例如 {@code {"id":1,"loginName":"admin","status":1}}；未命中时返回空映射
     */
    Map<String, Object> getById(CommonParam queryIn);

    /**
     * 按每项完整主键批量查询当前表记录。
     *
     * @param queryIn 前端批量主键参数，例如 {@code {"items":[{"id":1},{"id":2}]}}
     * @return 数据库记录列表，例如
     *     {@code [{"id":1,"loginName":"admin"},{"id":2,"loginName":"auditor"}]}
     */
    List<Map<String, Object>> getByIds(CommonBatchParam queryIn);

    /**
     * 按前端传入且与真实数据库字段匹配的动态条件查询第一条记录。
     *
     * @param queryIn 前端查询字段，例如 {@code {"loginName":"admin","status":1}}
     * @return 第一条匹配记录，例如 {@code {"id":1,"loginName":"admin","status":1}}；未命中时返回空映射
     */
    Map<String, Object> getByQuery(CommonParam queryIn);

    /**
     * 将前端参数中与真实数据库字段匹配的列写入当前表。
     *
     * @param saveIn 前端新增字段，例如 {@code {"id":1,"loginName":"admin","status":1}}
     * @return 数据库影响行数，例如成功新增一条返回 {@code 1}
     */
    int insert(CommonParam saveIn);

    /**
     * 将前端批量新增数据按每组最多一千条写入当前表。
     *
     * @param saveIn 前端批量新增字段，例如
     *     {@code {"items":[{"id":1,"loginName":"admin"},{"id":2,"loginName":"auditor"}]}}
     * @return 全部分组累计影响行数，例如两条均成功返回 {@code 2}
     */
    int insertBatch(CommonBatchParam saveIn);

    /**
     * 按完整主键更新前端参数中与真实数据库字段匹配的非主键列。
     *
     * @param saveIn 前端主键和更新字段，例如 {@code {"id":1,"displayName":"管理员"}}
     * @return 数据库影响行数，例如成功更新一条返回 {@code 1}
     */
    int update(CommonParam saveIn);

    /**
     * 按每条记录的完整主键批量更新，并按相同字段结构和每组最多一千条执行。
     *
     * @param saveIn 前端批量更新字段，例如
     *     {@code {"items":[{"id":1,"status":0},{"id":2,"displayName":"审计员"}]}}
     * @return 全部分组累计影响行数，例如两条均成功返回 {@code 2}
     */
    int updateBatch(CommonBatchParam saveIn);

    /**
     * 按完整主键把当前记录更新为逻辑删除状态。
     *
     * @param deleteIn 前端主键参数，例如 {@code {"id":1}}
     * @return 数据库影响行数，例如记录由 {@code {"id":1,"status":1}} 变为
     *     {@code {"id":1,"status":0}} 时返回 {@code 1}
     */
    int softDelete(CommonParam deleteIn);

    /**
     * 按每项完整主键批量更新逻辑删除状态，每组最多处理一千条。
     *
     * @param deleteIn 前端批量主键参数，例如 {@code {"items":[{"id":1},{"id":2}]}}
     * @return 全部分组累计影响行数，例如两条记录均由 {@code status=1} 更新为 {@code status=0} 时返回 {@code 2}
     */
    int softDeleteBatch(CommonBatchParam deleteIn);
}
