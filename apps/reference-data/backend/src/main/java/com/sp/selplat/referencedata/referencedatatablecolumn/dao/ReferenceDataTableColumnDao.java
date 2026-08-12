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

    /**
     * 按页面表格坐标批量更新管理员拖拽后的列宽。
     *
     * @param tableName 真实业务表名，例如 {@code "ReferenceDataTable"}
     * @param gridId SEL 表格配置标识，例如 {@code "selGridTableManagementId"}
     * @param columnWidths 列标识与像素宽度，例如 {@code {"projectName":"180px","tableName":"220px"}}
     * @param tenantId 当前管理员所属租户，例如 {@code 1L}
     * @param operatorId 当前管理员操作员主键，例如 {@code 1L}
     * @return 实际更新行数，例如两列均命中时返回 {@code 2}
     */
    int updateColumnWidths(
            String tableName,
            String gridId,
            Map<String, String> columnWidths,
            Long tenantId,
            Long operatorId);
}
