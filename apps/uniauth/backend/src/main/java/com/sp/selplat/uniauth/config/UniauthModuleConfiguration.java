package com.sp.selplat.uniauth.config;

import com.sp.selplat.uniauth.UniauthBackendApplication;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;

/**
 * 为 platform-runtime 显式装配 Uniauth 业务组件和公共持久化组件。
 * 本配置不启动第二个 Web 容器，也不扫描 Uniauth 独立启动类，因此 Host 与 Uniauth 共用一个 HTTP 端口。
 */
@Configuration(proxyBeanMethods = false)
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
    // Spring 通过配置注解完成模块装配，本类不重复声明公共层已经提供的 Bean。
}
