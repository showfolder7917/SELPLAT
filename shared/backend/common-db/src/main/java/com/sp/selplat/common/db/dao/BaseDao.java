package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.domain.CommonLikeQuery;
import java.util.List;
import org.apache.ibatis.annotations.Param;

// 公共 DAO 模板统一沉淀列表、计数、保存和主键查询能力，供各业务领域 DAO 按需继承复用。
public interface BaseDao<T, Q, S, ID> {

    // 通用列表查询按标准查询入参返回结果集，适合承接模块主列表场景。
    List<T> selectList(@Param("query") Q query);

    // 通用扩展查询继续复用标准查询入参，供模块补充非主列表但仍基于组合字段的查询场景。
    List<T> selectListByQuery(@Param("query") Q query);

    // 通用总数查询按标准查询入参返回命中条数，供分页和列表汇总场景复用。
    long selectCount(@Param("query") Q query);

    // 通用新增方法统一承接保存入参，供模块写入单表主数据时复用。
    int insert(@Param("in") S in);

    // 通用更新方法统一承接保存入参，供模块更新单表主数据时复用。
    int update(@Param("in") S in);

    // 通用主键查询按唯一标识返回单条主数据，供详情、编辑回显和删除前校验复用。
    T selectById(@Param("id") ID id);

    // 通用主键删除按唯一标识移除目标记录，供模块单表删除场景复用。
    int deleteById(@Param("id") ID id);

    // 通用模糊查询按字段和值返回结果集，供模块在白名单字段范围内复用模糊筛选能力。
    List<T> selectListByLike(@Param("likeQuery") CommonLikeQuery likeQuery);
}
