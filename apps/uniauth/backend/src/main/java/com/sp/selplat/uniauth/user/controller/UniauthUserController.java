package com.sp.selplat.uniauth.user.controller;

import com.sp.selplat.uniauth.user.domain.in.UniauthUserQueryIn;
import com.sp.selplat.uniauth.user.domain.in.UniauthUserSaveIn;
import com.sp.selplat.uniauth.user.domain.out.UniauthUserHttpVerifyOut;
import com.sp.selplat.uniauth.user.domain.out.UniauthUserItemOut;
import java.util.Arrays;
import com.sp.selplat.uniauth.user.service.UniauthUserService;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户控制器，只暴露 ua_user 主表的基础增删改查入口。
 * 访问基地址：/api/uniauth/users
 */
@RestController
@RequestMapping("/api/uniauth/users")
public class UniauthUserController {

    // 用户服务负责账号主表的业务校验和持久化编排。
    private final UniauthUserService uniauthUserService;

    /**
     * 构造用户控制器，并注入用户服务。
     *
     * @param uniauthUserService 用户服务
     */
    public UniauthUserController(UniauthUserService uniauthUserService) {
        // 保存用户服务，供所有接口复用。
        this.uniauthUserService = uniauthUserService;
    }

    /**
     * HTTP 验证接口，用于确认控制器已经加载，并把当前可访问的用户路由直接返回给联调人员。
     * 访问地址：GET /api/uniauth/users/verify/http
     *
     * @return HTTP 验证结果
     */
    @GetMapping("/verify/http")
    public UniauthUserHttpVerifyOut verifyHttpAccess() {
        // 创建验证结果对象，统一承接当前控制器装配状态和关键路由信息。
        UniauthUserHttpVerifyOut verifyOut = new UniauthUserHttpVerifyOut();
        // 写入固定模块编码，方便调用方确认当前返回来自 uniauth 用户模块。
        verifyOut.setModuleCode("uniauth-user");
        // 写入控制器已就绪状态，表示当前 HTTP 控制层已经可接收请求。
        verifyOut.setControllerStatus("READY");
        // 返回联调说明，提示后续可以继续访问列表、详情、新增、更新和删除接口。
        verifyOut.setVerifyMessage("用户控制器已装配，可继续访问列表、详情、新增、更新和删除接口。");
        // 返回当前控制器的关键路径，方便调用方直接复制 HTTP 地址进行验证。
        verifyOut.setAvailablePaths(Arrays.asList(
            "GET /api/uniauth/users/verify/http",
            "GET /api/uniauth/users",
            "GET /api/uniauth/users/{id}",
            "POST /api/uniauth/users",
            "PUT /api/uniauth/users/{id}",
            "DELETE /api/uniauth/users/{id}"
        ));
        return verifyOut;
    }

    /**
     * 列表接口，用于按租户、登录名、显示名、状态和锁定标记筛选账号。
     * 访问地址：GET /api/uniauth/users
     *
     * @param queryIn 查询条件
     * @return 用户列表
     */
    @GetMapping
    public List<UniauthUserItemOut> listUsers(@ModelAttribute UniauthUserQueryIn queryIn) {
        // 控制层只负责接参并转给服务层，不承担业务筛选逻辑。
        return uniauthUserService.listUsers(queryIn);
    }

    /**
     * 详情接口，用于按主键查看单个账号。
     * 访问地址：GET /api/uniauth/users/{id}
     *
     * @param id 用户主键
     * @return 用户详情
     */
    @GetMapping("/{id}")
    public UniauthUserItemOut getUserById(@PathVariable("id") Long id) {
        // 详情接口直接返回服务层校验后的正式账号结果。
        return uniauthUserService.getUserById(id);
    }

    /**
     * 新增接口，用于创建新账号主表记录。
     * 访问地址：POST /api/uniauth/users
     *
     * @param saveIn 新增入参
     * @return 新增后的用户结果
     */
    @PostMapping
    public UniauthUserItemOut createUser(@RequestBody UniauthUserSaveIn saveIn) {
        // 控制层把新增请求交给服务层做默认值补齐、唯一性校验和密码哈希。
        return uniauthUserService.createUser(saveIn);
    }

    /**
     * 更新接口，用于覆盖现有账号资料和可选密码。
     * 访问地址：PUT /api/uniauth/users/{id}
     *
     * @param id 用户主键
     * @param saveIn 更新入参
     * @return 更新后的用户结果
     */
    @PutMapping("/{id}")
    public UniauthUserItemOut updateUser(@PathVariable("id") Long id, @RequestBody UniauthUserSaveIn saveIn) {
        // 路径主键由服务层写回输入对象，控制层只负责转发。
        return uniauthUserService.updateUser(id, saveIn);
    }

    /**
     * 删除接口，用于移除指定账号主表记录。
     * 访问地址：DELETE /api/uniauth/users/{id}
     *
     * @param id 用户主键
     */
    @DeleteMapping("/{id}")
    public void deleteUserById(@PathVariable("id") Long id) {
        // 删除成功时不额外返回主表内容，保持接口语义简单。
        uniauthUserService.deleteUserById(id);
    }
}
