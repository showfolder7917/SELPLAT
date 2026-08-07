package com.sp.selplat.mda.common.config;

import com.sp.selplat.mda.MdaBackendApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;

/**
 * 向统一宿主显式装配 MDA 的接口、业务服务和独立数据库上下文。
 * 本配置不创建 Web 容器，也不向宿主暴露主 DataSource。
 */
@Configuration
@ComponentScan(
        basePackages = "com.sp.selplat.mda",
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = MdaBackendApplication.class))
public class MdaModuleConfiguration {
}
