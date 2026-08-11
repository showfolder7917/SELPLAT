package com.sp.selplat.referencedata.referencedatatablecolumn.dao;

import com.sp.selplat.common.db.dao.BaseDao;
import java.util.List;
import java.util.Map;

/** 负责 ReferenceDataTableColumn 的公共 CRUD 与页面表头解析查询。 */
public interface ReferenceDataTableColumnDao extends BaseDao {

    /**
     * 查询一个真实数据库表和页面实例的启用显示列。
     *
     * @param tableName 数据库表名，例如 {@code "ReferenceDataOption"}
     * @param gridId SEL 表格实例标识，例如 {@code "selGridOptionManagementId"}
     * @return 已排序列记录，例如 {@code [{"gridColumnId":"option","tableFieldName":"optionValue"}]}
     */
    List<Map<String, Object>> findVisibleColumns(String tableName, String gridId);
}
