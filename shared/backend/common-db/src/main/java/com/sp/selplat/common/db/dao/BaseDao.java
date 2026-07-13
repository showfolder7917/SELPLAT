package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.query.model.CommonPageResult;
import java.util.Map;

// 公共 DAO 接口统一暴露简单单表模块可直接复用的分页和基础增删改能力。
public interface BaseDao {

    // 默认分页查询按公共排序口径返回当前页结果，供后台列表快速复用统一分页链路。
    CommonPageResult getPageList(Map<String, Object> queryColumnValueMap, Integer pageNo, Integer pageSize);

    // 自定义排序分页查询允许业务模块补充排序表达式，同时继续复用公共动态查询能力。
    CommonPageResult getPageList(Map<String, Object> queryColumnValueMap, String orderBy, Integer pageNo, Integer pageSize);

    // 通用新增接口按列值映射写入当前 DAO 对应表，供简单主数据模块复用统一落库入口。
    int insert(Map<String, Object> columnValueMap);

    // 通用更新接口按主键和值映射更新当前 DAO 对应表，供后台简单编辑场景复用。
    int update(Object idValue, Map<String, Object> columnValueMap);

    // 通用删除接口按主键删除当前 DAO 对应表中的目标记录，供简单后台维护场景复用。
    int del(Object idValue);
}
