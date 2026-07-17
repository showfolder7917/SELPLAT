package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.service.sequence.SequenceGenerator;
import com.sp.selplat.common.support.CommonHashSupport;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.uniauth.user.dao.UniauthUserDao;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

// 用户服务实现统一把共通入参转换成用户主表可落库字段，同时继续复用 common-db 的公共分页与简单 CRUD 能力。
@Service
public class UniauthUserServiceImpl extends BaseServiceImpl implements UniauthUserService {

    // USER_ID_SEQ_CODE 固定标记统一认证用户主键号段编码，供新增用户时从公共发号服务申请主键。
    private static final String USER_ID_SEQ_CODE = "UniauthUserId";
    // COMMON_DATE_TIME_FORMATTERS 统一兼容常见日期时间文本格式，避免共通入参在不同提交方式下出现解析口径分裂。
    private static final List<DateTimeFormatter> COMMON_DATE_TIME_FORMATTERS = List.of(
        DateTimeFormatter.ISO_LOCAL_DATE_TIME,
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
        DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm:ss")
    );

    // 用户 DAO 当前统一承接列表、详情和单表写入动作，服务层只负责业务校验和字段整理。
    private final UniauthUserDao uniauthUserDao;
    // 公共发号服务统一负责按模块编码申请新主键，避免主键生成逻辑散落在业务服务中。
    private final SequenceGenerator sequenceGenerator;

    // 构造用户服务实现时注入统一 DAO 和公共发号服务，让列表、详情和写入都走同一套共通能力。
    public UniauthUserServiceImpl(UniauthUserDao uniauthUserDao, SequenceGenerator sequenceGenerator) {
        // 保存统一 DAO，供当前模块复用 common-db 的单表 CRUD 和分页查询能力。
        this.uniauthUserDao = uniauthUserDao;
        // 保存公共发号服务，供新增用户时统一申请模块号段主键。
        this.sequenceGenerator = sequenceGenerator;
    }

    // store 兼容接口在服务层只负责查询分页数据，旧式页面需要的顶层 JSON 结构统一交给控制层组装。
    @Override
    public CommonPageResult getStore(CommonPageParam queryIn) {
        // 控制层在极端手工调用场景下若未传对象，这里补一个默认共通参数，保证后续分页查询仍有稳定默认值。
        if (queryIn == null) {
            queryIn = new CommonPageParam();
        }
        // 先通过 DAO 调用 common-db 公共分页查询，确保当前接口直接复用统一分页和动态条件能力。
        return uniauthUserDao.getStorePage(queryIn);
    }

    // 详情查询统一使用共通入参读取主键，再按共通返回对象回传有效用户数据。
    @Override
    public CommonResult getById(CommonParam queryIn) {
        // 先把调用方传入的共通对象规范化，保证后续主键读取逻辑有稳定容器可用。
        CommonParam finalQueryIn = normalizeCommonParam(queryIn);
        // 详情接口必须显式传入主键，避免误把空查询打成全量详情请求。
        Long id = getRequiredLong(finalQueryIn, "id", "按主键查询用户时必须传入 id。");
        // 只返回仍然有效的用户记录，假删除或不存在的数据统一按未找到处理。
        Map<String, Object> userRecord = uniauthUserDao.getUserById(id);
        if (userRecord == null) {
            throw new IllegalArgumentException("未找到对应的有效用户: " + id);
        }
        // 统一按共通返回对象回传详情数据，保持模块对外单条查询出口一致。
        return buildSuccessResult(userRecord, "用户详情查询完成。");
    }

    // 新增用户统一使用共通入参承接字段，再由服务层生成主键、密码摘要和默认状态。
    @Override
    public CommonResult create(CommonParam saveIn) {
        // 先把调用方传入的共通对象规范化，保证后续字段读取和校验逻辑都围绕同一对象执行。
        CommonParam finalSaveIn = normalizeCommonParam(saveIn);
        // 登录账号在有效用户范围内必须唯一，避免新增后认证入口出现账号冲突。
        String loginName = getRequiredString(finalSaveIn, "loginName", "新增用户时必须传入 loginName。");
        Map<String, Object> existedUser = uniauthUserDao.getUserByLoginName(loginName);
        if (existedUser != null) {
            throw new IllegalArgumentException("登录账号已存在: " + loginName);
        }
        // 新增主键统一走公共号段服务申请，保证当前模块和后续模块都复用同一套主键分配策略。
        Long userId = sequenceGenerator.nextId(USER_ID_SEQ_CODE);
        // 把共通入参整理成当前用户表的新增列值映射，供 DAO 直接执行单表 insert。
        Map<String, Object> columnValueMap = buildCreateColumnValueMap(finalSaveIn, userId, loginName);
        int affectedRows = uniauthUserDao.insertUser(columnValueMap);
        if (affectedRows != 1) {
            throw new IllegalStateException("新增用户失败，实际写入行数: " + affectedRows);
        }
        // 新增成功后回查最新详情，保证控制层回传的是数据库最终落库结果而不是半成品请求对象。
        Map<String, Object> createdUser = uniauthUserDao.getUserById(userId);
        return buildSuccessResult(createdUser, "用户新增完成。");
    }

