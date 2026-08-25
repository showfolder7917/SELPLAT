package com.sp.selplat.host;

import com.sp.selplat.aifactory.common.config.AiFactoryModuleConfiguration;
import com.sp.selplat.referencedata.common.config.ReferenceDataModuleConfiguration;
import com.sp.selplat.mda.common.config.MdaModuleConfiguration;
import com.sp.selplat.uniauth.common.config.UniauthModuleConfiguration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;

/**
 * SELPLAT platform-runtime 的唯一目标启动入口。
 * 宿主只扫描自己的平台组件，并通过显式 Import 装配业务模块配置，统一管理 Web 容器和数据源边界。
 */
@SpringBootApplication(scanBasePackages = "com.sp.selplat.host")
@Import({ReferenceDataModuleConfiguration.class, MdaModuleConfiguration.class,
    UniauthModuleConfiguration.class, AiFactoryModuleConfiguration.class})
public class PlatformRuntimeApplication {

    /**
     * 启动统一平台 HTTP 进程。
     *
     * @param args 工程根统一启动入口或 Gradle 命令传入的 Spring Boot 参数，例如
     *     {@code ["--server.port=8080"]}
     *     副作用示例：启动后监听 8080 并发布已装配模块的 HTTP 路由
     */
    public static void main(String[] args) {
        // 平台启动参数 → host 容器、reference-data 框架和统一 HTTP 端口。
        SpringApplication.run(PlatformRuntimeApplication.class, args);
    }
}
