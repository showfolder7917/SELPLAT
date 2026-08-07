package com.sp.selplat.uniauth.common.persistence;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;

/**
 * 为 Uniauth 的业务 DAO 统一绑定本项目数据源上下文。
 * 具体用户、角色和权限 DAO 只继承本类，不再各自重复选择 DataSource 或模板 DAO。
 */
public abstract class UniauthBaseDao extends BaseDaoImpl {

    // dataSourceContext 保存 Uniauth 明确选择的数据源与模板 DAO 组合，不使用公共 Base 的隐式全局注入。
    private BaseDataSourceContext dataSourceContext;

    /**
     * 注入 Uniauth 模块声明的数据源上下文。
     *
     * @param context Uniauth 数据源上下文，例如绑定 {@code selplat_uniauth} H2 数据库的上下文
     * 执行结果示例：所有 Uniauth DAO 的元数据、查询与写入均使用同一个数据库连接体系。
     */
    @Autowired
    protected final void setUniauthDataSourceContext(
        @Qualifier("uniauthBaseDataSourceContext") BaseDataSourceContext context
    ) {
        // 保存模块配置提供的固定上下文，后续公共 Base 调用只读取该上下文。
        this.dataSourceContext = context;
    }

    /**
     * 向公共 Base DAO 返回 Uniauth 自己的数据源上下文。
     *
     * @return Uniauth 上下文，例如包含当前 Uniauth DataSource 与 BaseTemplateDao
     */
    @Override
    protected final BaseDataSourceContext getDataSourceContext() {
        // 返回由 Uniauth 配置层注入的上下文，禁止公共层自行选择宿主数据源。
        return dataSourceContext;
    }

}
