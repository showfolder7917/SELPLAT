package com.sp.selplat.aifactory.task.service;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/** 定义任务创建与快照查询合同。 */
public interface AiTaskService {
    /**
     * 创建由本地 Python 驱动的新任务。
     * 真实传参示例：{@code {title:"用户导入",project:"SELPLAT",clientId:"CLIENT-MAC-1"}}。
     * 真实返回示例：{@code {success:true,data:{taskId:"TASK-1",stateVersion:1}}}。
     * 异常或副作用示例：缺标题或工程时拒绝；成功时写任务、首阶段和进度事件。
     * @param command 任务创建参数
     * @return 统一任务创建结果
     */
    CommonResult createTask(CommonParam command);

    /**
     * 查询一个任务的权威控制面快照。
     * 真实传参示例：{@code {taskId:"TASK-1"}}。
     * 真实返回示例：返回 task、stages、runs、artifacts、gates 和 events。
     * 异常或副作用示例：不存在时返回空数据；只读数据库。
     * @param query 任务编码参数
     * @return 统一任务快照结果
     */
    CommonResult getTask(CommonParam query);
}

