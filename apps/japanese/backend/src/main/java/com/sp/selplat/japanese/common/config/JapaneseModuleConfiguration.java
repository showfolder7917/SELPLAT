package com.sp.selplat.japanese.common.config;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.PropertySource;

/** 让统一 Host 自动发现并装配 Japanese 业务组件。 */
@AutoConfiguration
@PropertySource("classpath:japanese-module.properties")
@ComponentScan(basePackages = "com.sp.selplat.japanese")
public class JapaneseModuleConfiguration {
}
