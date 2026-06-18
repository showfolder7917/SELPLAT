package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.domain.CommonTemplateQuery;
import com.sp.selplat.common.db.domain.CommonTemplateSave;
import com.sp.selplat.common.db.domain.CommonTemplateUpdate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// 公共 DAO 基类直接桥接 BaseTemplateDao，让简单主数据模块只配置表信息就能复用通用 CRUD。
public abstract class BaseDao {

    // 模板 DAO 代理对象承接真正的动态 SQL 执行，公共基类只负责把业务参数整理成模板入参。
    private final BaseTemplateDao baseTemplateDao;

    // 创建公共 DAO 时强制注入模板 DAO，保证后续列表、新增、更新和删除都走同一套模板能力。
    protected BaseDao(BaseTemplateDao baseTemplateDao) {
        // 保存模板 DAO 代理，供所有通用方法复用同一条数据库访问链路。
        this.baseTemplateDao = baseTemplateDao;
    }

    // 子类必须明确当前公共 DAO 对应的物理表，避免模板层面对目标表产生歧义。
    protected abstract String getTableName();

    // 子类必须明确当前公共 DAO 的主键列名，供更新和删除按唯一标识命中目标记录。
    protected abstract String getIdColumn();

    // 子类必须明确当前列表和详情默认读取的列清单，避免模板层直接无约束执行 select *。
    protected abstract String getSelectColumns();

    // 公共列表查询按字段等值条件返回结果集，适合快速承接后台简单列表页。
    public List<Map<String, Object>> getList(Map<String, Object> queryColumnValueMap) {
        // 不传排序时沿用模板默认顺序，减少调用方在简单场景下的重复样板代码。
        return getList(queryColumnValueMap, null);
    }

    // 公共列表查询允许调用方补充排序表达式，供后台列表页在受控字段范围内统一复用。
    public List<Map<String, Object>> getList(Map<String, Object> queryColumnValueMap, String orderBy) {
        // 先把列表筛选条件整理成模板 DAO 认识的查询对象，统一收口表名、列清单和 where 条件。
        CommonTemplateQuery query = buildTemplateQuery(queryColumnValueMap, orderBy);
        // 通过模板 DAO 执行等值列表查询，让所有简单列表场景共用同一套动态 SQL。
        return baseTemplateDao.selectListByQuery(query);
    }

    // 公共新增方法按列值映射写入目标表，适合后台简单主数据维护场景。
    public int insert(Map<String, Object> columnValueMap) {
        // 把调用方传入的列值映射包装成模板新增入参，统一收口目标表和写入字段集合。
        CommonTemplateSave saveIn = new CommonTemplateSave();
        // 当前新增固定写入子类声明的物理表，避免上层重复传表名。
        saveIn.setTableName(getTableName());
        // 使用有序映射复制业务字段，保证模板插入列顺序稳定且不污染调用方原始对象。
        saveIn.setColumnValueMap(copyColumnValueMap(columnValueMap));
        // 通过模板 DAO 执行通用新增，让不同模块共享同一套动态 insert 能力。
        return baseTemplateDao.insert(saveIn);
    }

    // 公共更新方法按主键和值映射覆盖目标记录，适合后台简单单表编辑场景。
    public int update(Object idValue, Map<String, Object> columnValueMap) {
        // 把调用方传入的更新数据包装成模板更新入参，统一收口主键、表名和待更新字段。
        CommonTemplateUpdate updateIn = new CommonTemplateUpdate();
        // 当前更新固定命中子类声明的物理表，避免业务层重复维护表名常量。
        updateIn.setTableName(getTableName());
        // 当前更新固定按子类声明的主键列定位目标记录，保持公共方法口径统一。
        updateIn.setIdColumn(getIdColumn());
        // 当前更新主键值由调用方传入，供模板 where 子句唯一命中目标行。
        updateIn.setIdValue(idValue);
        // 使用有序映射复制待更新字段，保证模板 set 子句来源清晰且不回写调用方对象。
        updateIn.setColumnValueMap(copyColumnValueMap(columnValueMap));
        // 通过模板 DAO 执行通用更新，让不同模块共享同一套动态 update 能力。
        return baseTemplateDao.updateById(updateIn);
    }

    // 公共删除方法按主键删除目标记录，适合后台简单主数据移除场景。
    public int del(Object idValue) {
        // 通过模板 DAO 按当前子类声明的表和主键直接删除目标数据，复用统一删除链路。
        return baseTemplateDao.deleteById(getTableName(), getIdColumn(), idValue);
    }

    // 受保护的主键查询供子类或测试在需要时回查模板操作结果，避免重复拼接表信息。
    protected Map<String, Object> getById(Object idValue) {
        // 通过模板 DAO 按主键查询当前表的一条记录，供详情回显或测试验证复用。
        return baseTemplateDao.selectById(getTableName(), getSelectColumns(), getIdColumn(), idValue);
    }

    // 把等值查询条件组装成模板查询对象，统一沉淀公共列表查询的参数转换逻辑。
    private CommonTemplateQuery buildTemplateQuery(Map<String, Object> queryColumnValueMap, String orderBy) {
        // 创建模板查询对象，准备承接当前公共列表场景需要的表信息和筛选条件。
        CommonTemplateQuery query = new CommonTemplateQuery();
        // 当前查询固定命中子类声明的物理表，避免调用方重复维护表名。
        query.setTableName(getTableName());
        // 当前查询固定读取子类声明的列清单，保持返回字段口径稳定可控。
        query.setSelectColumns(getSelectColumns());
        // 当前查询把调用方传入的字段和值复制成独立映射，防止后续模板处理误改原对象。
        query.setQueryColumnValueMap(copyColumnValueMap(queryColumnValueMap));
        // 当前查询在需要时附带排序表达式，供后台列表页稳定控制展示顺序。
        query.setOrderBy(orderBy);
        return query;
    }

    // 复制字段映射时统一使用 LinkedHashMap，保证列顺序稳定并兼容 null 场景。
    private Map<String, Object> copyColumnValueMap(Map<String, Object> sourceColumnValueMap) {
        // 调用方不传条件或字段时，统一返回空有序映射，避免模板层出现空指针。
        if (sourceColumnValueMap == null || sourceColumnValueMap.isEmpty()) {
            return new LinkedHashMap<>();
        }
        // 复制一份独立有序映射，让模板入参和调用方原始对象完全解耦。
        return new LinkedHashMap<>(sourceColumnValueMap);
    }
}
