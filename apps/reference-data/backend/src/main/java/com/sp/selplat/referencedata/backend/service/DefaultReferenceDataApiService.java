package com.sp.selplat.referencedata.backend.service;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.contract.model.ReferenceDataQuery;
import com.sp.selplat.referencedata.contract.model.TreeNode;
import com.sp.selplat.referencedata.contract.model.TypeOption;
import com.sp.selplat.referencedata.contract.service.ReferenceDataQueryService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * 将 reference-data HTTP 参数转换为内部查询，并为树和类型选项构建固定 CommonResult。
 * 本类不读取 Provider 或数据库，只编排公开查询 Service 的结果和 API 元数据。
 */
@Service
public class DefaultReferenceDataApiService implements ReferenceDataApiService {

    // API 查询统一委托跨项目公开契约，避免 Controller 直接接触 Provider 注册表。
    private final ReferenceDataQueryService queryService;

    /**
     * 创建 HTTP 结果编排 Service。
     *
     * @param queryService Host 已装配的内部查询实现，例如 {@code DefaultReferenceDataQueryService}
     */
    public DefaultReferenceDataApiService(ReferenceDataQueryService queryService) {
        // 内部查询契约 → 树和选项 API 的唯一数据入口。
        this.queryService = queryService;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CommonResult getTree(
            String projectCode,
            String resourceCode,
            String tenantId,
            Map<String, String> parameters) {
        // URL 和查询参数 → 不可变内部查询对象。
        ReferenceDataQuery query = query(projectCode, resourceCode, tenantId, parameters);
        // 已登记 Provider → 排序完成且不可变的根节点列表。
        List<TreeNode> nodes = queryService.getTree(query);
        // 查询结果与实际路径 → Controller 可直接序列化的固定成功响应。
        return success(nodes, requestPath(projectCode, resourceCode, "tree"), "引用数据树查询完成。");
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CommonResult getOptions(
            String projectCode,
            String resourceCode,
            String tenantId,
            Map<String, String> parameters) {
        // URL 和查询参数 → 不可变内部查询对象。
        ReferenceDataQuery query = query(projectCode, resourceCode, tenantId, parameters);
        // 已登记 Provider → 排序完成且不可变的类型选项列表。
        List<TypeOption> options = queryService.getOptions(query);
        // 查询结果与实际路径 → Controller 可直接序列化的固定成功响应。
        return success(options, requestPath(projectCode, resourceCode, "options"), "引用数据选项查询完成。");
    }

    /**
     * 将 HTTP 查询参数转换成内部通用查询对象。
     *
     * @param projectCode URL 项目编码，例如 {@code "reference-data"}
     * @param resourceCode URL 资源编码，例如 {@code "resource-kind"}
     * @param tenantId URL 查询参数中的租户标识，例如 {@code "10001"}
     * @param parameters 全部 URL 查询参数，例如 {@code {"tenantId":"10001","locale":"en-US"}}
     * @return 去除公共 tenantId 后的查询，例如
     *     {@code {projectCode:"reference-data",resourceCode:"resource-kind",tenantId:"10001",parameters:{locale:"en-US"}}}
     */
    private ReferenceDataQuery query(
            String projectCode,
            String resourceCode,
            String tenantId,
            Map<String, String> parameters) {
        // 外部可变请求参数 → 保留顺序的 Provider 参数副本。
        Map<String, Object> providerParameters = new LinkedHashMap<>();
        if (parameters != null) {
            providerParameters.putAll(parameters);
        }
        // tenantId 已进入固定字段 → 从 Provider 扩展参数中移除重复值。
        providerParameters.remove("tenantId");
        // 标准路径和参数 → 由 contract 完成必填校验、去空格和不可变快照。
        return new ReferenceDataQuery(projectCode, resourceCode, tenantId, providerParameters);
    }

    /**
     * 构建 reference-data 非分页查询的固定成功结果。
     *
     * @param data 内部查询 Service 返回的树或选项列表，例如 {@code [{"value":"TREE"}]}
     * @param requestPath 当前实际接口路径，例如 {@code "/api/reference-data/reference-data/resource-kind/options"}
     * @param message 当前查询结果说明，例如 {@code "引用数据选项查询完成。"}
     * @return 完整成功结果，例如
     *     {@code {"success":true,"moduleCode":"reference-data","requestPath":"/api/reference-data/reference-data/resource-kind/options","data":[{"value":"TREE"}],"msg":"引用数据选项查询完成。"}}
     */
    private CommonResult success(Object data, String requestPath, String message) {
        // 查询成功事实 → CommonResult 固定成功标识与模块来源。
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setModuleCode("reference-data");
        // 实际 HTTP 路径和业务数据 → 联调定位与前端统一 data 读取入口。
        result.setRequestPath(requestPath);
        result.setData(data);
        // 查询完成说明 → 前端可以直接展示的统一 msg。
        result.setMsg(message);
        // 已完整填充的 CommonResult → Controller 只执行 JSON 序列化。
        return result;
    }

    /**
     * 根据稳定逻辑坐标生成当前 API 实际路径。
     *
     * @param projectCode 已归一化或原始项目编码，例如 {@code "reference-data"}
     * @param resourceCode 已归一化或原始资源编码，例如 {@code "resource-kind"}
     * @param operation API 末级动作，例如 {@code "tree"} 或 {@code "options"}
     * @return 实际路径，例如 {@code "/api/reference-data/reference-data/resource-kind/tree"}
     */
    private String requestPath(String projectCode, String resourceCode, String operation) {
        // 路径变量与动作 → 与 Controller 映射一致的可回显请求路径。
        return "/api/reference-data/" + projectCode.trim() + "/" + resourceCode.trim() + "/" + operation;
    }
}
