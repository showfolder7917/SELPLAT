package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Repository;

// 用户 DAO 实现当前只保留 store 模板查询职责，避免无关的正式增删改查代码继续堆在同一个类里。
@Repository
public class UniauthUserDaoImpl extends BaseDaoImpl implements UniauthUserDao {

    // store 查询只负责把查询对象转换成模板等值条件，再交给 BaseDao 通用列表能力执行。
    @Override
    public List<Map<String, Object>> getStoreList(UniauthUserIn queryIn) {
        // 先把业务查询对象转换成模板层可识别的字段映射，避免控制层直接接触数据库列名。
        Map<String, Object> queryColumnValueMap = buildStoreQueryColumnValueMap(queryIn);
        // store 列表固定按主键倒序，保持旧页面默认展示顺序不变。
        return getList(queryColumnValueMap, "id DESC");
    }

    // 把用户查询对象转换成模板 DAO 可识别的等值查询条件。
    private Map<String, Object> buildStoreQueryColumnValueMap(UniauthUserIn queryIn) {
        // 使用有序映射承接模板查询条件，保证调试和生成 SQL 时字段顺序稳定。
        Map<String, Object> queryColumnValueMap = new LinkedHashMap<>();
        // 查询对象为空时直接返回空条件，让 store 接口回落为全量列表。
        if (queryIn == null) {
            return queryColumnValueMap;
        }
        // tenantId 属于精确筛选字段，直接交给模板等值条件处理。
        if (queryIn.getTenantId() != null) {
            queryColumnValueMap.put("tenantId", queryIn.getTenantId());
        }
        // loginName 在 store 场景先按等值匹配处理，保持模板查询规则简单可控。
        if (hasText(queryIn.getLoginName())) {
            queryColumnValueMap.put("loginName", queryIn.getLoginName().trim());
        }
        // displayName 在 store 场景先按等值匹配处理，避免模板层继续扩展模糊搜索语义。
        if (hasText(queryIn.getDisplayName())) {
            queryColumnValueMap.put("displayName", queryIn.getDisplayName().trim());
        }
        // userStatus 属于精确筛选字段，继续走模板等值条件。
        if (hasText(queryIn.getUserStatus())) {
            queryColumnValueMap.put("userStatus", queryIn.getUserStatus().trim());
        }
        // lockedFlag 属于布尔精确筛选字段，可直接复用模板条件能力。
        if (queryIn.getLockedFlag() != null) {
            queryColumnValueMap.put("lockedFlag", queryIn.getLockedFlag());
        }
        // 返回整理后的模板查询条件，结束 store 专用字段映射。
        return queryColumnValueMap;
    }

    // 文本有值判断统一收口，避免字段映射时重复手写 trim 判空逻辑。
    private boolean hasText(String value) {
        // 只有非空且去空格后仍有内容的字符串，才允许进入模板查询条件。
        return value != null && !value.trim().isEmpty();
    }
}