    // 更新用户统一只回写本次显式传入的业务字段，避免共通入参未带出的字段被误刷成空值。
    @Override
    public CommonResult update(CommonParam saveIn) {
        // 先把调用方传入的共通对象规范化，保证后续主键、状态和字段校验都围绕同一对象执行。
        CommonParam finalSaveIn = normalizeCommonParam(saveIn);
        // 更新接口必须显式传入主键，避免把无主键的保存请求误处理成更新。
        Long id = getRequiredLong(finalSaveIn, "id", "更新用户时必须传入 id。");
        // 只有仍然有效的用户记录允许继续更新，避免假删除记录被重新改写。
        Map<String, Object> existedUser = uniauthUserDao.getUserById(id);
        if (existedUser == null) {
            throw new IllegalArgumentException("未找到可更新的有效用户: " + id);
        }
        // 更新列值映射只承接本次显式传入的字段，同时统一补最近操作人和更新时间。
        Map<String, Object> columnValueMap = buildUpdateColumnValueMap(finalSaveIn, existedUser);
        int affectedRows = uniauthUserDao.updateUser(id, columnValueMap);
        if (affectedRows != 1) {
            throw new IllegalStateException("更新用户失败，实际更新行数: " + affectedRows);
        }
        // 更新成功后回查数据库最终记录，保证回参与真实落库状态一致。
        Map<String, Object> updatedUser = uniauthUserDao.getUserById(id);
        return buildSuccessResult(updatedUser, "用户更新完成。");
    }

    // 删除用户统一执行假删除，把 status 更新为 0，并回传本次删除动作的关键结果。
    @Override
    public CommonResult delete(CommonParam deleteIn) {
        // 先把调用方传入的共通对象规范化，保证主键和操作人字段都有统一读取入口。
        CommonParam finalDeleteIn = normalizeCommonParam(deleteIn);
        // 假删除接口必须显式传入主键，避免误把空删除请求打到数据库。
        Long id = getRequiredLong(finalDeleteIn, "id", "删除用户时必须传入 id。");
        // 假删除动作必须记录最近操作用户，保证主表可直接回看最后执行删除的人。
        Long lastOperateUserId = getRequiredLong(finalDeleteIn, "lastOperateUserId", "删除用户时必须传入 lastOperateUserId。");
        // 只有仍然有效的用户记录允许继续删除，避免重复删除把调用结果变得不确定。
        Map<String, Object> existedUser = uniauthUserDao.getUserById(id);
        if (existedUser == null) {
            throw new IllegalArgumentException("未找到可删除的有效用户: " + id);
        }
        int affectedRows = uniauthUserDao.softDeleteUser(id, lastOperateUserId);
        if (affectedRows != 1) {
            throw new IllegalStateException("删除用户失败，实际更新行数: " + affectedRows);
        }
        // 删除结果只回传本次动作最关键的主键、状态和最近操作人，避免回显已被过滤的整条假删除记录。
        return buildSuccessResult(buildDeleteResultData(id, lastOperateUserId), "用户删除完成。");
    }

