package com.sp.selplat.referencedata.common.persistence;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import com.sp.selplat.common.db.sequence.model.IdSequenceDefinition;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;

/**
 * 为 reference-data 固定业务表统一绑定本项目自己的永久数据库。
 * provider 与通用查询接口不继承本类，继续按资源提供器协议工作。
 */
public abstract class ReferenceDataBaseDao extends BaseDaoImpl {

    // 六张引用数据元数据表共享项目级对象号段，保证对象类型前缀加全局主键形成的 code 跨表不重复。
    public static final String OBJECT_ID_SEQUENCE_CODE = "ReferenceDataObjectId";

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

    /**
     * 把当前引用数据业务表的主键统一绑定到项目级全局对象号段。
     * 真实传参示例：当前 DAO 对应 ReferenceDataWindow，主键列为 {@code id}。
     * 真实返回示例：返回 {@code {"id":"ReferenceDataObjectId"}}，与类型、节点和表格共用游标。
     * 异常或副作用示例：当前方法不访问数据库；主键结构不是单列 id 时启动门禁会阻断该 DAO。
     *
     * @return 当前表主键与项目级对象号段的固定映射
     */
    @Override
    public IdSequenceDefinition getIdSequenceDefinition() {
        Map<String, String> sequenceCodes = new LinkedHashMap<>();
        sequenceCodes.put("id", OBJECT_ID_SEQUENCE_CODE);
        return new IdSequenceDefinition(sequenceCodes);
    }
}
