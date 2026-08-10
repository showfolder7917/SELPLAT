package com.sp.selplat.mda.capability.projectgenerator.controller;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.mda.capability.projectgenerator.service.MdaProjectGeneratorService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 MDA 工程脚手架的唯一创建入口。 */
@RestController
@RequestMapping(value = "/api/mda/projects/", produces = MediaType.APPLICATION_JSON_VALUE)
public class MdaProjectGeneratorController {

    // Controller 只持有工程生成 Service，不直接操作文件系统。
    private final MdaProjectGeneratorService service;

    /**
     * 创建工程生成控制器。
     *
     * @param service Spring 注入的真实文件生成服务，例如 {@code MdaProjectGeneratorService}
     *     <p>构造完成后无返回值；后续所有写入统一由 Service 处理。
     */
    public MdaProjectGeneratorController(MdaProjectGeneratorService service) {
        this.service = service;
    }

    /**
     * 创建完整工程或向生成器拥有的工程追加业务表。
     *
     * @param request JSON 请求，例如 {@code {"projectName":"japan","tableName":"region"}}
     * @return 固定成功 JSON，例如
     *     {@code {"success":true,"data":{"pageUrl":"/japan/japan.html","restartRequired":true}}}
     * @throws com.sp.selplat.common.exception.CommonBusinessException 输入非法或目标冲突时抛出；失败不覆盖已有文件
     */
    @PostMapping("create.htm")
    public String create(@RequestBody CommonParam request) {
        Map<String, Object> data = service.generate(request);
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setData(data);
        result.setMsg(Boolean.TRUE.equals(data.get("projectCreated"))
                ? "工程和首张业务表创建完成。"
                : "新业务表及页面创建完成。");
        return JsonUtils.toJsonIgnoreNull(result);
    }
}
