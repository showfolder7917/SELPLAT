package com.sp.selplat.referencedata.referencedatatreenode.dao;

import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 使用 reference-data 私有数据库读取独立的 ReferenceDataTreeNode 表。 */
@Repository
public class ReferenceDataTreeNodeDaoImpl extends ReferenceDataBaseDao implements ReferenceDataTreeNodeDao {

    private final JdbcTemplate jdbcTemplate;

    /**
     * 创建树节点 DAO。
     * 真实传参示例：注入连接 {@code reference-data.mv.db} 的 JdbcTemplate。
     * 真实返回示例：得到只访问 ReferenceDataTreeNode 的 DAO 实例。
     * 异常或副作用示例：数据源缺失时 Spring 启动失败；构造过程不查询数据库。
     *
     * @param jdbcTemplate 限定到 reference-data 数据库的模板
     */
    public ReferenceDataTreeNodeDaoImpl(
            @Qualifier("referenceDataJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** {@inheritDoc} */
    @Override
    public CommonPageResult findTreePage(
            String keyword,
            Integer status,
            int pageNo,
            int pageSize) {
        StringBuilder whereSql = new StringBuilder(" WHERE status<>0");
        List<Object> parameters = new ArrayList<>();
        if (keyword != null && !keyword.isBlank()) {
            whereSql.append(" AND (LOWER(code) LIKE ? OR parentId=?)");
            String pattern = "%" + keyword.trim().toLowerCase() + "%";
            parameters.add(pattern);
            // 父级是数值 id；非数字关键词用不可命中的 -1，仍只让 code 分支参与查询。
            parameters.add(parseParentId(keyword));
        }
        if (status != null) {
            whereSql.append(" AND status=?");
            parameters.add(status);
        }
        Long totalCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ReferenceDataTreeNode" + whereSql,
                Long.class,
                parameters.toArray());
        List<Object> pageParameters = new ArrayList<>(parameters);
        pageParameters.add(pageSize);
        pageParameters.add((pageNo - 1) * pageSize);
        List<Map<String, Object>> records = jdbcTemplate.queryForList(
                "SELECT * FROM ReferenceDataTreeNode" + whereSql
                        + " ORDER BY sortnum DESC,id ASC LIMIT ? OFFSET ?",
                pageParameters.toArray());
        CommonPageResult result = new CommonPageResult();
        result.setRecords(records);
        result.setTotalCount(totalCount);
        result.setPageNo(pageNo);
        result.setPageSize(pageSize);
        return result;
    }

    /**
     * 把搜索词解析为可精确匹配的父节点 id。
     * 真实传参示例：{@code "101002"} 返回 {@code 101002}。
     * 真实返回示例：非数字 {@code "treeNode"} 返回不可命中的 {@code -1}。
     * 异常或副作用示例：超出 long 范围时也返回 {@code -1}；方法不访问数据库。
     *
     * @param keyword 已去除首尾空格前的搜索词
     * @return 父节点 id 或不可命中的 -1
     */
    private long parseParentId(String keyword) {
        try {
            return Long.parseLong(keyword.trim());
        } catch (NumberFormatException exception) {
            return -1L;
        }
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findEnabledNodes() {
        return jdbcTemplate.queryForList(
                "SELECT id AS \"id\",code AS \"code\",parentId AS \"parentId\","
                        + "nodeValue AS \"nodeValue\",labelZh AS \"labelZh\","
                        + "labelJa AS \"labelJa\",labelEn AS \"labelEn\",sortnum AS \"sortnum\" "
                        + "FROM ReferenceDataTreeNode WHERE status=1 ORDER BY sortnum ASC,id ASC");
    }
}
