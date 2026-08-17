package com.sp.selplat.japanese.n2questionanswerrecord.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonPageParam;
import com.sp.selplat.common.util.CommonPageResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;
import java.util.List;
import java.util.Map;

/** 定义 N2 逐题作答明细的单表 CRUD 与当前用户查询能力。 */
public interface JapaneseN2QuestionAnswerRecordService extends BaseService {

    /**
     * 查询题目分页并合并当前用户的作答状态与累计正确、错误次数。
     * 真实传参示例：{@code {pageNo:1,pageSize:20,questionType:"GRAMMAR"}}。
     * 真实返回示例：题目记录包含 {@code selectedOption:"B",correctCount:2,wrongCount:1}。
     * 异常或副作用示例：任一单表查询失败时返回统一异常；方法不写数据库且不返回正确答案和解释。
     *
     * @param queryIn 题目分页和独立筛选字段
     * @return 合并当前用户进度后的题目分页
     */
    CommonPageResult getLearningStore(CommonPageParam queryIn);

    /**
     * 在当前轮次提交一次答案并持久化独立判定结果，每次点击都累计一次。
     * 真实传参示例：{@code {questionId:100001,selectedOption:"C"}}。
     * 真实返回示例：{@code {correct:true,selectedOption:"C",correctCount:1,wrongCount:0}}。
     * 异常或副作用示例：选项非法或题目不存在时不写库；每次有效作答都会新增一条明细。
     *
     * @param answerIn 题目主键和 A 至 D 选项
     * @return 本次判定与累计次数
     */
    CommonResult answer(CommonParam answerIn);

    /**
     * 在用户至少作答过当前题后返回正确选项和解释。
     * 真实传参示例：{@code {questionId:100001}}。
     * 真实返回示例：{@code {correctOption:"A",explanation:"……"}}。
     * 异常或副作用示例：尚未作答时抛出业务异常；方法不修改数据库。
     *
     * @param queryIn 题目主键
     * @return 正确选项与解释
     */
    CommonResult getExplanation(CommonParam queryIn);

    /**
     * 结束当前轮次并创建下一轮，历史正确和错误次数继续保留。
     * 真实传参示例：前端确认“开始新一轮”后调用，无请求体。
     * 真实返回示例：{@code {id:100002,roundNo:2,roundStatus:"IN_PROGRESS"}}。
     * 异常或副作用示例：成功时写轮次表两次；任一步失败则事务回滚。
     *
     * @return 新轮次信息
     */
    CommonResult startNextRound();

    /**
     * 查询当前用户全部有效作答历史。
     * 真实传参示例：当前方法不接收 userId，服务端用户为 {@code 1L}。
     * 真实返回示例：返回多个轮次的 {@code [{questionId:100001,correctFlag:true}]}。
     * 异常或副作用示例：数据库失败时沿用公共异常；只读明细表。
     *
     * @return 当前用户按作答时间升序的全部明细
     */
    List<Map<String, Object>> findAllForCurrentUser();
}