    // 新增列值映射统一在服务层补齐主键、默认状态、默认业务状态和口令摘要，避免 DAO 感知业务规则。
    private Map<String, Object> buildCreateColumnValueMap(CommonParam saveIn, Long userId, String loginName) {
        // 使用有序映射承接新增字段，保证后续阅读和排查时字段顺序稳定。
        Map<String, Object> columnValueMap = new LinkedHashMap<>();
        // id 固定使用服务层申请到的模块主键，保证运行时新增不再依赖数据库自增。
        columnValueMap.put("id", userId);
        // tenantId 是用户主表强制字段，必须在新增时显式落库。
        columnValueMap.put("tenantId", getRequiredLong(saveIn, "tenantId", "新增用户时必须传入 tenantId。"));
        // lastOperateUserId 在主表中必须存在，用于记录本次创建动作的责任用户。
        columnValueMap.put("lastOperateUserId", getRequiredLong(saveIn, "lastOperateUserId", "新增用户时必须传入 lastOperateUserId。"));
        // loginName 使用已完成唯一性校验的稳定账号，供认证入口后续直接检索。
        columnValueMap.put("loginName", loginName);
        // passwordHash 统一按共通哈希工具生成摘要，避免数据库落明文密码。
        columnValueMap.put("passwordHash", CommonHashSupport.sha256(getRequiredString(saveIn, "password", "新增用户时必须传入 password。")));
        // displayName 属于必填展示名，便于新增后列表和详情页面直接显示。
        columnValueMap.put("displayName", getRequiredString(saveIn, "displayName", "新增用户时必须传入 displayName。"));
        // displayNameKana 属于可选补充字段，日语场景下可按需写入假名。
        putIfParamPresent(columnValueMap, "displayNameKana", saveIn, "displayNameKana");
        // locale 可按调用方传值覆盖，也可以依赖数据库默认值。
        putIfParamPresent(columnValueMap, "locale", saveIn, "locale");
        // email 为可选资料字段，只有调用方显式传入时才落库。
        putIfParamPresent(columnValueMap, "email", saveIn, "email");
        // phone 为可选资料字段，只有调用方显式传入时才落库。
        putIfParamPresent(columnValueMap, "phone", saveIn, "phone");
        // userStatus 未显式传值时默认 ACTIVE，保持新账号创建后可直接进入有效状态。
        columnValueMap.put("userStatus", hasParam(saveIn, "userStatus") ? getRequiredString(saveIn, "userStatus", "新增用户时传入的 userStatus 不能为空。") : "ACTIVE");
        // lockedFlag 未显式传值时默认 false，避免新账号创建后被意外锁定。
        columnValueMap.put("lockedFlag", hasParam(saveIn, "lockedFlag") ? toBoolean(getParam(saveIn, "lockedFlag")) : Boolean.FALSE);
        // expiredAt 为可选到期时间，只有调用方显式传入时才落库。
        if (hasParam(saveIn, "expiredAt")) {
            columnValueMap.put("expiredAt", toLocalDateTime(getParam(saveIn, "expiredAt"), "expiredAt"));
        }
        // sortnum 未显式传值时默认 0，保持列表排序字段在数据库层始终满足非空约束。
        columnValueMap.put("sortnum", hasParam(saveIn, "sortnum") ? toBigDecimal(getParam(saveIn, "sortnum"), "sortnum") : BigDecimal.ZERO);
        // status 按当前统一约定默认保存为 1，确保新增用户默认处于有效可见状态。
        columnValueMap.put("status", 1);
        // 创建时间与更新时间在服务层同步写入，便于回显时立即拿到完整审计字段。
        LocalDateTime now = LocalDateTime.now();
        columnValueMap.put("createdAt", now);
        columnValueMap.put("updatedAt", now);
        return columnValueMap;
    }

