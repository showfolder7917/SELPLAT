package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestMapping;
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
     * @param queryIn 查询参数
     * @return store JSON 结果
     */
    @ResponseBody
    @RequestMapping(value = "getStore.htm", method = {RequestMethod.GET, RequestMethod.POST}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getStore(CommonPageParam queryIn) {
        // 控制层先调用服务层获取纯分页业务结果，再由公共控制器层统一包装旧式 store 顶层 JSON 结构。
        CommonPageResult pageResult = getService().getStore(queryIn);
        // 分页响应由公共基类自动补齐模块编码、当前路由和验证说明，控制层只传分页业务输入。
        return buildPageResponseJson(queryIn, pageResult);
    }

    /**
     * 按主键查询单个用户详情。
     * 访问地址：GET /api/uniauth/users/getById.htm 或 POST /api/uniauth/users/getById.htm
     *
     * @param queryIn 普通请求参数
     * @return 用户详情 JSON
     */
    @ResponseBody
    @RequestMapping(value = "getById.htm", method = {RequestMethod.GET, RequestMethod.POST}, produces = MediaType.APPLICATION_JSON_VALUE)
    public String getById(CommonParam queryIn) {
        // 服务层统一按共通入参读取主键并回传单条详情数据，控制层只负责补齐公共返回元数据。
        CommonResult result = getService().getById(queryIn);
        // 普通响应由公共基类自动补齐模块编码和当前路由，当前接口只保留业务结果与详情提示语。
        return buildResponseJson(result, "用户详情查询完成。");
    }

    /**
     * 新增用户。
     * 访问地址：POST /api/uniauth/users/create.htm
     *
     * @param queryIn 普通请求参数
     * @return 新增结果 JSON
     */
    @ResponseBody
    @RequestMapping(value = "create.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String create(CommonParam queryIn) {
        // 服务层负责生成主键和整理落库字段，控制层只统一包装非分页返回结构。
        CommonResult result = getService().create(queryIn);
        // 普通响应由公共基类自动补齐模块编码和当前路由，当前接口只保留业务结果与新增提示语。
        return buildResponseJson(result, "用户新增完成。");
    }

    /**
     * 更新用户。
     * 访问地址：POST /api/uniauth/users/update.htm
     *
     * @param queryIn 普通请求参数
     * @return 更新结果 JSON
     */
    @ResponseBody
    @RequestMapping(value = "update.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String update(CommonParam queryIn) {
        // 服务层负责唯一性校验、字段筛选和更新时间维护，控制层只补公共返回元数据。
        CommonResult result = getService().update(queryIn);
        // 普通响应由公共基类自动补齐模块编码和当前路由，当前接口只保留业务结果与更新提示语。
        return buildResponseJson(result, "用户更新完成。");
    }

    /**
     * 删除用户。
     * 访问地址：POST /api/uniauth/users/delete.htm
     *
     * @param queryIn 普通请求参数
     * @return 删除结果 JSON
     */
    @ResponseBody
    @RequestMapping(value = "delete.htm", method = RequestMethod.POST, produces = MediaType.APPLICATION_JSON_VALUE)
    public String delete(CommonParam queryIn) {
        // 服务层统一执行假删除并返回删除结果摘要，控制层只负责补齐共通返回结构。
        CommonResult result = getService().delete(queryIn);
        // 普通响应由公共基类自动补齐模块编码和当前路由，当前接口只保留业务结果与删除提示语。
        return buildResponseJson(result, "用户删除完成。");
    }
}
