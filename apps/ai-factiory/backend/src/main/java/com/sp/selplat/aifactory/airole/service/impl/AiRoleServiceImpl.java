package com.sp.selplat.aifactory.airole.service.impl;

import com.sp.selplat.aifactory.airole.dao.AiRoleDao;
import com.sp.selplat.aifactory.airole.service.AiRoleService;
import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.service.logging.OperationLog;
import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 绑定 AiRole 固定表 DAO 与公共业务实现。 */
@Service
public class AiRoleServiceImpl extends BaseServiceImpl<AiRoleDao> implements AiRoleService {

    private static final Set<String> EDITABLE_FIELDS = Set.of(
            "id", "roleName", "roleType", "experienceLevel", "specialty");
    private static final Set<String> ROLE_TYPES = Set.of("ENGINEER", "REVIEWER");
    private static final Set<String> EXPERIENCE_LEVELS = Set.of("EXPERIENCED", "INEXPERIENCED");

    /** {@inheritDoc} */
    @Override
    @OperationLog
    public CommonResult updateRole(CommonParam saveIn) {
        Map<String, Object> source = requireParameters(saveIn, "AI_ROLE_EDIT_REQUIRED", "角色编辑参数不能为空。");
        if (!EDITABLE_FIELDS.containsAll(source.keySet())) {
            throw new CommonBusinessException("AI_ROLE_EDIT_FIELD_FORBIDDEN", "角色编辑包含未开放字段。");
        }
        long id = positiveId(source.get("id"));
        CommonParam identity = new CommonParam();
        identity.putParam("id", id);
        Map<String, Object> currentRole = getDao().getById(identity);
        if (currentRole == null || currentRole.isEmpty()) {
            throw new CommonBusinessException("AI_ROLE_NOT_FOUND", "角色不存在或已经删除。");
        }
        if (isStructureRole(currentRole)) {
            throw new CommonBusinessException("AI_ROLE_EDIT_STRUCTURE_FORBIDDEN", "角色类型、工程师和审核员结构节点不能编辑。");
        }
        String roleName = requiredText(source.get("roleName"), 120, "角色名称");
        String roleType = enumValue(source.get("roleType"), ROLE_TYPES, "AI_ROLE_TYPE_INVALID", "角色类型");
        String experienceLevel = enumValue(
                source.get("experienceLevel"), EXPERIENCE_LEVELS,
                "AI_ROLE_EXPERIENCE_INVALID", "经验级别");
        String specialty = optionalText(source.get("specialty"), 200, "专业范围");

        CommonParam normalized = new CommonParam();
        normalized.putParam("id", id);
        normalized.putParam("roleName", roleName);
        normalized.putParam("roleType", roleType);
        // 角色类型与树父分类必须同步，禁止出现审核员仍挂在工程师分类下的矛盾结构。
        normalized.putParam("parentId", "REVIEWER".equals(roleType) ? 100002L : 100001L);
        normalized.putParam("experienceLevel", experienceLevel);
        // 经验级别与连接池是一条稳定策略，页面不允许产生相互冲突的组合。
        normalized.putParam("codexPoolType", "EXPERIENCED".equals(experienceLevel) ? "PERSISTENT" : "DISPOSABLE");
        normalized.putParam("specialty", specialty);
        return super.update(normalized);
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(transactionManager = "aiFactoryTransactionManager")
    @OperationLog
    public CommonResult deleteRole(CommonParam deleteIn) {
        Map<String, Object> source = requireParameters(
                deleteIn, "AI_ROLE_DELETE_REQUIRED", "角色删除参数不能为空。");
        if (!source.keySet().equals(Set.of("id"))) {
            throw new CommonBusinessException("AI_ROLE_DELETE_FIELD_FORBIDDEN", "角色删除只允许提交主键。");
        }
        long id = positiveId(source.get("id"));
        CommonParam normalized = new CommonParam();
        normalized.putParam("id", id);
        Map<String, Object> role = getDao().getById(normalized);
        if (role == null || role.isEmpty() || "0".equals(String.valueOf(role.get("status")))) {
            throw new CommonBusinessException("AI_ROLE_NOT_FOUND", "角色不存在或已经删除。");
        }
        String roleCode = String.valueOf(role.get("roleCode"));
        if (isStructureRole(role)) {
            throw new CommonBusinessException("AI_ROLE_DELETE_ROOT_FORBIDDEN", "角色根节点和分类节点不能删除。");
        }
        if (getDao().hasActiveChildren(id)) {
            throw new CommonBusinessException("AI_ROLE_DELETE_HAS_CHILDREN", "该角色仍有子角色，请先处理子角色。");
        }
        if (getDao().hasRegisteredVersion(roleCode)) {
            throw new CommonBusinessException("AI_ROLE_DELETE_IN_USE", "该角色已登记 Agent 或被任务使用，不能删除。");
        }
        return super.delete(normalized);
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(transactionManager = "aiFactoryTransactionManager")
    @OperationLog
    public CommonResult reorderRoles(CommonBatchParam reorderIn) {
        if (reorderIn == null || reorderIn.getItems().isEmpty()) {
            throw new CommonBusinessException("AI_ROLE_REORDER_REQUIRED", "角色排序必须包含完整角色顺序。");
        }
        CommonPageParam query = new CommonPageParam();
        query.setPageSize(1000);
        Set<Long> currentIds = new LinkedHashSet<>();
        Map<String, Set<Long>> currentIdsByType = new LinkedHashMap<>();
        for (Map<String, Object> record : super.getStore(query).getRecords()) {
            if (!"0".equals(String.valueOf(record.get("status"))) && !isStructureRole(record)) {
                long currentId = positiveId(record.get("id"));
                currentIds.add(currentId);
                currentIdsByType.computeIfAbsent(String.valueOf(record.get("roleType")), key -> new LinkedHashSet<>())
                        .add(currentId);
            }
        }

        Set<Long> submittedIds = new LinkedHashSet<>();
        List<CommonParam> normalizedItems = new ArrayList<>(reorderIn.getItems().size());
        for (int index = 0; index < reorderIn.getItems().size(); index++) {
            CommonParam item = reorderIn.getItems().get(index);
            Map<String, Object> parameters = requireParameters(
                    item, "AI_ROLE_REORDER_ITEM_INVALID", "角色排序项不能为空。");
            if (!parameters.keySet().equals(Set.of("id"))) {
                throw new CommonBusinessException("AI_ROLE_REORDER_FIELD_FORBIDDEN", "角色排序项只允许提交主键。");
            }
            long id = positiveId(parameters.get("id"));
            if (!submittedIds.add(id)) {
                throw new CommonBusinessException("AI_ROLE_REORDER_DUPLICATE", "角色排序不能包含重复主键。");
            }
            CommonParam normalized = new CommonParam();
            normalized.putParam("id", id);
            normalized.putParam("sortnum", (index + 1) * 10);
            normalizedItems.add(normalized);
        }
        boolean completeRoleType = currentIdsByType.values().stream().anyMatch(submittedIds::equals);
        if (!submittedIds.equals(currentIds) && !completeRoleType) {
            throw new CommonBusinessException(
                    "AI_ROLE_REORDER_INCOMPLETE", "角色排序必须包含当前全部角色或当前类型的全部角色。");
        }
        CommonBatchParam normalizedBatch = new CommonBatchParam();
        normalizedBatch.setItems(normalizedItems);
        return super.updateBatch(normalizedBatch);
    }

    /**
     * 读取非空动态参数映射。
     * 真实传参示例：{@code {id:100010,roleName:"需求分析师"}}。
     * 真实返回示例：返回同一参数对象中的有序字段映射。
     * 异常或副作用示例：参数为空时抛出调用方指定错误；不修改原参数。
     *
     * @param input 通用动态参数
     * @param errorCode 空参数业务错误编码
     * @param message 空参数安全提示
     * @return 非空参数映射
     */
    private Map<String, Object> requireParameters(CommonParam input, String errorCode, String message) {
        if (input == null || input.getParamMap() == null || input.getParamMap().isEmpty()) {
            throw new CommonBusinessException(errorCode, message);
        }
        return input.getParamMap();
    }

    /**
     * 判断记录是否为固定角色树结构节点。
     * 真实传参示例：{@code {parentId:100000,roleCode:"ENGINEER_ROOT"}}。
     * 真实返回示例：角色类型、工程师或审核员分类节点返回 {@code true}，需求分析师返回 {@code false}。
     * 异常或副作用示例：空映射返回 false；方法不访问数据库也不修改记录。
     *
     * @param role 角色数据库记录
     * @return 是否为不可编辑删除排序的结构节点
     */
    private boolean isStructureRole(Map<String, Object> role) {
        if (role == null || role.isEmpty()) return false;
        String roleCode = String.valueOf(role.get("roleCode"));
        return role.get("parentId") == null || roleCode.endsWith("_ROOT");
    }

    /**
     * 把主键转换为正整数。
     * 真实传参示例：{@code "100010"}。
     * 真实返回示例：返回 {@code 100010L}。
     * 异常或副作用示例：空值、非数字或零负数抛出 {@code AI_ROLE_ID_INVALID}；不访问数据库。
     *
     * @param value 外部主键值
     * @return 正整数主键
     */
    private long positiveId(Object value) {
        try {
            long id = Long.parseLong(String.valueOf(value));
            if (id > 0) return id;
        } catch (NumberFormatException ignored) {
            // 非数字与零负数统一进入同一个稳定业务错误。
        }
        throw new CommonBusinessException("AI_ROLE_ID_INVALID", "角色主键必须是正整数。");
    }

    /**
     * 校验必填文本并按数据库字段长度阻断溢出。
     * 真实传参示例：{@code "需求分析师"}、最大长度 {@code 120}。
     * 真实返回示例：返回去除首尾空白的 {@code "需求分析师"}。
     * 异常或副作用示例：空值或超长值抛出稳定业务错误；不修改输入对象。
     *
     * @param value 外部文本值
     * @param maxLength 数据库允许的最大长度
     * @param fieldLabel 中文字段名称
     * @return 已规范化的非空文本
     */
    private String requiredText(Object value, int maxLength, String fieldLabel) {
        String text = value == null ? "" : String.valueOf(value).trim();
        if (text.isEmpty() || text.length() > maxLength) {
            throw new CommonBusinessException("AI_ROLE_TEXT_INVALID", fieldLabel + "不能为空且不能超过" + maxLength + "字。");
        }
        return text;
    }

    /**
     * 校验可选文本长度。
     * 真实传参示例：{@code "需求质量"}、最大长度 {@code 200}。
     * 真实返回示例：返回 {@code "需求质量"}；空值返回空字符串。
     * 异常或副作用示例：超长值抛出 {@code AI_ROLE_TEXT_INVALID}；不访问数据库。
     *
     * @param value 外部可选文本
     * @param maxLength 数据库允许的最大长度
     * @param fieldLabel 中文字段名称
     * @return 已规范化的可选文本
     */
    private String optionalText(Object value, int maxLength, String fieldLabel) {
        String text = value == null ? "" : String.valueOf(value).trim();
        if (text.length() > maxLength) {
            throw new CommonBusinessException("AI_ROLE_TEXT_INVALID", fieldLabel + "不能超过" + maxLength + "字。");
        }
        return text;
    }

    /**
     * 校验稳定枚举值。
     * 真实传参示例：{@code "ENGINEER"} 与允许集合 {@code [ENGINEER,REVIEWER]}。
     * 真实返回示例：返回大写稳定值 {@code "ENGINEER"}。
     * 异常或副作用示例：未知值抛出调用方指定业务错误；不修改数据库。
     *
     * @param value 外部枚举值
     * @param allowed 当前允许集合
     * @param errorCode 非法值业务错误编码
     * @param fieldLabel 中文字段名称
     * @return 已验证稳定枚举值
     */
    private String enumValue(Object value, Set<String> allowed, String errorCode, String fieldLabel) {
        String normalized = value == null ? "" : String.valueOf(value).trim().toUpperCase();
        if (!allowed.contains(normalized)) {
            throw new CommonBusinessException(errorCode, fieldLabel + "不在允许范围内。");
        }
        return normalized;
    }
}
