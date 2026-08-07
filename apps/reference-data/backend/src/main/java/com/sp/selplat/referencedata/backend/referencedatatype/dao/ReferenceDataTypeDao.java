package com.sp.selplat.referencedata.backend.referencedatatype.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;

/**
 * 声明 ReferenceDataType 固定表在公共 Base CRUD 之外确有差异的查询和自增主键能力。
 */
public interface ReferenceDataTypeDao extends BaseDao {

    /**
     * 按一个关键词同时匹配稳定坐标与三语名称。
     *
     * @param keyword 编码或名称关键词，例如 {@code resource}
     * @param status 启用或停用状态；为空时查询全部未删除记录
     * @param pageNo 页码，例如 {@code 1}
     * @param pageSize 每页条数，例如 {@code 20}
     * @return 类型分页结果
     */
    CommonPageResult findPage(String keyword, Integer status, int pageNo, int pageSize);

    /**
     * 判断项目与资源坐标是否已被其他未删除记录占用。
     *
     * @param projectCode 项目编码，例如 {@code cms}
     * @param resourceCode 资源编码，例如 {@code article-category}
     * @param excludedId 更新时排除的当前主键；新增时为空
     * @return 已占用返回 true
     */
    boolean existsCoordinate(String projectCode, String resourceCode, Long excludedId);

    /**
     * 使用数据库 identity 新增类型并返回生成主键。
     *
     * @param saveIn 已完成业务校验的类型字段
     * @return 数据库生成主键
     */
    long insertReturningId(CommonParam saveIn);
}
