package com.sp.selplat.uniauth.common.config;

import com.sp.selplat.common.db.datasource.BaseDataSourceContext;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDao;
import com.sp.selplat.common.db.sequence.CommonSequenceSegmentDaoImpl;
import com.sp.selplat.common.db.template.BaseTemplateDao;
import com.sp.selplat.uniauth.UniauthBackendApplication;
import javax.sql.DataSource;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.PropertySource;

/**
 * 为 platform-runtime 显式装配 Uniauth 业务组件和模块私有持久化组件。
 * 本配置不启动第二个 Web 容器，也不扫描 Uniauth 独立启动类，因此 Host 与 Uniauth 共用一个 HTTP 端口。
 */
@Configuration(proxyBeanMethods = false)
@PropertySource("classpath:uniauth-module.properties")
@ComponentScan(
    basePackages = {
        "com.sp.selplat.uniauth",
        "com.sp.selplat.common.db",
        "com.sp.selplat.common.service",
        "com.sp.selplat.common.web"
    },
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = UniauthBackendApplication.class
    )
)
@MapperScan("com.sp.selplat.common.db.template")
public class UniauthModuleConfiguration {

    /**
     * 创建只在 Uniauth 私有数据库中查询和推进号段的项目 DAO。
     *
     * @param dataSource Uniauth 配置按限定名提供的私有数据源
     * @return Uniauth 号段 DAO，例如可命中 {@code UniauthUserId} 且不会访问 MDA 控制库
     */
    @Bean("uniauthCommonSequenceSegmentDao")
    public CommonSequenceSegmentDao uniauthCommonSequenceSegmentDao(
            @Qualifier("uniauthDataSource") DataSource dataSource) {
        // Uniauth 私有数据源 → 该项目唯一的号段查询与游标推进入口。
        return new CommonSequenceSegmentDaoImpl(dataSource);
    }

    /**
     * 把 Uniauth 当前数据源与使用同一数据源的模板 DAO 绑定为项目上下文。
     *
     * @param dataSource Uniauth 独立运行或 Host 装配时创建的模块私有永久数据源
     * @param baseTemplateDao 使用同一数据源创建的公共模板 DAO
     * @return Uniauth 基础 DAO 上下文，例如
     *     {@code new BaseDataSourceContext(uniauthDataSource, uniauthBaseTemplateDao)}
     */
    @Bean("uniauthBaseDataSourceContext")
    public BaseDataSourceContext uniauthBaseDataSourceContext(
        @Qualifier("uniauthDataSource") DataSource dataSource,
        BaseTemplateDao baseTemplateDao
    ) {
        // 明确把当前 Uniauth 数据源与模板 DAO 成对交给项目 DAO 基类。
        return new BaseDataSourceContext(dataSource, baseTemplateDao);
    }
}
