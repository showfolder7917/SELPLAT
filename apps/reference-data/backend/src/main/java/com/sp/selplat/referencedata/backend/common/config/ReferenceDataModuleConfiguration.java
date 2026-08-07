package com.sp.selplat.referencedata.backend.common.config;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

/**
 * 向 platform-runtime 显式装配 reference-data 的 Provider 注册表和查询 Service。
 * 本配置不创建独立 Web 容器或数据源，后续持久化能力仍由 reference-data backend 自己维护。
 */
@Configuration
@ComponentScan(basePackages = "com.sp.selplat.referencedata.backend")
public class ReferenceDataModuleConfiguration {
}
