package com.sp.selplat.mda.common.persistence;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;

/**
 * 为 MDA 固定控制表统一绑定 MDA 自己的永久控制库。
 * 动态目标数据库查询不继承本类，继续由 jdbc 模块按连接配置运行期建立连接。
 */
public abstract class MdaBaseDao extends BaseDaoImpl {

    private BaseDataSourceContext dataSourceContext;

    /**
     * 注入 MDA 控制库上下文。
     *
     * @param context 绑定 apps/mda/db/mda.mv.db 的基础数据源上下文
     */
    @Autowired
    protected final void setMdaDataSourceContext(
            @Qualifier("mdaBaseDataSourceContext") BaseDataSourceContext context) {
        this.dataSourceContext = context;
    }

    /**
     * 返回 MDA 固定表使用的控制库上下文。
     *
     * @return MDA 控制库数据源与模板 DAO 组合
     */
    @Override
    protected final BaseDataSourceContext getDataSourceContext() {
        return dataSourceContext;
    }
}
