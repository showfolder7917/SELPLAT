package com.sp.selplat.aifactory.common.util;

import com.sp.selplat.common.util.CommonResult;

/** 统一创建 AI 工厂 Service 返回结构。 */
public final class AiFactoryResults {

    private AiFactoryResults() {
    }

    /**
     * 创建成功结果。
     * 真实传参示例：{@code data={taskId:"TASK-1"}, message="任务已创建"}。
     * 真实返回示例：{@code {success:true,moduleCode:"ai-factory",data:{...}}}。
     * 异常或副作用示例：无异常且不修改输入对象。
     *
     * @param data 服务返回的业务数据
     * @param message 面向调用方的结果说明
     * @return 统一成功结果
     */
    public static CommonResult success(Object data, String message) {
        CommonResult result = new CommonResult();
        result.setSuccess(true);
        result.setModuleCode("ai-factory");
        result.setData(data);
        result.setMsg(message);
        return result;
    }
}

