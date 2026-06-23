package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.uniauth.user.dao.UniauthUserDao;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserIn;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import java.util.LinkedHashMap;
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
        // 先通过 DAO 查询数据库用户列表，确保当前接口真正返回 ua_user 主表查出来的数据。
        List<Map<String, Object>> rowList = uniauthUserDao.getStoreList(queryIn);
        // 使用有序映射直接组装浏览器可读的顶层 JSON，避免 rows 和 total 再被额外包到 result 节点下面。
        Map<String, Object> storeResult = new LinkedHashMap<>();
        // success 直接暴露接口处理结果，方便浏览器和前端脚本第一时间判断请求是否成功。
        storeResult.put("success", true);
        // moduleCode 标记当前返回来自 uniauth 用户 store 查询链路，便于联调区分接口来源。
        storeResult.put("moduleCode", "uniauth-user-store");
        // requestPath 回传当前接口路径，方便浏览器直接核对命中的后端路由。
        storeResult.put("requestPath", "/api/uniauth/users/store.htm");
        // query 回传实际接收到的查询对象，便于确认浏览器传入的筛选参数已经绑定成功。
        storeResult.put("query", queryIn);
        // rows 直接承接数据库查询出来的结果集，供浏览器或前端表格组件直接读取展示。
        storeResult.put("rows", rowList);
        // total 直接返回当前结果集条数，便于前端先完成最小可用的列表分页联调。
        storeResult.put("total", rowList.size());
        // msg 用于提示当前接口已经通过 DAO 查到数据库结果，方便浏览器直接看到联调状态。
        storeResult.put("msg", "store 接口已接通，当前列表数据通过 DAO 从数据库查询返回。");
        // 服务层统一把顶层结果对象序列化成 JSON，控制层直接回传给浏览器。
        return JsonUtils.toJsonExt(storeResult);
    }
}
