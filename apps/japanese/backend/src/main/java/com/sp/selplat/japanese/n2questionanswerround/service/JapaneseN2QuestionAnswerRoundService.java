package com.sp.selplat.japanese.n2questionanswerround.service;

import com.sp.selplat.common.service.BaseService;
import java.util.Map;

/** 定义 N2 用户作答轮次的单表 CRUD 与当前轮次能力。 */
public interface JapaneseN2QuestionAnswerRoundService extends BaseService {

    /**
     * 查询当前用户尚未结束的轮次。
     * 真实传参示例：当前方法无前端身份参数，服务端用户为 {@code 1L}。
     * 真实返回示例：{@code {id:200001,roundNo:1,roundStatus:"IN_PROGRESS"}}；未开始时返回空 Map。
     * 异常或副作用示例：数据库失败时沿用公共异常；只读轮次表。
     *
     * @return 当前用户进行中的轮次或空 Map
     */
    Map<String, Object> findCurrentRound();

    /**
     * 结束当前轮次并创建下一轮。
     * 真实传参示例：用户 1 当前在第 2 轮时调用。
     * 真实返回示例：创建 {@code {id:200003,roundNo:3,roundStatus:"IN_PROGRESS"}}。
     * 异常或副作用示例：成功时当前轮次改为 COMPLETED 并新增下一轮；事务失败时整体回滚。
     *
     * @return 新创建的当前轮次
     */
    Map<String, Object> startNextRound();
}
