package com.sp.selplat.uniauth;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Uniauth 启动入口负责装配控制层、服务层、公共模板 Mapper 和运行所需的数据源配置。
 */
@SpringBootApplication(scanBasePackages = "com.sp.selplat")
// Mapper 扫描只注册公共模板层内部 Mapper，BaseTemplateDao 门面继续由 Spring 组件扫描装配。
@MapperScan("com.sp.selplat.common.db.template")
public class UniauthBackendApplication {

    /**
     * 启动 uniauth 后端服务，供 HTTP 客户端调用用户接口。
     *
     * @param args JVM 启动参数，例如 {@code ["--spring.profiles.active=local"]}
     */
    public static void main(String[] args) {
        // 启动 Spring Boot 容器后，用户控制器和 MyBatis 映射会一起加载到同一个后端进程中。
        SpringApplication.run(UniauthBackendApplication.class, args);
    }
}
