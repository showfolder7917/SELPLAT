package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.common.util.CommonBatchParam;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户控制器统一提供 store 列表、详情、新增、更新和假删除入口。
 * 访问基地址：/api/uniauth/users
 */
@RestController
@ModuleDescription(
    code = "uniauth-user",
    name = "统一认证用户",
    description = "提供统一认证用户的列表、详情、新增、更新和删除接口"
)
@RequestMapping("/api/uniauth/users")
public class UniauthUserController extends BaseController<UniauthUserService> {

    /**
     * getStore 列表入口沿用 `.htm` 路由风格，把分页参数和查询条件按 Result 结构回传给调用方。
     * 访问地址：GET /api/uniauth/users/getStore.htm 或 POST /api/uniauth/users/getStore.htm
     *
     * @param queryIn 前端分页与筛选参数，例如
     *     {@code {"pageNo":1,"pageSize":10,"paramMap":{"userStatus":"ACTIVE"}}}
     * @return 分页 JSON，例如
     *     {@code {"result":"success","dataList":[{"id":10001,"loginName":"admin"}],}
     *     {@code "total":1,"pageNo":1,"pageSize":10}
     */
    @ResponseBody
    @RequestMapping(value = "getStore.htm", method = {RequestMethod.GET, RequestMethod.POST}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getStore(CommonPageParam queryIn) {
        // 服务层已经返回完整分页结果结构，控制层只做 JSON 序列化，不再补字段或改变返回层级。
        return JsonUtils.toJsonIgnoreNull(getService().getStore(queryIn));
    }

    /**
     * 按主键查询单个用户详情。
     * 访问地址：GET /api/uniauth/users/getById.htm 或 POST /api/uniauth/users/getById.htm
     *
     * @param queryIn 前端主键参数，例如 {@code {"paramMap":{"id":10001}}}
     * @return 用户详情 JSON，例如
     *     {@code {"result":"success","data":{"id":10001,"loginName":"admin","userStatus":"ACTIVE"}}
     */
    @ResponseBody
    @RequestMapping(value = "getById.htm", method = {RequestMethod.GET, RequestMethod.POST}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getById(CommonParam queryIn) {
        // 服务层已经返回 CommonResult 结构，控制层只做 JSON 序列化，不再执行第二次响应包装。
        return JsonUtils.toJsonIgnoreNull(getService().getById(queryIn));
    }

    /**
     * 按多组主键批量查询用户详情。
     *
     * @param queryIn 前端 items 中的多组主键，例如
     *     {@code {"items":[{"paramMap":{"id":10001}},{"paramMap":{"id":10002}}]}
     * @return 批量用户详情 JSON，例如
     *     {@code {"result":"success","data":[{"id":10001,"loginName":"admin"},}
     *     {@code {"id":10002,"loginName":"operator"}]}
     */
    @ResponseBody
    @RequestMapping(value = "getByIds.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getByIds(@RequestBody CommonBatchParam queryIn) {
        // 服务层返回完整批量查询结构，控制层只转换为 JSON。
        return JsonUtils.toJsonIgnoreNull(getService().getByIds(queryIn));
    }

    /**
     * 新增用户。
     * 访问地址：POST /api/uniauth/users/create.htm
     *
     * @param queryIn 前端新增字段，例如
     *     {@code {"paramMap":{"tenantId":1,"loginName":"admin","password":"secret","userStatus":"ACTIVE"}}}
     * @return 新增结果 JSON，例如
     *     {@code {"result":"success","affectedRows":1,"data":{"id":10001,"loginName":"admin"}}
     */
    @ResponseBody
    @RequestMapping(value = "create.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String insert(CommonParam queryIn) {
        // 服务层已经返回新增结果结构，控制层只转换为 JSON，不再增加额外响应字段。
        return JsonUtils.toJsonIgnoreNull(getService().insert(queryIn));
    }

    /**
     * 批量新增用户。
     *
     * @param queryIn 前端 items 中的待新增用户，例如
     *     {@code {"items":[{"paramMap":{"tenantId":1,"loginName":"admin","password":"secret"}}]}
     * @return 批量新增结果 JSON，例如
     *     {@code {"result":"success","affectedRows":1,"data":[{"id":10001,"loginName":"admin"}]}
     */
    @ResponseBody
    @RequestMapping(value = "insertBatch.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String insertBatch(@RequestBody CommonBatchParam queryIn) {
        // 服务层完成事务、发号和分组批处理，控制层只转换最终结构。
        return JsonUtils.toJsonIgnoreNull(getService().insertBatch(queryIn));
    }

    /**
     * 更新用户。
     * 访问地址：POST /api/uniauth/users/update.htm
     *
     * @param queryIn 前端主键和更新字段，例如
     *     {@code {"paramMap":{"id":10001,"displayName":"系统管理员"}}
     * @return 更新结果 JSON，例如
     *     {@code {"result":"success","affectedRows":1,"data":{"id":10001,"displayName":"系统管理员"}}
     */
    @ResponseBody
    @RequestMapping(value = "update.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String update(CommonParam queryIn) {
        // 服务层已经返回更新结果结构，控制层只转换为 JSON，不再增加额外响应字段。
        return JsonUtils.toJsonIgnoreNull(getService().update(queryIn));
    }

    /**
     * 批量更新用户。
     *
     * @param queryIn 前端 items 中的主键和更新字段，例如
     *     {@code {"items":[{"paramMap":{"id":10001,"userStatus":"LOCKED"}}]}
     * @return 批量更新结果 JSON，例如
     *     {@code {"result":"success","affectedRows":1,"data":[{"id":10001,"userStatus":"LOCKED"}]}
     */
    @ResponseBody
    @RequestMapping(value = "updateBatch.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String updateBatch(@RequestBody CommonBatchParam queryIn) {
        // 服务层保证全部一千条分组在同一事务中完成，控制层只转换结果。
        return JsonUtils.toJsonIgnoreNull(getService().updateBatch(queryIn));
    }

    /**
     * 删除用户。
     * 访问地址：POST /api/uniauth/users/delete.htm
     *
     * @param queryIn 前端主键和审计字段，例如
     *     {@code {"paramMap":{"id":10001,"updatedBy":90001}}
     * @return 假删除结果 JSON，例如
     *     {@code {"result":"success","affectedRows":1,"data":{"id":10001}}
     */
    @ResponseBody
    @RequestMapping(value = "delete.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String delete(CommonParam queryIn) {
        // 先接收服务层生成的完整假删除结果，明确控制器与业务服务之间的返回结构边界。
        CommonResult result = getService().delete(queryIn);
        // 控制层只把既有 CommonResult 转换为 JSON，不再增加字段或改变响应层级。
        return JsonUtils.toJsonIgnoreNull(result);
    }

    /**
     * 批量假删除用户。
     *
     * @param queryIn 前端 items 中的主键和审计字段，例如
     *     {@code {"items":[{"paramMap":{"id":10001,"updatedBy":90001}}]}
     * @return 批量假删除结果 JSON，例如
     *     {@code {"result":"success","affectedRows":1,"data":[{"id":10001}]}
     */
    @ResponseBody
    @RequestMapping(value = "deleteBatch.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String deleteBatch(@RequestBody CommonBatchParam queryIn) {
        // 服务层只执行批量假删除并返回完整结果，控制层不开放真删除能力。
        return JsonUtils.toJsonIgnoreNull(getService().deleteBatch(queryIn));
    }
}
