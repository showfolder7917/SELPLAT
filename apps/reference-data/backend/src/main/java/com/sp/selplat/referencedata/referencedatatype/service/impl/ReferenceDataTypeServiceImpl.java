package com.sp.selplat.referencedata.referencedatatype.service.impl;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.referencedata.common.util.code.ReferenceDataCodeServiceImpl;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.referencedata.common.persistence.ReferenceDataBaseDao;
import com.sp.selplat.referencedata.common.util.ReferenceDataQueryUtil;
import com.sp.selplat.referencedata.referencedatatype.dao.ReferenceDataTypeDao;
import com.sp.selplat.referencedata.referencedatatype.service.ReferenceDataTypeService;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 编排引用数据类型管理业务，负责共享选项组发号、父级关系、类型值唯一性和统一返回结构。
 * 数据库差异留在 DAO，HTTP 表达留在 Controller。
 */
@Service
public class ReferenceDataTypeServiceImpl
        extends ReferenceDataCodeServiceImpl<ReferenceDataTypeDao>
        implements ReferenceDataTypeService {

    private static final String OPTION_SET_PREFIX = "optionSet";

    private final SequenceGenerator sequenceGenerator;

    /**
     * 装配共享逻辑对象发号能力。
     * 真实传参示例：Spring 注入 {@code SequenceGeneratorImpl}。
     * 真实返回示例：新增首个选项且未传 optionSetCode 时可生成 {@code optionSet107000}。
     * 异常或副作用示例：ReferenceDataObjectId 号段缺失时新增失败，不会写入半条类型记录。
     *
     * @param sequenceGenerator 公共数据库号段发号器
     */
    public ReferenceDataTypeServiceImpl(SequenceGenerator sequenceGenerator) {
        this.sequenceGenerator = sequenceGenerator;
    }

    /**
     * 将数据类型记录编码标记为 type，数字部分由 ReferenceDataType 自己的主键号段生成。
     * 真实传参示例：{@code {"optionSetCode":"optionSet107000","valueCode":"DROPDOWN"}}。
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

    /**
     * 返回类型目录所属应用域；具体控件通过 optionSetCode 复用，不再反向决定类型记录归属。
     * 真实传参示例：{@code {"optionSetCode":"optionSet107000","valueCode":"DROPDOWN"}}。
     * 真实返回示例：返回 {@code reference-data}。
     * 异常或副作用示例：本方法不查询控件或修改数据库。
     *
     * @param saveIn 已规范化的数据类型新增参数
     * @return 公共发号链使用的应用域
     */
    @Override
    protected String resolveProjectCode(CommonParam saveIn) {
        return "reference-data";
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

    /** {@inheritDoc} */
    @Override
    public CommonResult getOptionsByOptionSetCode(
            String optionSetCode, Map<String, String> parameters) {
        String requiredCode = String.valueOf(optionSetCode == null ? "" : optionSetCode).trim();
        if (!requiredCode.matches("^optionSet[1-9][0-9]{5,}$")) {
            // 空值、业务名或任意 SQL 片段 → 稳定业务错误，不进入数据库条件。
            throw new CommonBusinessException(
                    "REFERENCE_DATA_OPTION_SET_CODE_INVALID",
                    "选项组 Code 必须是 optionSet 加至少六位正整数。");
        }
        String locale = ReferenceDataQueryUtil.locale(parameters);
        CommonPageParam query = new CommonPageParam();
        query.setPageNo(1);
        query.setPageSize(1000);
        query.putParam("optionSetCode", requiredCode);
        query.putParam("status", 1);
        List<Map<String, Object>> records = super.getStore(query).getRecords();
        List<Map<String, Object>> options = new ArrayList<>(records.size());
        for (Map<String, Object> record : records) {
            // 类型记录 → 页面只消费稳定值、当前语言名称和同组选项父级，不暴露内部主键。
            Map<String, Object> option = new LinkedHashMap<>();
            option.put("code", record.get("code"));
            option.put("value", record.get("valueCode"));
            option.put("label", ReferenceDataQueryUtil.name(record, locale));
            option.put("parentCode", record.get("parentTypeCode"));
            options.add(option);
        }
        // 精确 optionSetCode 查询结果 → 同源页面可直接构造只读显示映射或下拉选项。
        return ReferenceDataQueryUtil.success(
                options,
                "/api/reference-data/options/" + requiredCode,
                "引用数据选项查询完成。");
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public CommonPageResult getStore(CommonPageParam queryIn) {
        CommonPageParam requiredQuery = queryIn == null ? new CommonPageParam() : queryIn;
        // codeLike、parentTypeCodeLike 与其他明确字段全部交给 BaseDao 使用 AND 组合。
        return super.getStore(requiredQuery);
    }

    /**
     * 按公共动态主键参数查询唯一未删除的引用数据类型，不保留平行的 long 主键入口。
     *
     * @param queryIn BaseController 传入的主键参数，例如 {@code {"id":1}}
     * @return 类型详情，例如
     *     {@code {"success":true,"data":{"id":1,"valueCode":"DROPDOWN"},"msg":"类型详情查询完成。"}}
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
        CommonParam values = normalizeValues(saveIn, true);
        validateRelations(values, null);
        validateUniqueOptionSetValue(values, null);
        // 复用公共新增链完成当前表独立发号、code 拼接、身份覆盖和 DAO 写入。
        return super.insert(values);
    }

    @Override
    @Transactional
    public CommonResult insertBatch(CommonBatchParam saveIn) {
        if (saveIn == null) {
            throw required("request", "类型保存参数不能为空。");
        }
        for (CommonParam item : saveIn.getItems()) {
            CommonParam normalized = normalizeValues(item, true);
            validateRelations(normalized, null);
            validateUniqueOptionSetValue(normalized, null);
            item.setParamMap(normalized.getParamMap());
        }
        // 批量新增逐项走当前表独立发号；未指定 optionSetCode 的条目各自创建一个新选项组。
        return super.insertBatch(saveIn);
    }

    /**
     * 按公共动态参数校验并更新一条引用数据类型，更新后返回数据库中的真实记录。
     *
     * @param saveIn BaseController 传入的主键与字段，例如
     *     {@code {"id":1,"optionSetCode":"optionSet107000","valueCode":"DROPDOWN","nameZh":"下拉框"}}
     * @return 更新后的类型，例如
     *     {@code {"success":true,"data":{"id":1,"nameZh":"引用数据资源类型"},"affectedRows":1,"msg":"类型更新完成。"}}
     * @throws CommonBusinessException id 缺失、分类重复或记录不存在时抛出，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_TYPE_NOT_FOUND", "引用数据类型不存在：1")}
     */
    @Override
    public CommonResult update(CommonParam saveIn) {
        long id = requiredId(saveIn == null ? null : saveIn.getParam("id"));
        // 先验证记录存在，避免对不存在主键执行无效果更新。
        Map<String, Object> currentRecord = requiredRecord(id);
        CommonParam values = normalizeValues(saveIn, false);
        validateRelations(values, String.valueOf(currentRecord.get("code")));
        validateUniqueOptionSetValue(values, id);
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
            Map<String, Object> currentRecord = requiredRecord(id);
            CommonParam normalized = normalizeValues(item, false);
            validateRelations(normalized, String.valueOf(currentRecord.get("code")));
            validateUniqueOptionSetValue(normalized, id);
            normalized.putParam("id", id);
            item.setParamMap(normalized.getParamMap());
        }
        return super.updateBatch(saveIn);
    }

    /**
     * 按公共动态主键参数假删除一条类型。
     *
     * @param deleteIn BaseController 传入的主键参数，例如 {@code {"id":2}}
     * @return 假删除结果，例如
     *     {@code {"success":true,"data":{"id":2,"status":0},"affectedRows":1,"msg":"类型删除完成。"}}
     * @throws CommonBusinessException id 缺失或记录不存在时抛出，例如
     *     {@code CommonBusinessException("REFERENCE_DATA_TYPE_NOT_FOUND", "未找到引用数据类型：2")}
     */
    @Override
    public CommonResult delete(CommonParam deleteIn) {
        long id = requiredId(deleteIn == null ? null : deleteIn.getParam("id"));
        requiredRecord(id);
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
            requiredRecord(requiredId(item.getParam("id")));
        }
        return super.deleteBatch(deleteIn);
    }

    /**
     * 校验并规范化类型保存字段。
     *
     * @param source 前端表单动态参数，例如
     *     {@code {"optionSetCode":"optionSet107000","valueCode":"DROPDOWN","nameZh":"下拉框"}}
     * @return 固定字段映射，例如
     *     {@code {"optionSetCode":"optionSet107000","valueCode":"DROPDOWN","nameZh":"下拉框","status":1,"sortnum":0}}
     */
    private CommonParam normalizeValues(CommonParam source, boolean allowGenerateOptionSet) {
        if (source == null) {
            throw required("request", "类型保存参数不能为空。");
        }
        String nameZh = requiredText(source.getParam("nameZh"), 120, "nameZh", "中文名称不能为空。");
        String optionSetCode = optionalText(source.getParam("optionSetCode"), 100, "optionSetCode");
        if (optionSetCode == null && allowGenerateOptionSet) {
            Long optionSetId = sequenceGenerator.nextId(ReferenceDataBaseDao.SHARED_OBJECT_ID_SEQUENCE_CODE);
            optionSetCode = OPTION_SET_PREFIX + optionSetId;
        }
        if (optionSetCode == null) {
            throw required("optionSetCode", "选项组 Code 不能为空。");
        }
        if (!optionSetCode.matches("^optionSet[1-9][0-9]{5,}$")) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_OPTION_SET_CODE_INVALID",
                    "选项组 Code 必须是 optionSet 加至少六位正整数。");
        }
        String valueCode = requiredText(
                source.getParam("valueCode"), 100, "valueCode", "类型值 Code 不能为空。").toUpperCase();
        if ("TREE".equals(valueCode)) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_VALUE_RESERVED",
                    "TREE 只属于树节点表，不能保存为数据类型。");
        }
        String parentTypeCode = optionalText(source.getParam("parentTypeCode"), 100, "parentTypeCode");
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
        values.putParam("optionSetCode", optionSetCode);
        values.putParam("valueCode", valueCode);
        values.putParam("parentTypeCode", parentTypeCode);
        values.putParam("nameZh", nameZh);
        values.putParam("nameJa", optionalText(source.getParam("nameJa"), 120, "nameJa"));
        values.putParam("nameEn", optionalText(source.getParam("nameEn"), 120, "nameEn"));
        values.putParam("status", status);
        values.putParam("sortnum", sortnum);
        return values;
    }

    /**
     * 校验同一选项组中的类型值未被占用。
     *
     * @param values 已规范化字段，例如
     *     {@code {"optionSetCode":"optionSet107000","valueCode":"DROPDOWN"}}
     * @param excludedId 更新时排除的当前主键，例如 {@code 2}；新增时为空
     * 执行结果示例：分类空闲时继续保存；已存在时抛出
     *     {@code CommonBusinessException("REFERENCE_DATA_TYPE_DUPLICATE", "已存在相同分类编码。")}
     */
    private void validateUniqueOptionSetValue(CommonParam values, Long excludedId) {
        long tenantId = Long.parseLong(String.valueOf(values.getParam("tenantId")));
        String optionSetCode = String.valueOf(values.getParam("optionSetCode"));
        String valueCode = String.valueOf(values.getParam("valueCode"));
        if (getDao().existsOptionSetValue(tenantId, optionSetCode, valueCode, excludedId)) {
            throw new CommonBusinessException(
                    "REFERENCE_DATA_TYPE_DUPLICATE",
                    "当前选项组已存在相同类型值。");
        }
    }

    /**
     * 校验父类型属于同一选项组，并阻止父级循环。
     * 真实传参示例：{@code optionSetCode=optionSet107000,parentTypeCode=type101001}。
     * 真实返回示例：父类型属于同一选项组且祖先链不含当前记录时正常返回。
     * 异常或副作用示例：跨选项组挂接或 A→B→A 循环时抛出业务异常；不修改数据库。
     *
     * @param values 已规范化的类型值字段
     * @param currentCode 更新记录的自身 code；新增时为空
     */
    private void validateRelations(CommonParam values, String currentCode) {
        String optionSetCode = String.valueOf(values.getParam("optionSetCode"));
        Object parentValue = values.getParam("parentTypeCode");
        if (parentValue == null) {
            return;
        }
        String parentCode = String.valueOf(parentValue);
        // parentTypeCode 已经 optionalText 规范化，空白值统一转为 null。
        while (parentCode != null) {
            if (parentCode.equals(currentCode)) {
                throw new CommonBusinessException(
                        "REFERENCE_DATA_TYPE_PARENT_CYCLE",
                        "上级类型不能形成循环关系。");
            }
            Map<String, Object> parent = findTypeByCode(parentCode);
            if (parent.isEmpty()) {
                throw new CommonBusinessException(
                        "REFERENCE_DATA_TYPE_PARENT_NOT_FOUND",
                        "未找到上级类型：" + parentCode);
            }
            if (!optionSetCode.equals(String.valueOf(parent.get("optionSetCode")))) {
                throw new CommonBusinessException(
                        "REFERENCE_DATA_TYPE_PARENT_OPTION_SET_MISMATCH",
                        "上级类型必须属于同一个选项组。");
            }
            Object nextParent = parent.get("parentTypeCode");
            parentCode = nextParent == null ? null : String.valueOf(nextParent);
        }
    }

    /**
     * 按 code 查询一条未删除类型值，用于父级和祖先链校验。
     * 真实传参示例：{@code type101001}。
     * 真实返回示例：返回 {@code {code:type101001,optionSetCode:optionSet107000,valueCode:DROPDOWN}}。
     * 异常或副作用示例：未命中时返回空 Map；方法不修改数据库。
     *
     * @param typeCode 类型记录公开 code
     * @return 唯一类型记录或空 Map
     */
    private Map<String, Object> findTypeByCode(String typeCode) {
        CommonPageParam query = new CommonPageParam();
        query.setPageNo(1);
        // code 受数据库唯一约束保护，只读取第一条，不在 Service 重复虚构“重复 code”分支。
        query.setPageSize(1);
        query.putParam("code", typeCode);
        query.putParam("statusIn", List.of(1, 2));
        List<Map<String, Object>> records = super.getStore(query).getRecords();
        return records.isEmpty() ? Map.of() : records.get(0);
    }

    /**
     * 查询必须存在的未删除类型记录。
     *
     * @param id 数据库主键，例如 {@code 2}
     * @return 命中的完整类型，例如 {@code {"id":2,"valueCode":"DROPDOWN","status":1}}
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
