package com.sp.selplat.referencedata.backend.type.repository;

import com.sp.selplat.common.util.CommonPageResult;
import java.util.Map;

/**
 * 声明引用数据类型聚合的持久化动作。
 * 本仓储只接受 Service 已校验的稳定字段，不接受前端表名、列名或 SQL 片段。
 */
public interface ReferenceDataTypeRepository {

    /**
     * 按关键词、状态和分页条件查询类型目录。
     *
     * @param keyword 类型编码或中日英文名称关键词，例如 {@code "resource"}
     * @param status 状态过滤，例如 {@code 1}；为空时查询全部未删除记录
     * @param pageNo 页码，例如 {@code 1}
     * @param pageSize 每页条数，例如 {@code 20}
     * @return 固定分页结果，例如
     *     {@code {"records":[{"id":1,"projectCode":"reference-data"}],"totalCount":1,"pageNo":1,"pageSize":20}}
     */
    CommonPageResult findPage(String keyword, Integer status, int pageNo, int pageSize);

    /**
     * 按数据库主键查询一条类型。
     *
     * @param id 数据库生成主键，例如 {@code 1}
     * @return 类型记录，例如 {@code {"id":1,"projectCode":"reference-data","resourceCode":"resource-kind"}}；
     *     未命中返回 {@code null}
     */
    Map<String, Object> findById(long id);

    /**
     * 判断项目编码与资源编码是否已被其他未删除类型占用。
     *
     * @param projectCode 项目编码，例如 {@code "cms"}
     * @param resourceCode 资源编码，例如 {@code "article-category"}
     * @param excludedId 更新时排除的当前主键，例如 {@code 3}；新增时为空
     * @return 坐标已存在返回 {@code true}，否则返回 {@code false}
     */
    boolean existsCoordinate(String projectCode, String resourceCode, Long excludedId);

    /**
     * 新增一条类型并返回数据库生成主键。
     *
     * @param values Service 已校验的字段，例如
     *     {@code {"projectCode":"cms","resourceCode":"article-category","nameZh":"文章分类"}}
     * @return 数据库生成主键，例如 {@code 2}
     */
    long insert(Map<String, Object> values);

    /**
     * 按主键更新一条未删除类型。
     *
     * @param id 数据库主键，例如 {@code 2}
     * @param values Service 已校验的最新字段，例如 {@code {"nameZh":"内容分类","status":2}}
     * @return 实际影响行数，例如成功更新返回 {@code 1}
     */
    int update(long id, Map<String, Object> values);

    /**
     * 将一条类型标记为逻辑删除。
     *
     * @param id 数据库主键，例如 {@code 2}
     * @return 实际影响行数，例如首次删除返回 {@code 1}，已删除或不存在返回 {@code 0}
     */
    int softDelete(long id);
}
