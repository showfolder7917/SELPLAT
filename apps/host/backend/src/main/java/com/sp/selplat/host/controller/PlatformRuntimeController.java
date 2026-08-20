package com.sp.selplat.host.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.JsonUtils;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 提供 platform-runtime 自身的运行状态，不承载任何业务模块数据。
 * 健康响应根据桌面唯一应用清单确认 reference-data 模块已登记。
 */
@RestController
@RequestMapping("/api/platform/runtime")
public class PlatformRuntimeController {

    // 桌面应用清单 → 健康接口与真实桌面共用的唯一模块代码来源。
    private final List<String> runtimeModules;

    /**
     * 创建平台运行状态 Controller。
     *
     * @param objectMapper Spring 提供的 JSON 读取器，例如读取 desktop/applications.json
     */
    public PlatformRuntimeController(ObjectMapper objectMapper) {
        this.runtimeModules = loadRuntimeModules(objectMapper);
    }

    /**
     * 返回统一宿主与当前已装配模块状态。
     *
     * @return 固定成功结构，例如
     *     {@code {"success":true,"data":{"status":"READY","runtime":"platform-runtime",}}
     *     {@code "modules":["host","mda","reference-data","uniauth","japanese","ai-factory"],}
     *     {@code "msg":"平台宿主已启动。"}}
     */
    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public String health() {
        Map<String, Object> data = new LinkedHashMap<>();
        // 当前 Spring 上下文事实 → 平台状态、运行时身份和已装配模块清单。
        data.put("status", "READY");
        data.put("runtime", "platform-runtime");
        data.put("modules", runtimeModules);
        data.put("referenceDataModuleReady", runtimeModules.contains("reference-data"));

        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setData(data);
        result.setMsg("平台宿主已启动。");
        // 完整 CommonResult → host 健康检查使用的 application/json 文本。
        return JsonUtils.toJsonIgnoreNull(result);
    }

    /**
     * 从桌面唯一应用清单构建统一运行时模块列表。
     * 真实传参示例：applications.json 含 mda、reference-data、uniauth、japanese、ai-factory。
     * 真实返回示例：{@code [host,mda,reference-data,uniauth,japanese,ai-factory]}。
     * 异常或副作用示例：清单缺失、JSON 无效或 code 为空时阻断 Host 启动，不修改文件。
     *
     * @param objectMapper Spring JSON 读取器
     * @return 包含 host 和全部桌面应用 code 的不可变列表
     */
    private List<String> loadRuntimeModules(ObjectMapper objectMapper) {
        ClassPathResource manifest = new ClassPathResource("static/desktop/applications.json");
        try (InputStream input = manifest.getInputStream()) {
            JsonNode applications = objectMapper.readTree(input).path("applications");
            if (!applications.isArray()) {
                throw new IOException("desktop applications 必须是数组");
            }
            List<String> modules = new ArrayList<>();
            modules.add("host");
            for (JsonNode application : applications) {
                String code = application.path("code").asText().strip();
                if (code.isEmpty()) throw new IOException("desktop application code 不能为空");
                if (!modules.contains(code)) modules.add(code);
            }
            return List.copyOf(modules);
        } catch (IOException exception) {
            throw new IllegalStateException("无法从桌面清单建立统一运行时模块列表。", exception);
        }
    }
}
