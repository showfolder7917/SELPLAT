package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.util.Result;
import com.sp.selplat.uniauth.user.dao.UniauthUserDao;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

// 用户服务实现当前只保留 store 兼容编排，避免无关的正式增删改查逻辑继续堆在同一个类里。
@Service
public class UniauthUserServiceImpl implements UniauthUserService {

    // 用户 DAO 当前只承接 store 模板查询，服务层不再感知其他正式持久化动作。
    private final UniauthUserDao uniauthUserDao;

    // 构造用户服务实现时只注入统一 DAO，让 store 兼容接口继续沿用同一个仓储入口。
    public UniauthUserServiceImpl(UniauthUserDao uniauthUserDao) {
        // 保存统一 DAO，供 store 兼容接口复用模板查询能力。
        this.uniauthUserDao = uniauthUserDao;
    }

    // store 兼容接口统一在服务层组装旧式返回结构，控制层只负责接参和转发。
    @Override
    public String getStore(UniauthUserIn queryIn) {
        // Result 统一承接旧式页面接口常用的成功标记、提示信息和多模型数据结构。
        Result result = new Result(true);
        // 写入兼容接口来源标识，便于前端确认当前返回来自用户 store 路由。
        result.addDefaultModel("moduleCode", "uniauth-user-store");
        // 写入当前命中的旧式访问路径，便于联调时确认真实路由是否符合预期。
        result.addDefaultModel("requestPath", "/api/uniauth/users/store.htm");
        // 回传查询入参对象，便于前端同时确认分页字段和实体筛选字段都已经成功绑定。
        result.addDefaultModel("query", queryIn);
        // 通过模板 DAO 走公共 BaseDao#getList，把简单等值筛选直接转换成 ua_user 主表通用列表。
        List<Map<String, Object>> rowList = uniauthUserDao.getStoreList(queryIn);
        // 把模板查询结果按旧式 store 结构写入 rows，供前端分页组件直接消费。
        result.addDefaultModel("rows", rowList);
        // 旧式 store 结构用当前返回行数作为最小可用总数，便于前端先完成分页联调。
        result.addDefaultModel("total", rowList.size());
        // 写入通用提示语，明确当前 store 已接通并通过 BaseDao 模板返回列表数据。
        result.addMsg("store 接口已接通，当前列表通过 BaseDao 模板查询返回。");
        // 服务层统一把旧式结果对象序列化成 JSON，控制层直接回传即可。
        return JsonUtils.toJsonExt(result);
    }
}
