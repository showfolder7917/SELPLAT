package com.sp.selplat.mda.projectgenerator.service;

import com.sp.selplat.common.exception.CommonBusinessException;
import com.sp.selplat.common.exception.CommonSystemException;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.mda.projectgenerator.model.MdaProjectGenerationData;

/** 定义 MDA 工程脚手架生成能力，Controller 只能依赖此契约。 */
public interface MdaProjectGeneratorService {

    /**
     * 首次创建完整工程，或在生成器拥有的既有工程中追加一张新业务表。
     * 真实传参示例：{@code {projectName:"japan",tableName:"region"}}。
     * 真实返回示例：{@code {projectCreated:true,pageUrl:"/japan/japan.html"}}。
     * 异常或副作用示例：编码非法或目标冲突时抛出业务异常；写入失败时回滚本次新增文件。
     *
     * @param request 页面提交的工程和表编码
     * @return 工程或业务表生成结果
     * @throws CommonBusinessException 编码非法、工程不受管理或任一目标文件已存在时抛出
     * @throws CommonSystemException 文件准备或原子写入失败时抛出
     */
    MdaProjectGenerationData generate(CommonParam request);
}
