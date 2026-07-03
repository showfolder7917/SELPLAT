package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.domain.CommonTemplateQuery;
import com.sp.selplat.common.db.domain.CommonTemplateSave;
import com.sp.selplat.common.db.domain.CommonTemplateUpdate;
import com.sp.selplat.common.db.domain.QueryCondition;
import com.sp.selplat.common.db.domain.QueryOrder;
import com.sp.selplat.common.db.domain.query.CommonPageResult;
import java.util.List;
import java.util.Map;

// 公共 DAO 门面层直接桥接 BaseTemplateDao 和分页查询基类，让简单主数据模块复用统一 CRUD 与分页能力。
public abstract class BaseDaoImpl extends BasePagingQueryDaoImpl {

    // 公共分页查询按等值条件返回当前页数据和总数，供后台列表页按数据库方言统一复用分页能力。
    public CommonPageResult getPageList(Map<String, Object> queryColumnValueMap,Integer pageNo,Integer pageSize) {
        // 不传排序时统一按 sortnum 倒序返回，保持和当前通用列表默认展示顺序一致。
        return getPageList(queryColumnValueMap, "sortnum desc", pageNo, pageSize);
    }

    // 公共分页查询允许调用方补充排序表达式，并继续复用底层多数据库分页方言。
    public CommonPageResult getPageList(Map<String,Object> queryColumnValueMap,String orderBy,Integer pageNo,Integer pageSize) {
        // 先把等值查询条件转换成结构化条件集合，让分页查询走统一动态 SQL 校验和构建链路。
        List<QueryCondition> conditions = buildEqualConditions(queryColumnValueMap);
        // 再把排序字符串转换成结构化排序对象，让数据库差异继续收口到方言分页实现。
        List<QueryOrder> orders = buildOrders(orderBy);
        // 当前分页查询统一委托分页基类执行，避免 BaseDaoImpl 再直接依赖底层动态分页实现细节。
        return queryPage(null, conditions, orders, pageNo, pageSize);
    }

    // // 公共列表查询按字段等值条件返回结果集，适合快速承接后台简单列表页。
    // public List<Map<String, Object>> getList(Map<String, Object> queryColumnValueMap) {
    //     // 不传排序时沿用模板默认顺序，减少调用方在简单场景下的重复样板代码。
    //     return getList(queryColumnValueMap, "sortnum desc");
    // }

    // // 公共列表查询允许调用方补充排序表达式，供后台列表页在受控字段范围内统一复用。
    // public List<Map<String, Object>> getList(Map<String, Object> queryColumnValueMap, String orderBy) {
    //     // 先把列表筛选条件整理成模板 DAO 认识的查询对象，统一收口表名、列清单和 where 条件。
    //     CommonTemplateQuery query = buildTemplateQuery(queryColumnValueMap, orderBy);
    //     // 通过模板 DAO 执行等值列表查询，让所有简单列表场景共用同一套动态 SQL。
    //     return baseTemplateDao.selectListByQuery(query);
    // }


    // 公共新增方法按列值映射写入目标表，适合后台简单主数据维护场景。
    public int insert(Map<String, Object> columnValueMap) {
        // 把调用方传入的列值映射包装成模板新增入参，统一收口目标表和写入字段集合。
        CommonTemplateSave saveIn = new CommonTemplateSave();
        // 当前新增固定写入当前 DAO 约定解析出的物理表，避免上层重复传表名或依赖构造函数初始化。
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
        // 当前更新固定命中当前 DAO 约定解析出的物理表，避免业务层重复维护表名常量。
        updateIn.setTableName(getTableName());
        // 当前更新固定按子类声明的主键列定位目标记录，保持公共方法口径统一。
        updateIn.setIdColumn(getId());
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
        return baseTemplateDao.deleteById(getTableName(), getId(), idValue);
    }

    // 受保护的主键查询供子类或测试在需要时回查模板操作结果，避免重复拼接表信息。
    protected Map<String, Object> getById(Object idValue) {
        // 通过模板 DAO 按主键查询当前表的一条记录，供详情回显或测试验证复用。
        return baseTemplateDao.selectById(getTableName(), getselectColumns(), getId(), idValue);
    }

}
