package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.db.query.model.CommonPageResult;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.uniauth.user.dao.UniauthUserDao;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import org.springframework.stereotype.Service;

// 用户服务实现当前只保留 store 兼容编排，避免无关的正式增删改查逻辑继续堆在同一个类里。
@Service
public class UniauthUserServiceImpl extends BaseServiceImpl implements UniauthUserService {

    // 用户 DAO 当前只承接 store 模板查询，服务层不再感知其他正式持久化动作。
    private final UniauthUserDao uniauthUserDao;

    // 构造用户服务实现时只注入统一 DAO，让 store 兼容接口继续沿用同一个仓储入口。
    public UniauthUserServiceImpl(UniauthUserDao uniauthUserDao) {
        // 保存统一 DAO，供 store 兼容接口复用模板查询能力。
        this.uniauthUserDao = uniauthUserDao;
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
}
