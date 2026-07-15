package com.sp.selplat.uniauth.user.service.impl;

import com.sp.selplat.common.service.BaseServiceImpl;
import com.sp.selplat.common.db.query.model.CommonPageResult;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.uniauth.user.dao.UniauthUserDao;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import java.util.LinkedHashMap;
import java.util.Map;
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

    // store 兼容接口统一在服务层组装旧式返回结构，控制层只负责接参和转发。
    @Override
    public String getStore(CommonPageParam queryIn) {
        // 控制层在极端手工调用场景下若未传对象，这里补一个默认共通参数，保证后续分页查询仍有稳定默认值。
        if (queryIn == null) {
            queryIn = new CommonPageParam();
        }
        // 先通过 DAO 调用 common-db 公共分页查询，确保当前接口直接复用统一分页和动态条件能力。
        CommonPageResult pageResult = uniauthUserDao.getStorePage(queryIn);
        // 把分页查询结果回填到共通参数对象，便于需要复用同一个对象回看查询结果的场景直接读取。
        queryIn.setRecords(pageResult.getRecords());
        // 把总记录数写回共通参数对象，保持“同一对象承接入参与结果”的约定。
        queryIn.setTotalCount(pageResult.getTotalCount());
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
        // rows 直接承接 common-db 当前页记录，供浏览器或前端表格组件直接读取展示。
        storeResult.put("rows", pageResult.getRecords());
        // total 直接返回当前筛选条件下的总记录数，便于旧式 store 页面继续做分页联调。
        storeResult.put("total", pageResult.getTotalCount());
        // pageNo 回传当前页码，便于旧式页面和联调人员确认分页参数已经命中 common-db。
        storeResult.put("pageNo", pageResult.getPageNo());
        // pageSize 回传当前页大小，便于确认控制层透传到公共分页链路的条数是否正确。
        storeResult.put("pageSize", pageResult.getPageSize());
        // msg 用于提示当前接口已经切到 common-db 公共分页查询，方便浏览器直接看到联调状态。
        storeResult.put("msg", "store 接口已切换为共通参数 + common-db 分页查询返回。");
        // 服务层统一把顶层结果对象序列化成 JSON，控制层直接回传给浏览器。
        return JsonUtils.toJsonExt(storeResult);
    }
}
