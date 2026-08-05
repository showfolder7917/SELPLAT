package com.sp.selplat.mda;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * MDA 多数据库工作台启动入口，统一扫描 SELPLAT 公共层和当前应用组件。
 */
@SpringBootApplication(scanBasePackages = "com.sp.selplat")
@MapperScan(basePackages = "com.sp.selplat.common.db.template")
public class MdaBackendApplication {

    /**
     * 启动本地 MDA HTTP 服务。
     *
     * @param args Spring Boot 启动参数，例如 {@code --server.port=8082}
     */
    public static void main(String[] args) {
        // 把启动参数完整交给 Spring Boot，页面、连接配置库与 API 在同一进程中装配。
        SpringApplication.run(MdaBackendApplication.class, args);
    }
}
