package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import java.time.LocalDateTime;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Repository;

// 用户 DAO 实现统一承接基于 common-db 的分页查询和简单单表 CRUD，不再依赖旧 XML 的专用输出对象。
@Repository
public class UniauthUserDaoImpl extends BaseDaoImpl implements UniauthUserDao {

    // store 查询只负责把共通参数对象转换成动态条件，再交给 BaseDao 通用分页能力执行。
    @Override
    public CommonPageResult getStorePage(CommonPageParam queryIn) {
        // 先把共通参数对象中的动态字段转换成 common-db 可识别的字段映射，避免 service 层直接接触数据库列名。
        Map<String, Object> queryColumnValueMap = buildStoreQueryColumnValueMap(queryIn);
        // store 列表固定按主键倒序分页返回，保持旧页面默认展示顺序不变，同时接入 common-db 公共分页查询。
        return getPageList(queryColumnValueMap, "id desc", queryIn == null ? 1 : queryIn.getPageNo(), queryIn == null ? 20 : queryIn.getPageSize());
    }

    // // 明确把当前公共 DAO 绑定到 ua_user 表，保证 common-db 分页查询不会按类名推导到错误物理表名。
    // @Override
    // protected String getTableName() {
    //     // 当前 DAO 专门服务统一认证用户主表，所以直接返回真实物理表名 ua_user。
    //     return "ua_user";
    // }

    // 把共通参数对象中的动态字段转换成 common-db 可识别的等值或后缀条件。
    private Map<String, Object> buildStoreQueryColumnValueMap(CommonPageParam queryIn) {
        // 查询对象为空时直接返回空条件，让 store 接口回落为全量分页列表。
        if (queryIn == null) {
            return new LinkedHashMap<>();
        }
        // 使用基类复制逻辑隔离调用方原始 Map，保证 DAO 在裁剪字段时不回写控制层对象。
        Map<String, Object> queryColumnValueMap = copyColumnValueMap(queryIn.getParamMap());
        // 移除可能被误放进动态字段里的分页参数，确保 common-db 条件解析只处理真实业务字段。
        queryColumnValueMap.remove("pageNo");
        // 继续移除每页条数，避免分页元数据被误识别成表字段条件。
        queryColumnValueMap.remove("pageSize");
        // 假删除规则下列表默认只返回有效数据，避免已删除账号继续出现在 store 页面里。
        queryColumnValueMap.putIfAbsent("status", 1);
        // 返回整理后的动态查询条件，供 common-db 统一解析字段后缀和分页 SQL。
        return queryColumnValueMap;
    }

    // 按主键读取一个仍然有效的用户详情，供编辑和详情接口复用统一输出对象。
    @Override
    public Map<String, Object> getUserById(Long id) {
        // 主键为空时直接返回空，避免错误调用继续打到数据库。
        if (id == null) {
            return null;
        }
        // 先按公共主键查询拿到原始行数据，再由当前 DAO 统一转换成输出对象。
        Map<String, Object> userRecord = getByIds(List.of(id));
        // 假删除记录不再对外暴露，避免前端继续编辑或展示已删除账号。
        if (!isActiveRecord(userRecord)) {
            return null;
        }
        return userRecord;
    }

    // 按登录账号读取一个仍然有效的用户详情，供新增和更新前的唯一性校验复用。
    @Override
    public Map<String, Object> getUserByLoginName(String loginName) {
        // 登录账号为空时直接返回空，避免无意义查询干扰正常保存流程。
        if (loginName == null || loginName.trim().isEmpty()) {
            return null;
        }
        // 直接按公共分页查询能力拼一个等值查询，让当前 DAO 不必恢复整套旧 XML SQL。
        Map<String, Object> queryColumnValueMap = new LinkedHashMap<>();
        queryColumnValueMap.put("loginName", loginName.trim());
        queryColumnValueMap.put("status", 1);
        CommonPageResult pageResult = getPageList(queryColumnValueMap, "id desc", 1, 1);
        // 没查到任何有效账号时直接返回空，供服务层按“可新增”处理。
        if (pageResult.getRecords() == null || pageResult.getRecords().isEmpty()) {
            return null;
        }
        return pageResult.getRecords().get(0);
    }

    // 新增用户时直接复用 BaseDao 通用 insert，让服务层只关注业务字段准备和主键生成。
    @Override
    public int insertUser(Map<String, Object> columnValueMap) {
        return insert(columnValueMap);
    }

    // 更新用户时按主键和值映射复用 BaseDao 通用 update，统一走当前 DAO 对应表。
    @Override
    public int updateUser(Long id, Map<String, Object> columnValueMap) {
        return update(List.of(id), columnValueMap);
    }

    // 删除用户时统一执行假删除，把状态改为 0 并维护最近操作用户和更新时间。
    @Override
    public int softDeleteUser(Long id, Long lastOperateUserId) {
        // 使用有序映射组装假删除字段，保证更新字段顺序和业务含义都清晰可读。
        Map<String, Object> columnValueMap = new LinkedHashMap<>();
        // status 改为 0 表示当前账号已被逻辑删除，后续列表与详情默认不再返回。
        columnValueMap.put("status", 0);
        // 记录最近操作用户，便于后续回看是谁执行了删除动作。
        columnValueMap.put("lastOperateUserId", lastOperateUserId);
        // 更新时间统一按当前服务端时间回写，避免删除动作缺失最后变更时间。
        columnValueMap.put("updatedAt", LocalDateTime.now());
        return update(List.of(id), columnValueMap);
    }

    // 原始行数据只有在存在且 status 为 1 时才视为有效业务记录。
    private boolean isActiveRecord(Map<String, Object> userRecord) {
        // 查询结果为空说明记录不存在，直接按无效处理。
        if (userRecord == null || userRecord.isEmpty()) {
            return false;
        }
        // 读取数据库行里的逻辑状态字段，供后续判断该记录是否仍对外可见。
        Object statusValue = userRecord.get("status");
        // 未显式保存状态值时按无效处理，避免脏数据绕过假删除边界。
        if (statusValue == null) {
            return false;
        }
        // 只把状态为 1 的记录视为有效业务数据，其余状态统一按不可用处理。
        return Integer.valueOf(1).equals(toInteger(statusValue));
    }

    // 把任意数字或字符串状态值统一转换成 Integer，便于 service 和控制层稳定判断逻辑状态。
    private Integer toInteger(Object rawValue) {
        if (rawValue == null) {
            return null;
        }
        return rawValue instanceof Number numberValue ? numberValue.intValue() : Integer.valueOf(String.valueOf(rawValue));
    }
}
