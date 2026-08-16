package com.sp.selplat.referencedata.referencedatatreenode.dao;

import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
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
    public List<Map<String, Object>> findEnabledNodes() {
        return jdbcTemplate.queryForList(
                "SELECT id AS \"id\",code AS \"code\",parentId AS \"parentId\","
                        + "nodeValue AS \"nodeValue\",labelZh AS \"labelZh\","
                        + "labelJa AS \"labelJa\",labelEn AS \"labelEn\",sortnum AS \"sortnum\" "
                        + "FROM ReferenceDataTreeNode WHERE status=1 ORDER BY sortnum ASC,id ASC");
    }
}
