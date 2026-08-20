package com.sp.selplat.aifactory.common.config;

import com.sp.selplat.aifactory.AiFactoryBackendApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.FilterType;

/**
 * 向统一宿主显式装配 AI 工厂控制面、管理接口、独立数据源和静态页面。
 * 本配置不创建第二个 Web 容器，也不会启动独立 ai-memory BAT 客户端。
 */
@Configuration
@ComponentScan(
        basePackages = "com.sp.selplat.aifactory",
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = AiFactoryBackendApplication.class))
public class AiFactoryModuleConfiguration {
}
