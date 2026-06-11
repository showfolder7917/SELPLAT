package com.sp.selplat.uniauth.user.domain.out;

import java.util.List;

// 用户 HTTP 验证输出对象统一返回当前模块的控制器装配状态和可访问路径信息。
public class UniauthUserHttpVerifyOut {

    // moduleCode 让调用方明确当前返回来自 uniauth 用户模块。
    private String moduleCode;
    // controllerStatus 用于表达用户控制器是否已经成功装配并可接收请求。
    private String controllerStatus;
    // verifyMessage 用于直接提示当前接口的验证目的和使用方式。
    private String verifyMessage;
    // availablePaths 返回当前控制器已经暴露的关键访问路径，方便联调时逐个验证。
    private List<String> availablePaths;

    // 获取模块编码，供前端或联调工具确认接口归属。
    public String getModuleCode() {
        return moduleCode;
    }

    // 设置模块编码，供控制器在返回验证结果时写入固定模块标识。
    public void setModuleCode(String moduleCode) {
        this.moduleCode = moduleCode;
    }

    // 获取控制器状态，供调用方确认控制器是否正常对外提供服务。
    public String getControllerStatus() {
        return controllerStatus;
    }

    // 设置控制器状态，供控制器按当前装配结果返回稳定状态值。
    public void setControllerStatus(String controllerStatus) {
        this.controllerStatus = controllerStatus;
    }

    // 获取验证说明，供联调人员快速理解当前验证接口的用途。
    public String getVerifyMessage() {
        return verifyMessage;
    }

    // 设置验证说明，供控制器返回当前接口的联调提示语。
    public void setVerifyMessage(String verifyMessage) {
        this.verifyMessage = verifyMessage;
    }

    // 获取当前控制器可访问路径列表，供联调时直接复制验证。
    public List<String> getAvailablePaths() {
        return availablePaths;
    }

    // 设置当前控制器可访问路径列表，供控制器统一返回当前已开放的关键路由。
    public void setAvailablePaths(List<String> availablePaths) {
        this.availablePaths = availablePaths;
    }
}
