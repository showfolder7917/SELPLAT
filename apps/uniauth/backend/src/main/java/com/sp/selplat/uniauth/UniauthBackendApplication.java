package com.sp.selplat.uniauth;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// Uniauth 启动入口负责装配控制层、服务层、MyBatis 映射和本地验证所需的数据源配置。
@SpringBootApplication(scanBasePackages = "com.sp.selplat")
// Mapper 扫描只注册公共模板 DAO，避免把业务 DAO 接口误注册成第二个 Bean 导致注入冲突。
@MapperScan("com.sp.selplat.common.db.dao")
public class UniauthBackendApplication {

    // 主方法用于直接启动 uniauth 后端服务，供本地 HTTP 联调验证控制器与 DAO 链路。
    public static void main(String[] args) {
        // 启动 Spring Boot 容器后，用户控制器和 MyBatis 映射会一起加载到同一个后端进程中。
        SpringApplication.run(UniauthBackendApplication.class, args);
    }
}
