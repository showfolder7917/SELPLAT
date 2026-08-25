package com.sp.selplat.mda.common.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.PropertySource;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

/**
 * 向统一宿主显式装配 MDA 的接口、业务服务和独立数据库上下文。
 * 本配置不创建 Web 容器，也不向宿主暴露主 DataSource。
 */
@Configuration
@EnableScheduling
@EnableConfigurationProperties(MdaTargetPoolProperties.class)
@PropertySource("classpath:mda-module.properties")
@ComponentScan(
        basePackages = {
            "com.sp.selplat.mda",
            "com.sp.selplat.common.service"
        })
public class MdaModuleConfiguration {
}