    // 更新列值映射只回写本次显式传入字段，避免共通参数对象未带出的字段被误清空。
    private Map<String, Object> buildUpdateColumnValueMap(CommonParam saveIn, Map<String, Object> existedUser) {
        // 使用有序映射承接本次待更新字段，保证字段顺序和业务动作阅读起来都更清晰。
        Map<String, Object> columnValueMap = new LinkedHashMap<>();
        // lastOperateUserId 是本次修改动作必须回写的审计字段，便于主表回看最近修改责任人。
        columnValueMap.put("lastOperateUserId", getRequiredLong(saveIn, "lastOperateUserId", "更新用户时必须传入 lastOperateUserId。"));
        // updatedAt 统一按当前服务端时间回写，保证每次修改都能留下稳定的最后更新时间。
        columnValueMap.put("updatedAt", LocalDateTime.now());
        // tenantId 如果显式传入则按最新值回写，兼容需要修正租户归属的管理场景。
        if (hasParam(saveIn, "tenantId")) {
            columnValueMap.put("tenantId", getRequiredLong(saveIn, "tenantId", "更新用户时传入的 tenantId 不能为空。"));
        }
        // loginName 如果显式传入则重新做唯一性校验，避免更新后与其他有效账号冲突。
        if (hasParam(saveIn, "loginName")) {
            String loginName = getRequiredString(saveIn, "loginName", "更新用户时传入的 loginName 不能为空。");
            Map<String, Object> sameLoginNameUser = uniauthUserDao.getUserByLoginName(loginName);
            if (sameLoginNameUser != null && !toLong(sameLoginNameUser.get("id"), "id").equals(toLong(existedUser.get("id"), "id"))) {
                throw new IllegalArgumentException("登录账号已存在: " + loginName);
            }
            columnValueMap.put("loginName", loginName);
        }
        // password 只有显式传入且非空时才重新计算摘要，避免空字符串把原密码摘要覆盖掉。
        if (hasParam(saveIn, "password")) {
            String password = toNullableString(getParam(saveIn, "password"));
            if (password != null && !password.trim().isEmpty()) {
                columnValueMap.put("passwordHash", CommonHashSupport.sha256(password));
            }
        }
        // displayName 如果显式传入则必须保持非空，避免破坏主表必填展示名约束。
        if (hasParam(saveIn, "displayName")) {
            columnValueMap.put("displayName", getRequiredString(saveIn, "displayName", "更新用户时传入的 displayName 不能为空。"));
        }
        // 可空的展示类字段允许显式传 null 或空串，用于资料修正或清空。
        putIfParamPresent(columnValueMap, "displayNameKana", saveIn, "displayNameKana");
        putIfParamPresent(columnValueMap, "locale", saveIn, "locale");
        putIfParamPresent(columnValueMap, "email", saveIn, "email");
        putIfParamPresent(columnValueMap, "phone", saveIn, "phone");
        // userStatus 如果显式传入则必须给出有效非空值，避免把业务状态改成空字符串。
        if (hasParam(saveIn, "userStatus")) {
            columnValueMap.put("userStatus", getRequiredString(saveIn, "userStatus", "更新用户时传入的 userStatus 不能为空。"));
        }
        // lockedFlag 如果显式传入则统一转换成布尔值后回写，保证数据库里锁定语义稳定。
        if (hasParam(saveIn, "lockedFlag")) {
            columnValueMap.put("lockedFlag", toBoolean(getParam(saveIn, "lockedFlag")));
        }
        // expiredAt 如果显式传入则统一解析成 LocalDateTime，支持清空或重新指定到期时间。
        if (hasParam(saveIn, "expiredAt")) {
            columnValueMap.put("expiredAt", toLocalDateTime(getParam(saveIn, "expiredAt"), "expiredAt"));
        }
        // sortnum 如果显式传入则统一解析成数值，保持排序字段类型稳定。
        if (hasParam(saveIn, "sortnum")) {
            columnValueMap.put("sortnum", toBigDecimal(getParam(saveIn, "sortnum"), "sortnum"));
        }
        // 除去 lastOperateUserId 和 updatedAt 后若没有任何业务字段需要更新，则直接阻断无效更新请求。
        if (columnValueMap.size() == 2) {
            throw new IllegalArgumentException("更新用户时至少传入一个需要修改的业务字段。");
        }
        return columnValueMap;
    }

    // 删除结果统一回传主键、最新状态和最近操作用户，便于前端直接确认假删除已生效。
    private Map<String, Object> buildDeleteResultData(Long id, Long lastOperateUserId) {
        // 使用有序映射组装删除结果，保证前端和日志看到的字段顺序稳定可读。
        Map<String, Object> deleteResultData = new LinkedHashMap<>();
        deleteResultData.put("id", id);
        deleteResultData.put("status", 0);
        deleteResultData.put("lastOperateUserId", lastOperateUserId);
        return deleteResultData;
    }

    // 成功返回对象统一在服务层先补 success、data 和 msg，控制层再补模块编码和 requestPath。
    private CommonResult buildSuccessResult(Object data, String message) {
        // 新建共通返回对象，统一沉淀当前非分页接口的业务数据和提示文案。
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setData(data);
        result.setMsg(message);
        return result;
    }

    // 共通入参为空时统一补默认对象，避免后续字段读取逻辑反复判空。
    private CommonParam normalizeCommonParam(CommonParam inputParam) {
        return inputParam == null ? new CommonParam() : inputParam;
    }

