package com.sp.selplat.referencedata.common.config;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

/**
 * 向 platform-runtime 显式装配 reference-data 的四个表业务和公共基础设施。
 * 本配置不创建独立 Web 容器，各表数据源仍由 reference-data persistence 自己维护。
 */
@Configuration
@ComponentScan(basePackages = "com.sp.selplat.referencedata")
public class ReferenceDataModuleConfiguration {
}
