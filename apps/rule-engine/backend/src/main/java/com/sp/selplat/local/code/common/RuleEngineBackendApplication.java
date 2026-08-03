package com.sp.selplat.local.code.common;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.logging.Level;
import java.util.logging.Logger;

// 规则引擎启动入口使用 Java 21 内置 HTTP 服务建立零外部依赖的离线运行容器。
public class RuleEngineBackendApplication {

    // 启动日志统一标识规则引擎进程，便于本地运行和后续运维定位生命周期事件。
    private static final Logger LOGGER = Logger.getLogger(RuleEngineBackendApplication.class.getName());
    // 默认端口避开现有 uniauth 服务，并允许部署环境通过 RULE_ENGINE_PORT 覆盖。
    private static final int DEFAULT_PORT = 8081;
    // 健康检查路径沿用模块路由前缀，供脚本和 IDE 判断规则引擎进程是否可用。
    private static final String HEALTH_PATH = "/rule-engine/health";
    // 健康响应保持固定结构，供服务端返回和启动验证共用同一契约。
    private static final String HEALTH_RESPONSE = "{\"status\":\"UP\",\"module\":\"rule-engine\"}";
    // 验证参数用于构建阶段完成端口绑定后主动退出，避免自动测试遗留后台进程。
    private static final String VERIFY_ARGUMENT = "--verify";

    /**
     * 启动规则引擎后端，并注册最小健康检查接口。
     *
     * @param args 外部传入的运行参数；使用 --verify 时完成启动校验后退出
     */
    public static void main(String[] args) {
        try {
            // 先解析部署环境端口，再建立规则引擎独立监听地址。
            int port = resolvePort();
            // 使用 JDK 内置服务承载模块接口，确保离线环境不依赖未缓存的第三方组件。
            HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
            // 健康检查用于确认进程、端口和模块路由均已成功建立。
            server.createContext(HEALTH_PATH, RuleEngineBackendApplication::handleHealth);
            // 启动 HTTP 生命周期后，后续 parser、validator 和 executor 接口可继续注册到同一容器。
            server.start();
            // 输出可操作的访问地址，便于命令行和 VS Code 用户立即确认运行结果。
            LOGGER.info(() -> "Rule Engine backend started at http://localhost:" + port + HEALTH_PATH);
            // 构建验证模式实际请求健康接口，并在验证完成后释放后台服务。
            if (Arrays.asList(args).contains(VERIFY_ARGUMENT)) {
                try {
                    // 自请求验证覆盖端口绑定、路由注册、状态码和 JSON 响应完整主路径。
                    verifyHealth(port);
                } finally {
                    // 无论响应校验成功或失败都释放端口，避免自动测试遗留后台进程。
                    server.stop(0);
                }
                // 明确记录验证闭环，供 Gradle 输出作为可执行证据。
                LOGGER.info("Rule Engine backend verification completed.");
            }
        } catch (IOException exception) {
            // 端口占用或系统网络资源异常时记录完整原因，避免把启动失败误判为运行成功。
            LOGGER.log(Level.SEVERE, "Rule Engine backend failed to start.", exception);
            // 将底层启动异常转换为进程失败，保证 Gradle run 和 VS Code 能感知失败状态。
            throw new IllegalStateException("Rule Engine backend failed to start.", exception);
        }
    }

    /**
     * 请求本进程健康接口并校验稳定响应契约。
     *
     * @param port 当前验证进程实际监听端口
     * @throws IOException 接口不可访问或响应契约不一致时终止启动验证
     */
    private static void verifyHealth(int port) throws IOException {
        // 使用回环地址访问本进程，避免验证依赖外部网络或 DNS。
        URI healthUri = URI.create("http://127.0.0.1:" + port + HEALTH_PATH);
        // JDK 原生连接与服务端保持零第三方依赖，适配当前离线执行基准。
        HttpURLConnection connection = (HttpURLConnection) healthUri.toURL().openConnection();
        // 健康检查只读取运行状态，不产生任何规则或业务数据变更。
        connection.setRequestMethod("GET");
        // 限制连接等待时间，端口或服务异常时能够快速给出构建失败证据。
        connection.setConnectTimeout(3000);
        // 限制响应读取时间，避免异常处理链无限阻塞自动验证。
        connection.setReadTimeout(3000);
        try {
            // HTTP 200 是规则引擎进程可提供服务的第一层运行契约。
            int statusCode = connection.getResponseCode();
            // 读取完整 UTF-8 JSON，继续验证返回体没有被路由或编码配置破坏。
            String responseBody;
            try (InputStream responseStream = connection.getInputStream()) {
                // 一次性读取最小健康响应，避免为固定小报文引入额外缓冲状态。
                responseBody = new String(responseStream.readAllBytes(), StandardCharsets.UTF_8);
            }
            // 状态码或 JSON 任一不一致都应阻止构建把运行能力误判为可用。
            if (statusCode != 200 || !HEALTH_RESPONSE.equals(responseBody)) {
                // 异常信息携带实际响应，便于直接定位健康接口回归。
                throw new IOException(
                        "Unexpected health response: status=" + statusCode + ", body=" + responseBody);
            }
        } finally {
            // 验证结束后主动释放客户端连接，配合服务端停止完成资源闭环。
            connection.disconnect();
        }
    }

    /**
     * 从运行环境解析规则引擎监听端口。
     *
     * @return 有效的 TCP 监听端口
     */
    private static int resolvePort() {
        // 未配置部署端口时使用模块默认值，保证本地首次运行无需额外准备。
        String configuredPort = System.getenv("RULE_ENGINE_PORT");
        // 空白环境变量与未配置保持同一业务语义，统一回退到默认端口。
        if (configuredPort == null || configuredPort.isBlank()) {
            // 默认端口作为本地开发和文档示例的稳定契约返回。
            return DEFAULT_PORT;
        }
        try {
            // 显式配置存在时按十进制端口解析，避免静默忽略部署错误。
            int port = Integer.parseInt(configuredPort);
            // TCP 端口必须位于有效范围，超界配置应在进程启动前立即失败。
            if (port < 1 || port > 65535) {
                // 抛出明确异常，使调用方能够直接修正 RULE_ENGINE_PORT。
                throw new IllegalArgumentException("RULE_ENGINE_PORT must be between 1 and 65535.");
            }
            // 返回已校验端口供 HTTP 服务绑定。
            return port;
        } catch (NumberFormatException exception) {
            // 非数字配置属于部署契约错误，保留原异常便于定位实际输入。
            throw new IllegalArgumentException("RULE_ENGINE_PORT must be a number.", exception);
        }
    }

    /**
     * 返回规则引擎进程的最小健康状态。
     *
     * @param exchange 当前健康检查请求与响应上下文
     * @throws IOException 响应头或响应体写入失败时由 HTTP 服务记录并关闭本次请求
     */
    private static void handleHealth(HttpExchange exchange) throws IOException {
        // 健康响应使用稳定 JSON 契约，便于脚本和后续平台监控直接解析。
        byte[] responseBody = HEALTH_RESPONSE.getBytes(StandardCharsets.UTF_8);
        // 声明 JSON 与 UTF-8，避免调用方按平台默认编码解释状态内容。
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        // 成功状态与精确字节长度一起发送，保证不同 HTTP 客户端读取一致。
        exchange.sendResponseHeaders(200, responseBody.length);
        // 响应流在本次请求内关闭，防止重复健康检查累积系统资源。
        try (OutputStream responseStream = exchange.getResponseBody()) {
            // 写出完整健康状态后，由 try-with-resources 统一完成刷新和关闭。
            responseStream.write(responseBody);
        }
    }
}
