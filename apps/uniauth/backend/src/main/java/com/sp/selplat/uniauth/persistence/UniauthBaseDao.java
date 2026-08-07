package com.sp.selplat.uniauth.persistence;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import com.sp.selplat.common.db.metadata.model.ColumnMetadata;
import com.sp.selplat.uniauth.table.model.UniauthTableColumnDefinition;
import com.sp.selplat.uniauth.table.model.UniauthTableDefinition;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;

/**
 * 为 Uniauth 的业务 DAO 统一绑定本项目数据源上下文。
 * 具体用户、角色和权限 DAO 只继承本类，不再各自重复选择 DataSource 或模板 DAO。
 */
public abstract class UniauthBaseDao extends BaseDaoImpl implements UniauthTableMetadataDao {

    // DEFAULT_DEFINITION_SOURCE 标记当前结果来自数据库元数据，后续可与 REFERENCE_DATA 来源区分。
    private static final String DEFAULT_DEFINITION_SOURCE = "DEFAULT_METADATA";
    // PASSWORD_HASH_COLUMN 不允许作为普通前端表格的默认可见列，但仍保留元数据供配置校验。
    private static final String PASSWORD_HASH_COLUMN = "passwordHash";

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

    /**
     * 从当前具体 DAO 对应的真实数据库表生成默认表格定义。
     *
     * @param viewCode 前端表格实例编码，例如 {@code user-management}
     * @param locale 当前语言，例如 {@code zh-CN}
     * @return 默认定义，例如
     *     {@code {"source":"DEFAULT_METADATA","resourceCode":"UniauthUser",}
     *     {@code "viewCode":"user-management","columns":[{"field":"loginName","title":"登录账号"}]}}
     */
    @Override
    public UniauthTableDefinition getDefaultTableDefinition(String viewCode, String locale) {
        // 创建有序列集合，数据库元数据顺序就是默认前端列顺序。
        List<UniauthTableColumnDefinition> columns = new ArrayList<>();
        // orderIndex 从一开始，方便前端和后续配置直接作为自然显示顺序使用。
        int orderIndex = 1;
        // 遍历公共 Base 已校验的真实字段映射，字段名不会来自前端参数。
        for (ColumnMetadata metadata : getDbColumnsMap().values()) {
            // 数据库没有备注时使用字段名作为可识别的默认标题。
            String title = org.springframework.util.StringUtils.hasText(metadata.getRemarks())
                ? metadata.getRemarks()
                : metadata.getColumnName();
            // 口令摘要保留在定义中用于后续配置校验，但默认禁止页面显示。
            boolean visible = !PASSWORD_HASH_COLUMN.equals(metadata.getColumnName());
            // 把当前字段的名称、备注、类型和显示属性转换成稳定前端列结构。
            columns.add(new UniauthTableColumnDefinition(
                metadata.getColumnName(),
                title,
                metadata.getRemarks(),
                metadata.getDataType(),
                metadata.getJavaType(),
                metadata.getLength(),
                metadata.getScale(),
                Boolean.TRUE.equals(metadata.getPrimaryKey()),
                visible,
                orderIndex
            ));
            // 下一字段使用递增顺序值，保持和 JDBC 返回顺序一致。
            orderIndex++;
        }
        // 资源编码使用当前具体 DAO 推导出的物理表名，同一资源可以由不同 viewCode 表达多个前端表格。
        return new UniauthTableDefinition(
            DEFAULT_DEFINITION_SOURCE,
            getTableName(),
            viewCode,
            locale,
            List.copyOf(columns)
        );
    }
}
