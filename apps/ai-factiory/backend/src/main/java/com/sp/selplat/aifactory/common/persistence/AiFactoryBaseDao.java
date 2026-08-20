package com.sp.selplat.aifactory.common.persistence;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;

/** 为 AI 工厂全部固定表 DAO 绑定唯一私有数据库。 */
public abstract class AiFactoryBaseDao extends BaseDaoImpl {

    private BaseDataSourceContext context;

    /**
     * 绑定 AI 工厂私有数据源上下文。
     * 真实传参示例：Spring 注入 {@code aiFactoryBaseDataSourceContext}。
     * 真实返回示例：方法无返回值，后续 DAO 元数据与 CRUD 均访问 AI 工厂数据库。
     * 异常或副作用示例：上下文缺失时应用启动失败；本方法不执行 SQL。
     *
     * @param context AI 工厂模板 DAO 上下文
     */
    @Autowired
    protected final void setContext(
            @Qualifier("aiFactoryBaseDataSourceContext") BaseDataSourceContext context) {
        this.context = context;
    }

    /** {@inheritDoc} */
    @Override
    protected final BaseDataSourceContext getDataSourceContext() {
        return context;
    }
}
