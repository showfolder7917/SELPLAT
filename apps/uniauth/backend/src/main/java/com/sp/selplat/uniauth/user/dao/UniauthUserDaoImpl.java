package com.sp.selplat.uniauth.user.dao;

import com.sp.selplat.common.db.dao.BaseDaoImpl;
import com.sp.selplat.common.db.query.model.CommonPageResult;
import com.sp.selplat.common.util.CommonPageParam;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Repository;

// 用户 DAO 实现当前只保留 store 模板查询职责，避免无关的正式增删改查代码继续堆在同一个类里。
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
        // 返回整理后的动态查询条件，供 common-db 统一解析字段后缀和分页 SQL。
        return queryColumnValueMap;
    }
}
