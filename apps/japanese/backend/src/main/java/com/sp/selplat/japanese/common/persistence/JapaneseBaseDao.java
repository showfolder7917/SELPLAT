package com.sp.selplat.japanese.common.persistence;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;

/** 为本工程全部业务 DAO 绑定唯一私有数据库。 */
public abstract class JapaneseBaseDao
        extends BaseDaoImpl {

    // 子类全部通过此上下文访问 japanese 私有数据库。
    private BaseDataSourceContext context;

    /**
     * 注入本工程私有上下文。
     *
     * @param context 绑定 apps/japanese/db 的上下文
     *     <p>执行后无返回值；副作用是绑定全部 DAO 调用。
     */
    @Autowired
    protected final void setContext(
            @Qualifier("japaneseBaseDataSourceContext")
            BaseDataSourceContext context) {
        this.context = context;
    }

    /** @return 本工程数据源和模板 DAO 组合。 */
    @Override
    protected final BaseDataSourceContext
            getDataSourceContext() {
        return context;
    }
}
