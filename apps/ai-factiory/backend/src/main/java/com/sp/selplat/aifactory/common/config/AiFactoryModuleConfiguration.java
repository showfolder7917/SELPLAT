package com.sp.selplat.aifactory.common.config;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

/**
 * 向统一宿主显式装配 AI 工厂控制面、管理接口、独立数据源和静态页面。
 * 本配置不创建第二个 Web 容器，也不启动本地 Agent、Codex 或 Gate 执行进程。
 */
@Configuration
@ComponentScan(basePackages = "com.sp.selplat.aifactory")
public class AiFactoryModuleConfiguration {
}
