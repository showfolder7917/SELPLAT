package com.sp.selplat.referencedata.referencedatatreenode.dao;

import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 使用 reference-data 私有数据库读取 ReferenceDataTreeNode 表。 */
@Repository
public class ReferenceDataTreeNodeDaoImpl extends ReferenceDataBaseDao implements ReferenceDataTreeNodeDao {

    /**
     * 按内部外键读取节点所属类型，用于校验工程归属并派生节点对象类别前缀。
     * 真实传参示例：{@code 101001}。
     * 真实返回示例：返回 {@code {"id":101001,"projectCode":"reference-data","type":"DROPDOWN"}}。
     * 异常或副作用示例：未命中时返回 null；方法不修改数据库。
     *
     * @param typeId 类型内部主键
     * @return 类型主键、项目编码和类型键，未命中时为空
     */
    @Override
    public Map<String, Object> findTypeById(long typeId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id,projectCode,type FROM ReferenceDataType WHERE id=? AND status<>0",
                typeId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private final JdbcTemplate jdbcTemplate;

    /**
     * 创建树节点 DAO。
     *
     * @param jdbcTemplate 限定到 reference-data 数据库的模板，例如连接 {@code reference-data.mv.db}
     */
    public ReferenceDataTreeNodeDaoImpl(
            @Qualifier("referenceDataJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** {@inheritDoc} */
    @Override
    public List<Map<String, Object>> findEnabledNodes(String typeCode) {
        return jdbcTemplate.queryForList(
                "SELECT t.type AS \"resourceType\", n.nodeCode AS \"nodeCode\", "
                        + "p.nodeCode AS \"parentCode\", "
                        + "n.nodeValue AS \"nodeValue\", n.labelZh AS \"labelZh\", "
                        + "n.labelJa AS \"labelJa\", n.labelEn AS \"labelEn\", "
                        + "n.icon AS \"icon\", n.commandCode AS \"commandCode\", "
                        + "n.disabled AS \"disabled\", n.selectable AS \"selectable\", "
                        + "n.sortnum AS \"sortnum\", n.attributesJson AS \"attributesJson\" "
                        + "FROM ReferenceDataTreeNode n "
                        + "JOIN ReferenceDataType t ON t.id = n.typeId "
                        + "LEFT JOIN ReferenceDataTreeNode p ON p.id = n.parentId "
                        + "WHERE t.code = ? "
                        + "AND t.status = 1 AND n.status = 1 "
                        + "ORDER BY n.sortnum ASC, n.id ASC",
                typeCode);
    }
}
