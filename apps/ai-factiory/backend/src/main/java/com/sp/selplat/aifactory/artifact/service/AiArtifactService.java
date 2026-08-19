package com.sp.selplat.aifactory.artifact.service;

import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/** 定义本地产物摘要登记合同。 */
public interface AiArtifactService {
    /**
     * 登记任务内相对逻辑路径和摘要。
     * 真实传参示例：{@code {taskId:"TASK-1",logicalPath:"当前任务/详细设计/A_V001.md",sha256:"abc"}}。
     * 真实返回示例：返回 artifactId、version 和 PENDING gateStatus。
     * 异常或副作用示例：绝对路径或路径逃逸拒绝；不读取本地文件正文。
     * @param command 产物事实
     * @return 产物登记结果
     */
    CommonResult register(CommonParam command);
}

