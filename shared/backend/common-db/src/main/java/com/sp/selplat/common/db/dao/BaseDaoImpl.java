package com.sp.selplat.common.db.dao;

import com.sp.selplat.common.db.template.model.CommonTemplateSave;
import com.sp.selplat.common.db.template.model.CommonTemplateUpdate;
import com.sp.selplat.common.db.query.model.QueryCondition;
import com.sp.selplat.common.db.query.model.QueryOrder;
import com.sp.selplat.common.util.CommonPageResult;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// 公共 DAO 门面层直接桥接 BaseTemplateDao 和分页查询基类，让简单主数据模块复用统一 CRUD 与分页能力。
public abstract class BaseDaoImpl extends BasePagingQueryDaoImpl implements BaseDao {

    // 公共分页查询按等值条件返回当前页数据和总数，供后台列表页按数据库方言统一复用分页能力。
    @Override
    public CommonPageResult getPageList(Map<String, Object> queryColumnValueMap,Integer pageNo,Integer pageSize) {
        // 不传排序时统一按 sortnum 倒序返回，保持和当前通用列表默认展示顺序一致。
        return getPageList(queryColumnValueMap, "sortnum desc", pageNo, pageSize);
    }

    // 公共分页查询允许调用方补充排序表达式，并继续复用底层多数据库分页方言。
    @Override
    public CommonPageResult getPageList(Map<String,Object> queryColumnValueMap,String orderBy,Integer pageNo,Integer pageSize) {
        // 先把字段后缀驱动的查询条件转换成结构化条件集合，让分页查询走统一动态 SQL 校验和构建链路。
        List<QueryCondition> conditions = buildQueryConditions(queryColumnValueMap);
        // 再把排序字符串转换成结构化排序对象，让数据库差异继续收口到方言分页实现。
        List<QueryOrder> orders = buildOrders(orderBy);
        // 当前分页查询统一委托分页基类执行，避免 BaseDaoImpl 再直接依赖底层动态分页实现细节。
        return queryList(null, conditions, orders, pageNo, pageSize);
    }

    // 公共新增方法按列值映射写入目标表，适合后台简单主数据维护场景。
    @Override
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

    // 公共更新方法仅接收主键值列表，主键字段名由当前 DAO 自动解析后组装模板条件。
    @Override
    public int update(List<Object> idValues, Map<String, Object> columnValueMap) {
        // 把调用方传入的更新数据包装成模板更新入参，统一收口主键值列表、表名和待更新字段。
        CommonTemplateUpdate updateIn = new CommonTemplateUpdate();
        // 当前更新固定命中当前 DAO 约定解析出的物理表，避免业务层重复维护表名常量。
        updateIn.setTableName(getTableName());
        // 当前更新先把 DAO 自动解析出的主键字段列表显式写入更新入参，避免主键名称来源隐藏在黑盒 helper 中。
        updateIn.setIdColumns(getIds());
        // 当前更新再把外部传入的主键值列表显式写入更新入参，保证字段名和值的配对来源都清晰可见。
        updateIn.setIdValues(resolveIdValues(updateIn.getIdColumns(), idValues));
        // 使用有序映射复制待更新字段，保证模板 set 子句来源清晰且不回写调用方对象。
        updateIn.setColumnValueMap(copyColumnValueMap(columnValueMap));
        // 通过模板 DAO 执行通用更新，让不同模块共享同一套复合主键感知的动态 update 能力。
        return baseTemplateDao.updateByIds(updateIn);
    }

    // 公共删除方法仅接收主键值列表，主键字段名由当前 DAO 自动解析后组装模板条件。
    @Override
    public int del(List<Object> idValues) {
        // 先读取当前 DAO 的主键字段列表，明确当前删除 where 条件使用哪些主键列。
        List<String> idColumns = getIds();
        // 通过模板 DAO 按 DAO 内部组装出的主键列值映射直接删除目标数据，复用统一复合主键删除链路。
        return baseTemplateDao.deleteByIds(getTableName(), buildIdColumnValueMap(idColumns, resolveIdValues(idColumns, idValues)));
    }

    // 受保护的主键查询供子类或测试在需要时回查模板操作结果，外部仅传主键值列表。
    protected Map<String, Object> getByIds(List<Object> idValues) {
        // 先读取当前 DAO 的主键字段列表，明确当前详情查询 where 条件使用哪些主键列。
        List<String> idColumns = getIds();
        // 通过模板 DAO 按 DAO 内部组装出的主键列值映射查询当前表的一条记录，供详情回显或测试验证复用。
        return baseTemplateDao.selectByIds(getTableName(), getselectColumns(), buildIdColumnValueMap(idColumns, resolveIdValues(idColumns, idValues)));
    }

    // 主键值列表统一校验数量和空值，保证后续字段名和值配对过程安全可控。
    private List<Object> resolveIdValues(List<String> idColumns, List<Object> idValues) {
        // 主键值列表为空时立即失败，避免模板 SQL 生成无主键条件的更新或删除语句。
        if (idValues == null || idValues.isEmpty()) {
            throw new IllegalArgumentException("idValues must not be empty");
        }
        // 主键值数量与主键字段数量不一致时立即失败，避免主键条件错位匹配。
        if (idColumns.size() != idValues.size()) {
            throw new IllegalArgumentException("primary key value count mismatch: expected " + idColumns.size() + " but got " + idValues.size());
        }
        // 返回已通过校验的主键值列表，供后续与主键字段顺序一一配对。
        return idValues;
    }

    // 主键列值映射统一由 DAO 内部按主键列顺序和外部传入主键值列表组装，避免外部感知字段名。
    private Map<String, Object> buildIdColumnValueMap(List<String> idColumns, List<Object> idValues) {
        // 使用有序映射按主键字段顺序组装字段和值，供模板 SQL 稳定拼接复合主键 where 条件。
        Map<String, Object> idColumnValueMap = new LinkedHashMap<>();
        // 逐个把主键字段和对应值配对写入映射，保证模板层无需再感知主键字段来源。
        for (int index = 0; index < idColumns.size(); index++) {
            idColumnValueMap.put(idColumns.get(index), idValues.get(index));
        }
        // 返回经过校验的主键列值映射，供模板 SQL 逐列拼接 where 条件。
        return idColumnValueMap;
    }

}
