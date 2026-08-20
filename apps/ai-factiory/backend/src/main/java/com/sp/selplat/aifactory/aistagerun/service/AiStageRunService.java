package com.sp.selplat.aifactory.aistagerun.service;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/** 定义阶段租约和完成请求合同。 */
public interface AiStageRunService {
    /**
     * 由本地 Python 原子领取阶段。
     * 真实传参示例：{@code {stageId:"STAGE-1",clientId:"CLIENT-MAC-1"}}。
     * 真实返回示例：返回 runId、leaseToken、expiresAt 和 stateVersion。
     * 异常或副作用示例：非 READY 阶段拒绝；成功时创建运行租约。
     * @param command 阶段领取参数
     * @return 阶段租约结果
     */
    CommonResult claim(CommonParam command);

    /**
     * 请求结束执行并转入文件门禁。
     * 真实传参示例：{@code {runId:"RUN-1",exitCode:0,artifactDigests:["abc"]}}。
     * 真实返回示例：{@code {status:"WAITING_FILE_GATE"}}。
     * 异常或副作用示例：非零退出码转 FAILED；不直接完成阶段。
     * @param command 完成事实
     * @return 新运行状态
     */
    CommonResult complete(CommonParam command);
}
