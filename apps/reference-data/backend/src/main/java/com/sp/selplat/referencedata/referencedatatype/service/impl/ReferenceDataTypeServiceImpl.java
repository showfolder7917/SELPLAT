package com.sp.selplat.referencedata.referencedatatype.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.referencedata.common.util.code.ReferenceDataCodeServiceImpl;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.referencedatatype.dao.ReferenceDataTypeDao;
import com.sp.selplat.referencedata.referencedatatype.service.ReferenceDataTypeService;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 编排引用数据类型管理业务，负责字段校验、坐标唯一性和统一返回结构。
 * 数据库差异留在 DAO，HTTP 表达留在 Controller。
 */
@Service
public class ReferenceDataTypeServiceImpl
        extends ReferenceDataCodeServiceImpl<ReferenceDataTypeDao>
        implements ReferenceDataTypeService {

    // CODE_PATTERN 限制项目和资源编码为稳定小写短横线形式，避免 URL 坐标出现空格或本地化字符。
    private static final Pattern CODE_PATTERN = Pattern.compile("^[a-z][a-z0-9-]{1,63}$");
    // TYPE_KEYS 是公共组件首期明确支持的消费者类型，数据库和前端不得写入未登记字符串。
    private static final Set<String> TYPE_KEYS = Set.of(
            "DROPDOWN", "TREE", "GRID_MENU", "PANEL_MENU", "CONTEXT_MENU");

    /**
     * 将数据类型记录编码标记为 type，数字部分仍由全局号段统一生成。
     * 真实传参示例：{@code {"projectCode":"reference-data","type":"DROPDOWN"}}。
     * 真实返回示例：返回 {@code type}，最终 code 形如 {@code type101001}。
     * 异常或副作用示例：本方法不修改参数；缺少主键时由公共编码链阻止新增。
     *
     * @param saveIn 已规范化的数据类型新增参数
     * @return 数据类型对象前缀
     */
    @Override
    protected String resolveCodePrefix(CommonParam saveIn) {
        return "type";
    }

    /** {@inheritDoc} */
    @Override
    public CommonResult getTypeByCode(String typeCode) {
        String requiredCode = String.valueOf(typeCode == null ? "" : typeCode).trim();
        Map<String, Object> record = getDao().findEnabledByCode(requiredCode);
        if (record == null) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_CODE_NOT_FOUND",
                    "未找到引用数据类型：" + requiredCode);
        }
        return buildSuccessResult(record, "类型详情查询完成。");
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
        return getDao().findPage(keyword, status, pageNo, pageSize);
    }

    /**
     * 按公共动态主键参数查询唯一未删除的引用数据类型，不保留平行的 long 主键入口。
     *
     * @param queryIn BaseController 传入的主键参数，例如 {@code {"id":1}}
     * @return 类型详情，例如
     *     {@code {"success":true,"data":{"id":1,"resourceCode":"resource-kind"},"msg":"类型详情查询完成。"}}
     * @throws CommonBusinessException id 缺失或记录不存在时抛出，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_TYPE_NOT_FOUND", "引用数据类型不存在：1")}
     */
    @Override
    public CommonResult getById(CommonParam queryIn) {
        long id = requiredId(queryIn == null ? null : queryIn.getParam("id"));
        // 正主键 → 独立数据库中的唯一未删除类型。
        Map<String, Object> record = requiredRecord(id);
        return buildSuccessResult(record, "类型详情查询完成。");
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CommonResult insert(CommonParam saveIn) {
        // 前端动态字段 → 完整、受控且可直接绑定固定 SQL 的类型值。
        CommonParam values = normalizeValues(saveIn);
        validateUniqueCoordinate(values, null);
        // 复用公共新增链完成全局对象发号、code 拼接、身份覆盖和 DAO 写入，避免类型表保留旁路实现。
        return super.insert(values);
    }

    @Override
    @Transactional
    public CommonResult insertBatch(CommonBatchParam saveIn) {
        if (saveIn == null) {
            throw required("request", "类型保存参数不能为空。");
        }
        for (CommonParam item : saveIn.getItems()) {
            CommonParam normalized = normalizeValues(item);
            validateUniqueCoordinate(normalized, null);
            item.setParamMap(normalized.getParamMap());
        }
        // 批量新增仍逐项走公共发号扩展点，保证每条 code 都由同一全局号段生成。
        return super.insertBatch(saveIn);
    }

    /**
     * 按公共动态参数校验并更新一条引用数据类型，更新后返回数据库中的真实记录。
     *
     * @param saveIn BaseController 传入的主键与字段，例如
     *     {@code {"id":1,"projectCode":"reference-data","resourceCode":"resource-kind","nameZh":"引用数据资源类型"}}
     * @return 更新后的类型，例如
     *     {@code {"success":true,"data":{"id":1,"nameZh":"引用数据资源类型"},"affectedRows":1,"msg":"类型更新完成。"}}
     * @throws CommonBusinessException id 缺失、坐标重复或记录不存在时抛出，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_TYPE_NOT_FOUND", "引用数据类型不存在：1")}
     */
    @Override
    public CommonResult update(CommonParam saveIn) {
        long id = requiredId(saveIn == null ? null : saveIn.getParam("id"));
        // 先验证记录存在，避免对不存在主键执行无效果更新。
        requiredRecord(id);
        CommonParam values = normalizeValues(saveIn);
        validateUniqueCoordinate(values, id);
        // 固定字段更新 → 一条未删除类型记录。
        values.putParam("id", id);
        int affectedRows = getDao().update(values);
        // requiredRecord 已确认物理记录存在，当前模块没有物理删除入口，因此直接保留真实影响行数。
        // 更新后的数据库事实 → 管理表格和编辑窗口统一回显。
        Map<String, Object> record = requiredRecord(id);
        return buildSuccessResult(record, affectedRows, "类型更新完成。");
    }

    @Override
    @Transactional
    public CommonResult updateBatch(CommonBatchParam saveIn) {
        if (saveIn == null) {
            throw required("request", "类型保存参数不能为空。");
        }
        for (CommonParam item : saveIn.getItems()) {
            long id = requiredId(item.getParam("id"));
            requiredRecord(id);
            CommonParam normalized = normalizeValues(item);
            validateUniqueCoordinate(normalized, id);
            normalized.putParam("id", id);
            item.setParamMap(normalized.getParamMap());
        }
        return super.updateBatch(saveIn);
    }

    /**
     * 按公共动态主键参数假删除一条类型，并保护平台内置资源类型不被删除。
     *
     * @param deleteIn BaseController 传入的主键参数，例如 {@code {"id":2}}
     * @return 假删除结果，例如
     *     {@code {"success":true,"data":{"id":2,"status":0},"affectedRows":1,"msg":"类型删除完成。"}}
     * @throws CommonBusinessException id 缺失、记录不存在或目标为内置类型时抛出，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_BUILTIN_TYPE_PROTECTED", "平台内置资源类型不能删除。")}
     */
    @Override
    public CommonResult delete(CommonParam deleteIn) {
        long id = requiredId(deleteIn == null ? null : deleteIn.getParam("id"));
        // 内置资源类型用于平台自身查询能力，管理端第一版禁止删除但允许编辑文案和状态。
        Map<String, Object> currentRecord = requiredRecord(id);
        if ("reference-data".equals(currentRecord.get("projectCode"))
                && "resource-kind".equals(currentRecord.get("resourceCode"))) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_BUILTIN_TYPE_PROTECTED",
                    "平台内置资源类型不能删除。");
        }
        // 逻辑删除保留历史数据和未来引用关系，不执行物理 DELETE。
        CommonParam deleteParam = idParam(id);
        // 特殊删除链路直接调用 DAO，因此仍由基础 Service 的当前身份入口统一补租户和操作员。
        applyCurrentIdentity(deleteParam);
        int affectedRows = getDao().softDelete(deleteParam);
        // requiredRecord 已确认物理记录存在，假删除只更新状态，不存在并发物理删除分支。
        Map<String, Object> deletedRecord = new LinkedHashMap<>();
        deletedRecord.put("id", id);
        deletedRecord.put("status", 0);
        return buildSuccessResult(deletedRecord, affectedRows, "类型删除完成。");
    }

    @Override
    @Transactional
    public CommonResult deleteBatch(CommonBatchParam deleteIn) {
        if (deleteIn == null) {
            throw required("request", "类型删除参数不能为空。");
        }
        for (CommonParam item : deleteIn.getItems()) {
            Map<String, Object> currentRecord = requiredRecord(requiredId(item.getParam("id")));
            if ("reference-data".equals(currentRecord.get("projectCode"))
                    && "resource-kind".equals(currentRecord.get("resourceCode"))) {
                throw new CommonBusinessException(
                        "REFERENCE_DATA_BUILTIN_TYPE_PROTECTED",
                        "平台内置资源类型不能删除。");
            }
        }
        return super.deleteBatch(deleteIn);
    }

    /**
     * 校验并规范化类型保存字段。
     *
     * @param source 前端表单动态参数，例如
     *     {@code {"projectCode":"cms","resourceCode":"article-category","nameZh":"文章分类"}}
     * @return 固定字段映射，例如
     *     {@code {"projectCode":"cms","resourceCode":"article-category","nameZh":"文章分类","status":1,"sortnum":0}}
     */
    private CommonParam normalizeValues(CommonParam source) {
        if (source == null) {
            throw required("request", "类型保存参数不能为空。");
        }
        // 稳定 URL 坐标必须同时存在并符合小写编码规则。
        String projectCode = requiredCode(source.getParam("projectCode"), "projectCode", "项目编码不能为空。");
        String resourceCode = requiredCode(source.getParam("resourceCode"), "resourceCode", "资源编码不能为空。");
        String nameZh = requiredText(source.getParam("nameZh"), 120, "nameZh", "中文名称不能为空。");
        String type = source.getParam("type") == null
                ? "TREE"
                : String.valueOf(source.getParam("type")).trim().toUpperCase();
        if (!TYPE_KEYS.contains(type)) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_KEY_INVALID",
                    "类型键必须是下拉框、树、表格菜单、面板菜单或右键菜单。");
        }
        // 状态只允许启用或停用，删除状态必须通过独立删除动作产生。
        Integer status = source.getParam("status") == null ? 1 : integerValue(source.getParam("status"), "status");
        if (status != 1 && status != 2) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_STATUS_INVALID",
                    "类型状态只能是启用或停用。");
        }
        BigDecimal sortnum = decimalValue(source.getParam("sortnum"), "sortnum");
        // 规范化后的固定顺序映射只供 Repository 绑定值，不参与 SQL 标识符拼接。
        CommonParam values = new CommonParam();
        // 当前租户来自基础 Service 身份入口，不读取或信任前端同名字段。
        values.putParam("tenantId", getCurrentTenantId());
        // 当前操作员来自基础 Service 身份入口，不读取或信任前端同名字段。
        values.putParam("lastOperateUserId", getCurrentOperatorId());
        values.putParam("projectCode", projectCode);
        values.putParam("resourceCode", resourceCode);
        values.putParam("type", type);
        values.putParam("nameZh", nameZh);
        values.putParam("nameJa", optionalText(source.getParam("nameJa"), 120, "nameJa"));
        values.putParam("nameEn", optionalText(source.getParam("nameEn"), 120, "nameEn"));
        values.putParam("descriptionZh", optionalText(source.getParam("descriptionZh"), 500, "descriptionZh"));
        values.putParam("descriptionJa", optionalText(source.getParam("descriptionJa"), 500, "descriptionJa"));
        values.putParam("descriptionEn", optionalText(source.getParam("descriptionEn"), 500, "descriptionEn"));
        values.putParam("multiple", booleanValue(source.getParam("multiple"), false));
        values.putParam("searchable", booleanValue(source.getParam("searchable"), false));
        values.putParam("clearable", booleanValue(source.getParam("clearable"), true));
        values.putParam("attributesJson", optionalText(source.getParam("attributesJson"), 10000, "attributesJson"));
        values.putParam("status", status);
        values.putParam("sortnum", sortnum);
        return values;
    }

    /**
     * 把动态请求值转换为明确布尔值。
     * 真实传参示例：值为 {@code "true"}，默认值为 {@code false}。
     * 真实返回示例：返回 {@code true}；值为空时返回调用方给定默认值。
     * 异常或副作用示例：值不是 true/false 时抛出业务异常，不修改请求参数。
     *
     * @param value 前端布尔值或字符串布尔值
     * @param defaultValue 未传值时使用的业务默认值
     * @return 规范化后的布尔值
     */
    private boolean booleanValue(Object value, boolean defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        String normalized = String.valueOf(value).trim();
        if ("true".equalsIgnoreCase(normalized) || "1".equals(normalized)) {
            return true;
        }
        if ("false".equalsIgnoreCase(normalized) || "0".equals(normalized)) {
            return false;
        }
        throw new CommonBusinessException(
                "REFERENCE_DATA_BOOLEAN_INVALID",
                "布尔字段只能使用 true 或 false。");
    }

    /**
     * 校验项目与资源组成的稳定坐标未被占用。
     *
     * @param values 已规范化字段，例如 {@code {"projectCode":"cms","resourceCode":"article-category"}}
     * @param excludedId 更新时排除的当前主键，例如 {@code 2}；新增时为空
     * 执行结果示例：坐标空闲时继续保存；已存在时抛出
     *     {@code CommonBusinessException("REFERENCE_DATA_TYPE_DUPLICATE", "项目下已存在相同资源编码。")}
     */
    private void validateUniqueCoordinate(CommonParam values, Long excludedId) {
        String projectCode = String.valueOf(values.getParam("projectCode"));
        String resourceCode = String.valueOf(values.getParam("resourceCode"));
        if (getDao().existsCoordinate(projectCode, resourceCode, excludedId)) {
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
        Map<String, Object> record = getDao().getById(idParam(id));
        if (record == null) {
            throw notFound(id);
        }
        return record;
    }

    private CommonParam idParam(long id) {
        CommonParam queryIn = new CommonParam();
        queryIn.putParam("id", id);
        return queryIn;
    }

    private long requiredId(Object value) {
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException exception) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_ID_INVALID",
                    "类型主键必须是数字。",
                    exception);
        }
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