    // 判断调用方是否显式传入某个业务字段，供更新接口实现“只更新传入字段”的语义。
    private boolean hasParam(CommonParam inputParam, String key) {
        return inputParam != null && inputParam.getParamMap() != null && inputParam.getParamMap().containsKey(key);
    }

    // 读取动态业务字段原始值，供统一转换工具按字段名做类型解析和校验。
    private Object getParam(CommonParam inputParam, String key) {
        return inputParam == null ? null : inputParam.getParam(key);
    }

    // 强制读取 Long 类型字段，适用于主键、租户和最近操作人这类业务必填数值。
    private Long getRequiredLong(CommonParam inputParam, String key, String errorMessage) {
        Object rawValue = getParam(inputParam, key);
        if (rawValue == null) {
            throw new IllegalArgumentException(errorMessage);
        }
        return toLong(rawValue, key);
    }

    // 强制读取非空字符串字段，适用于登录账号、展示名和业务状态等必填文本字段。
    private String getRequiredString(CommonParam inputParam, String key, String errorMessage) {
        String stringValue = toNullableString(getParam(inputParam, key));
        if (stringValue == null || stringValue.trim().isEmpty()) {
            throw new IllegalArgumentException(errorMessage);
        }
        return stringValue.trim();
    }

    // 可选字符串字段只有在调用方显式传入时才写入待更新映射，支持清空和资料修正场景。
    private void putIfParamPresent(Map<String, Object> targetMap, String targetKey, CommonParam inputParam, String sourceKey) {
        if (hasParam(inputParam, sourceKey)) {
            targetMap.put(targetKey, toNullableString(getParam(inputParam, sourceKey)));
        }
    }

    // 任意主键或数值字段统一转换成 Long，兼容 JSON 数字、字符串数字和数据库回读数字类型。
    private Long toLong(Object rawValue, String fieldName) {
        if (rawValue == null) {
            return null;
        }
        try {
            return rawValue instanceof Number numberValue ? numberValue.longValue() : Long.valueOf(String.valueOf(rawValue).trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(fieldName + " 不是合法的 Long 值: " + rawValue, exception);
        }
    }

    // 任意排序值统一转换成 BigDecimal，兼容数值和字符串两种常见提交方式。
    private BigDecimal toBigDecimal(Object rawValue, String fieldName) {
        if (rawValue == null) {
            return null;
        }
        try {
            if (rawValue instanceof BigDecimal bigDecimalValue) {
                return bigDecimalValue;
            }
            if (rawValue instanceof Number numberValue) {
                return BigDecimal.valueOf(numberValue.doubleValue());
            }
            return new BigDecimal(String.valueOf(rawValue).trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(fieldName + " 不是合法的数值: " + rawValue, exception);
        }
    }

    // 任意布尔字段统一转换成 Boolean，兼容布尔、数字和字符串提交方式。
    private Boolean toBoolean(Object rawValue) {
        if (rawValue == null) {
            return null;
        }
        if (rawValue instanceof Boolean booleanValue) {
            return booleanValue;
        }
        if (rawValue instanceof Number numberValue) {
            return numberValue.intValue() != 0;
        }
        String stringValue = String.valueOf(rawValue).trim();
        if ("1".equals(stringValue)) {
            return true;
        }
        if ("0".equals(stringValue)) {
            return false;
        }
        return Boolean.valueOf(stringValue);
    }

    // 日期时间字段统一兼容 ISO、本地常用横杠格式和历史斜杠格式，减少共通入参接入摩擦。
    private LocalDateTime toLocalDateTime(Object rawValue, String fieldName) {
        if (rawValue == null) {
            return null;
        }
        if (rawValue instanceof LocalDateTime localDateTimeValue) {
            return localDateTimeValue;
        }
        String stringValue = toNullableString(rawValue);
        if (stringValue == null || stringValue.trim().isEmpty()) {
            return null;
        }
        for (DateTimeFormatter formatter : COMMON_DATE_TIME_FORMATTERS) {
            try {
                return LocalDateTime.parse(stringValue.trim(), formatter);
            } catch (DateTimeParseException exception) {
                // 当前格式不匹配时继续尝试下一个约定格式，直到全部格式都失败再统一抛错。
            }
        }
        throw new IllegalArgumentException(fieldName + " 不是合法的日期时间: " + rawValue);
    }

    // 任意对象统一转换成可空字符串，供资料类字段按原样写入或清空。
    private String toNullableString(Object rawValue) {
        return rawValue == null ? null : String.valueOf(rawValue);
    }
}
