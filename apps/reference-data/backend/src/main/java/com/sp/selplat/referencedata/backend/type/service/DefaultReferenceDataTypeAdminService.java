package com.sp.selplat.referencedata.backend.type.service;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.backend.type.repository.ReferenceDataTypeRepository;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * 编排引用数据类型管理业务，负责字段校验、坐标唯一性和统一返回结构。
 * 数据库 SQL 与主键生成留在 Repository，HTTP 表达留在 Controller。
 */
@Service
public class DefaultReferenceDataTypeAdminService implements ReferenceDataTypeAdminService {

    // MODULE_CODE 固定管理响应所属模块，便于统一前端和日志定位来源。
    private static final String MODULE_CODE = "reference-data";
    // CODE_PATTERN 限制项目和资源编码为稳定小写短横线形式，避免 URL 坐标出现空格或本地化字符。
    private static final Pattern CODE_PATTERN = Pattern.compile("^[a-z][a-z0-9-]{1,63}$");
    // repository 负责 reference-data 独立数据库中的类型聚合持久化。
    private final ReferenceDataTypeRepository repository;

    /**
     * 装配类型管理 Service。
     *
     * @param repository reference-data 类型聚合仓储
     * 执行结果示例：管理 API 的校验通过后只调用该仓储访问独立文件数据库。
     */
    public DefaultReferenceDataTypeAdminService(ReferenceDataTypeRepository repository) {
        // 强类型仓储 → 类型目录全部读写入口。
        this.repository = repository;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CommonPageResult getStore(CommonPageParam queryIn) {
        // 缺少分页对象时使用公共默认页码和容量，避免空请求退化为全表无界查询。
        CommonPageParam requiredQuery = queryIn == null ? new CommonPageParam() : queryIn;
        int pageNo = requiredQuery.getPageNo();
        int pageSize = Math.min(requiredQuery.getPageSize(), 100);
        // 前端动态筛选值 → 受控关键词和状态参数。
        String keyword = optionalText(requiredQuery.getParam("keyword"), 120, "keyword");
        Integer status = optionalStatus(requiredQuery.getParam("status"));
        // 返回 Repository 已构建的公共分页结构，不再包装成第三种响应类型。
        return repository.findPage(keyword, status, pageNo, pageSize);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CommonResult getById(long id) {
        // 正主键 → 独立数据库中的唯一未删除类型。
        Map<String, Object> record = requiredRecord(id);
        return success(record, null, "/api/reference-data/admin/types/" + id, "类型详情查询完成。");
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CommonResult insert(CommonParam saveIn) {
        // 前端动态字段 → 完整、受控且可直接绑定固定 SQL 的类型值。
        Map<String, Object> values = normalizeValues(saveIn);
        validateUniqueCoordinate(values, null);
        // 数据库 identity 生成主键，禁止 Java 手工计算业务表 id。
        long generatedId = repository.insert(values);
        // 新增后的真实数据库记录 → 前端回显与后续编辑基线。
        Map<String, Object> record = requiredRecord(generatedId);
        return success(record, 1, "/api/reference-data/admin/types", "类型新增完成。");
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CommonResult update(long id, CommonParam saveIn) {
        // 先验证记录存在，避免对不存在主键执行无效果更新。
        requiredRecord(id);
        Map<String, Object> values = normalizeValues(saveIn);
        validateUniqueCoordinate(values, id);
        // 固定字段更新 → 一条未删除类型记录。
        int affectedRows = repository.update(id, values);
        if (affectedRows != 1) {
            throw notFound(id);
        }
        // 更新后的数据库事实 → 管理表格和编辑窗口统一回显。
        Map<String, Object> record = requiredRecord(id);
        return success(record, affectedRows, "/api/reference-data/admin/types/" + id, "类型更新完成。");
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CommonResult delete(long id) {
        // 内置资源类型用于平台自身查询能力，管理端第一版禁止删除但允许编辑文案和状态。
        Map<String, Object> currentRecord = requiredRecord(id);
        if ("reference-data".equals(currentRecord.get("projectCode"))
                && "resource-kind".equals(currentRecord.get("resourceCode"))) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_BUILTIN_TYPE_PROTECTED",
                    "平台内置资源类型不能删除。");
        }
        // 逻辑删除保留历史数据和未来引用关系，不执行物理 DELETE。
        int affectedRows = repository.softDelete(id);
        if (affectedRows != 1) {
            throw notFound(id);
        }
        Map<String, Object> deletedRecord = new LinkedHashMap<>();
        deletedRecord.put("id", id);
        deletedRecord.put("status", 0);
        return success(deletedRecord, affectedRows, "/api/reference-data/admin/types/" + id + "/delete", "类型删除完成。");
    }

    /**
     * 校验并规范化类型保存字段。
     *
     * @param source 前端表单动态参数，例如
     *     {@code {"projectCode":"cms","resourceCode":"article-category","nameZh":"文章分类"}}
     * @return 固定字段映射，例如
     *     {@code {"projectCode":"cms","resourceCode":"article-category","nameZh":"文章分类","status":1,"sortnum":0}}
     */
    private Map<String, Object> normalizeValues(CommonParam source) {
        if (source == null) {
            throw required("request", "类型保存参数不能为空。");
        }
        // 稳定 URL 坐标必须同时存在并符合小写编码规则。
        String projectCode = requiredCode(source.getParam("projectCode"), "projectCode", "项目编码不能为空。");
        String resourceCode = requiredCode(source.getParam("resourceCode"), "resourceCode", "资源编码不能为空。");
        String nameZh = requiredText(source.getParam("nameZh"), 120, "nameZh", "中文名称不能为空。");
        // 状态只允许启用或停用，删除状态必须通过独立删除动作产生。
        Integer status = source.getParam("status") == null ? 1 : integerValue(source.getParam("status"), "status");
        if (status != 1 && status != 2) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_STATUS_INVALID",
                    "类型状态只能是启用或停用。");
        }
        BigDecimal sortnum = decimalValue(source.getParam("sortnum"), "sortnum");
        // 规范化后的固定顺序映射只供 Repository 绑定值，不参与 SQL 标识符拼接。
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("projectCode", projectCode);
        values.put("resourceCode", resourceCode);
        values.put("nameZh", nameZh);
        values.put("nameJa", optionalText(source.getParam("nameJa"), 120, "nameJa"));
        values.put("nameEn", optionalText(source.getParam("nameEn"), 120, "nameEn"));
        values.put("descriptionZh", optionalText(source.getParam("descriptionZh"), 500, "descriptionZh"));
        values.put("descriptionJa", optionalText(source.getParam("descriptionJa"), 500, "descriptionJa"));
        values.put("descriptionEn", optionalText(source.getParam("descriptionEn"), 500, "descriptionEn"));
        values.put("status", status);
        values.put("sortnum", sortnum);
        return values;
    }

    /**
     * 校验项目与资源组成的稳定坐标未被占用。
     *
     * @param values 已规范化字段，例如 {@code {"projectCode":"cms","resourceCode":"article-category"}}
     * @param excludedId 更新时排除的当前主键，例如 {@code 2}；新增时为空
     * 执行结果示例：坐标空闲时继续保存；已存在时抛出
     *     {@code CommonBusinessException("REFERENCE_DATA_TYPE_DUPLICATE", "项目下已存在相同资源编码。")}
     */
    private void validateUniqueCoordinate(Map<String, Object> values, Long excludedId) {
        String projectCode = String.valueOf(values.get("projectCode"));
        String resourceCode = String.valueOf(values.get("resourceCode"));
        if (repository.existsCoordinate(projectCode, resourceCode, excludedId)) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_DUPLICATE",
                    "项目下已存在相同资源编码。");
        }
    }

    /**
     * 查询必须存在的未删除类型记录。
     *
     * @param id 数据库主键，例如 {@code 2}
     * @return 命中的完整类型，例如 {@code {"id":2,"projectCode":"cms","status":1}}
     * @throws CommonBusinessException 当主键非法或记录不存在时抛出，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_TYPE_NOT_FOUND", "未找到引用数据类型：2")}
     */
    private Map<String, Object> requiredRecord(long id) {
        if (id < 1) {
            throw notFound(id);
        }
        Map<String, Object> record = repository.findById(id);
        if (record == null) {
            throw notFound(id);
        }
        return record;
    }

    /**
     * 构建非分页管理接口唯一允许的公共成功结果。
     *
     * @param data 详情或写入后记录，例如 {@code {"id":2,"projectCode":"cms"}}
     * @param affectedRows 写入影响行数，例如 {@code 1}；纯查询为空
     * @param requestPath 实际管理接口路径，例如 {@code /api/reference-data/admin/types/2}
     * @param message 可直接展示的结果说明，例如 {@code "类型更新完成。"}
     * @return 固定结构，例如
     *     {@code {"success":true,"moduleCode":"reference-data","data":{"id":2},"affectedRows":1,"msg":"类型更新完成。"}}
     */
    private CommonResult success(Object data, Integer affectedRows, String requestPath, String message) {
        // Service 一次性拥有全部成功字段，Controller 不得再次包装或修改。
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setModuleCode(MODULE_CODE);
        result.setRequestPath(requestPath);
        result.setData(data);
        result.setAffectedRows(affectedRows);
        result.setMsg(message);
        return result;
    }

    /**
     * 校验必填编码。
     *
     * @param value 前端编码值，例如 {@code "article-category"}
     * @param fieldName 字段名，例如 {@code "resourceCode"}
     * @param message 缺失时安全提示
     * @return 符合规则的小写编码，例如 {@code "article-category"}
     */
    private String requiredCode(Object value, String fieldName, String message) {
        String code = requiredText(value, 64, fieldName, message).toLowerCase();
        if (!CODE_PATTERN.matcher(code).matches()) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_CODE_INVALID",
                    fieldName + " 只能使用小写字母、数字和短横线，并以字母开头。");
        }
        return code;
    }

    /**
     * 校验必填文字及长度。
     *
     * @param value 前端字段值，例如 {@code "文章分类"}
     * @param maxLength 最大允许字符数，例如 {@code 120}
     * @param fieldName 字段名，例如 {@code "nameZh"}
     * @param message 缺失时安全提示
     * @return 去除首尾空格后的文字，例如 {@code "文章分类"}
     */
    private String requiredText(Object value, int maxLength, String fieldName, String message) {
        String text = value == null ? "" : String.valueOf(value).trim();
        if (text.isEmpty()) {
            throw required(fieldName, message);
        }
        if (text.length() > maxLength) {
            throw tooLong(fieldName, maxLength);
        }
        return text;
    }

    /**
     * 规范化可选文字。
     *
     * @param value 前端可选字段值，例如 {@code "Article categories"}
     * @param maxLength 最大允许字符数，例如 {@code 120}
     * @param fieldName 字段名，例如 {@code "nameEn"}
     * @return 空值返回 {@code null}，非空返回去空格文字
     */
    private String optionalText(Object value, int maxLength, String fieldName) {
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if (text.length() > maxLength) {
            throw tooLong(fieldName, maxLength);
        }
        return text;
    }

    /**
     * 解析可选状态筛选。
     *
     * @param value 前端状态值，例如 {@code "1"}
     * @return 启用返回 {@code 1}、停用返回 {@code 2}、空值返回 {@code null}
     */
    private Integer optionalStatus(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        Integer status = integerValue(value, "status");
        if (status != 1 && status != 2) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_STATUS_INVALID",
                    "状态筛选只能是启用或停用。");
        }
        return status;
    }

    /**
     * 把动态字段转换为整数。
     *
     * @param value 前端数字或字符串，例如 {@code "2"}
     * @param fieldName 字段名，例如 {@code "status"}
     * @return 整数值，例如 {@code 2}
     */
    private Integer integerValue(Object value, String fieldName) {
        try {
            return Integer.valueOf(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_NUMBER_INVALID",
                    fieldName + " 必须是整数。",
                    exception);
        }
    }

    /**
     * 把排序值转换为数据库小数。
     *
     * @param value 前端排序值，例如 {@code "100"}
     * @param fieldName 字段名，例如 {@code "sortnum"}
     * @return 数据库排序值，例如 {@code 100}；空值返回 {@code 0}
     */
    private BigDecimal decimalValue(Object value, String fieldName) {
        if (value == null || String.valueOf(value).isBlank()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_NUMBER_INVALID",
                    fieldName + " 必须是数字。",
                    exception);
        }
    }

    /**
     * 构建字段缺失业务异常。
     *
     * @param fieldName 缺失字段，例如 {@code "nameZh"}
     * @param message 可直接展示的提示
     * @return 业务异常，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_TYPE_FIELD_REQUIRED", "中文名称不能为空。")}
     */
    private CommonBusinessException required(String fieldName, String message) {
        return new CommonBusinessException(
                "REFERENCE_DATA_TYPE_FIELD_REQUIRED",
                message + "（" + fieldName + "）");
    }

    /**
     * 构建字段超长业务异常。
     *
     * @param fieldName 超长字段，例如 {@code "nameEn"}
     * @param maxLength 最大长度，例如 {@code 120}
     * @return 业务异常，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_TYPE_FIELD_TOO_LONG", "nameEn 不能超过 120 个字符。")}
     */
    private CommonBusinessException tooLong(String fieldName, int maxLength) {
        return new CommonBusinessException(
                "REFERENCE_DATA_TYPE_FIELD_TOO_LONG",
                fieldName + " 不能超过 " + maxLength + " 个字符。");
    }

    /**
     * 构建类型不存在业务异常。
     *
     * @param id 请求主键，例如 {@code 2}
     * @return 业务异常，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_TYPE_NOT_FOUND", "未找到引用数据类型：2")}
     */
    private CommonBusinessException notFound(long id) {
        return new CommonBusinessException(
                "REFERENCE_DATA_TYPE_NOT_FOUND",
                "未找到引用数据类型：" + id);
    }
}
