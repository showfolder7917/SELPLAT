package com.sp.selplat.referencedata.common.persistence;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;

/**
 * 为 reference-data 固定业务表统一绑定本项目自己的永久数据库。
 * provider 与通用查询接口不继承本类，继续按资源提供器协议工作。
 */
public abstract class ReferenceDataBaseDao extends BaseDaoImpl {

    // 没有独立实体表的共享逻辑对象使用该号段；六张业务表主键继续使用 BaseDao 的一表一号段默认规则。
    public static final String SHARED_OBJECT_ID_SEQUENCE_CODE = "ReferenceDataObjectId";

    private BaseDataSourceContext dataSourceContext;

    /**
     * 注入 reference-data 独立永久库上下文。
     *
     * @param context 绑定 reference-data.mv.db 的基础数据源上下文
     */
    @Autowired
    protected final void setReferenceDataSourceContext(
            @Qualifier("referenceDataBaseDataSourceContext") BaseDataSourceContext context) {
        this.dataSourceContext = context;
    }

    /**
     * 返回 reference-data 固定表数据源上下文。
     *
     * @return 永久库数据源与模板 DAO 组合
     */
    @Override
    protected final BaseDataSourceContext getDataSourceContext() {
        return dataSourceContext;
    }

}
