package com.sp.selplat.aifactory;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** 启动 AI 工厂控制面、HTTP API 与只读可视化页面。 */
@SpringBootApplication
public class AiFactoryBackendApplication {

    /**
     * 启动独立服务。
     * 真实传参示例：{@code --server.port=8091}。
     * 真实返回示例：方法无返回，Spring 启动后监听 8091。
     * 异常或副作用示例：数据库初始化失败时进程启动失败；本方法不会启动 Agent 或 Codex。
     *
     * @param args Spring Boot 命令行参数
     */
    public static void main(String[] args) {
        SpringApplication.run(AiFactoryBackendApplication.class, args);
    }
}
