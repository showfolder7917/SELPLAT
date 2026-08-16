package com.sp.selplat.referencedata.capability.configuration.controller;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.capability.configuration.service.ReferenceDataConfigurationService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布只使用唯一 code 的配置解析和页面级原子保存接口。 */
@RestController
@RequestMapping(value = "/api/reference-data", produces = MediaType.APPLICATION_JSON_VALUE)
public class ReferenceDataConfigurationController {

    private final ReferenceDataConfigurationService service;

    /**
     * 创建配置控制器并绑定唯一业务服务。
     * 真实传参示例：Spring 注入 ReferenceDataConfigurationServiceImpl。
     * 真实返回示例：控制器可响应配置查询和页面保存请求。
     * 异常或副作用示例：服务缺失时应用启动失败，不创建不完整接口。
     *
     * @param service code 配置解析与页面保存服务
     */
    public ReferenceDataConfigurationController(ReferenceDataConfigurationService service) {
        this.service = service;
    }

    /**
     * 读取当前操作员的页面编辑权限，不接受前端传入身份字段。
     * 真实传参示例：{@code GET /api/reference-data/page-editor-capability}。
     * 真实返回示例：管理员返回 {@code {"data":{"canEditPage":true}}}。
     * 异常或副作用示例：方法不修改数据库，服务异常时交给统一异常处理器。
     *
     * @return 页面编辑权限标准响应
     */
    @GetMapping("/page-editor-capability")
    public CommonResult getPageEditorCapability() {
        return service.getPageEditorCapability();
    }

    /**
     * 通过唯一 code 查询六表中的配置对象和来源表。
     * 真实传参示例：{@code GET /api/reference-data/config/tableElement101020}。
     * 真实返回示例：返回配置记录、实体类型和 {@code sourceTable}。
     * 异常或副作用示例：code 非法、未命中或重复时返回业务错误；方法不修改数据库。
     *
     * @param code 后端生成的全局配置 code
     * @return 唯一配置对象标准响应
     */
    @GetMapping("/config/{code}")
    public CommonResult getByCode(@PathVariable("code") String code) {
        return service.getByCode(code);
    }

    /**
     * 读取一个页面的布局、表格元素和 Window 配置基线。
     * 真实传参示例：{@code GET /api/reference-data/pages/page101017/configuration}。
     * 真实返回示例：返回 controls、tableElements、windows 和 version。
     * 异常或副作用示例：页面 code 非法时返回业务错误；方法不修改数据库。
     *
     * @param pageCode 页面唯一 code
     * @return 页面配置标准响应
     */
    @GetMapping("/pages/{pageCode}/configuration")
    public CommonResult getPageConfiguration(@PathVariable("pageCode") String pageCode) {
        return service.getPageConfiguration(pageCode);
    }

    /**
     * 通过工程编码和稳定页面键读取配置，供新应用与修复应用共享同一接入方式。
     * 真实传参示例：{@code GET /api/reference-data/projects/japanese/pages/n2-blue-book-question/configuration}。
     * 真实返回示例：返回数据库生成的 pageCode、表格、树节点、控件与 Window 配置。
     * 异常或副作用示例：未登记页面返回空配置且不写库；坐标重复时返回业务错误。
     *
     * @param projectCode 应用工程编码，例如 {@code japanese}
     * @param pageKey 应用稳定页面键，例如 {@code n2-blue-book-question}
     * @return 页面配置标准响应
     */
    @GetMapping("/projects/{projectCode}/pages/{pageKey}/configuration")
    public CommonResult getPageConfiguration(
            @PathVariable("projectCode") String projectCode,
            @PathVariable("pageKey") String pageKey) {
        return service.getPageConfiguration(projectCode, pageKey);
    }

    /**
     * 在一个事务中保存页面编辑器提交的受控布局变更。
     * 真实传参示例：{@code POST /api/reference-data/pages/page101017/configuration}，正文含 baseVersion。
     * 真实返回示例：返回新 version 和 updatedCount。
     * 异常或副作用示例：非管理员、版本冲突或 code 归属错误时整体回滚，不产生部分更新。
     *
     * @param pageCode 页面唯一 code
     * @param changeSet 页面版本与控件、表格元素、Window 变更集
     * @return 页面保存标准响应
     */
    @PostMapping(value = "/pages/{pageCode}/configuration", consumes = MediaType.APPLICATION_JSON_VALUE)
    public CommonResult savePageConfiguration(
            @PathVariable("pageCode") String pageCode,
            @RequestBody(required = false) Map<String, Object> changeSet) {
        return service.savePageConfiguration(pageCode, changeSet);
    }
}
