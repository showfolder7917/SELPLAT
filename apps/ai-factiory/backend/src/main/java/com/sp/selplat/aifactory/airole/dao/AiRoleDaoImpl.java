package com.sp.selplat.aifactory.airole.dao;

import com.sp.selplat.aifactory.common.persistence.AiFactoryBaseDao;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** 绑定 AiRole 与 AI 工厂私有 BaseDao。 */
@Repository
public class AiRoleDaoImpl extends AiFactoryBaseDao implements AiRoleDao {

    private final JdbcTemplate jdbc;

    /**
     * 绑定 AI 工厂私有数据源以执行角色删除前的子节点检查。
     * 真实传参示例：Spring 注入 {@code aiFactoryDataSource}。
     * 真实返回示例：构造后可查询 AiRole 子节点。
     * 异常或副作用示例：数据源缺失时应用启动失败；构造过程不执行 SQL。
     *
     * @param dataSource AI 工厂私有数据源
     */
    public AiRoleDaoImpl(@Qualifier("aiFactoryDataSource") DataSource dataSource) {
        this.jdbc = new JdbcTemplate(dataSource);
    }

    /** {@inheritDoc} */
    @Override
    public boolean hasActiveChildren(long roleId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM AiRole WHERE parentId=? AND status<>0", Integer.class, roleId);
        return count != null && count > 0;
    }
}
