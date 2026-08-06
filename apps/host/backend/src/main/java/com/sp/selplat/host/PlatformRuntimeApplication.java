package com.sp.selplat.host;

import com.sp.selplat.referencedata.backend.config.ReferenceDataModuleConfiguration;
import com.sp.selplat.uniauth.config.UniauthModuleConfiguration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;

/**
 * SELPLAT platform-runtime 的唯一目标启动入口。
 * 宿主只扫描自己的平台组件，并通过显式 Import 装配已验证模块，避免把其他应用的独立启动类和数据源配置意外带入同一进程。
 */
@SpringBootApplication(scanBasePackages = "com.sp.selplat.host")
@Import({ReferenceDataModuleConfiguration.class, UniauthModuleConfiguration.class})
public class PlatformRuntimeApplication {

    /**
     * 启动统一平台 HTTP 进程。
     *
     * @param args scripts/startup 或命令行传入的 Spring Boot 参数，例如
     *     {@code ["--server.port=8080"]}
     */
    public static void main(String[] args) {
        // 平台启动参数 → host 容器、reference-data 框架和统一 HTTP 端口。
        SpringApplication.run(PlatformRuntimeApplication.class, args);
    }
}
