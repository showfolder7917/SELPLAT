package com.sp.selplat.japanese.n2bluebookquestion.service;

import com.sp.selplat.common.service.BaseService;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.CommonResult;

/** 定义 N2 蓝宝书题库 CRUD、朗读文本翻译、Codex 图片和日语语音业务能力。 */
public interface JapaneseN2BlueBookQuestionService extends BaseService {

    /**
     * 只把朗读文本翻译为简体中文。
     * 真实传参示例：{@code {audioText:"今年の給与は去年より低い。"}}。
     * 真实返回示例：{@code {success:true,data:{explanation:"今年的工资比去年低。"}}}。
     * 异常或副作用示例：朗读文本缺失时抛出业务异常，不启动翻译进程。
     *
     * @param request SELPLAT 公共单条请求参数
     * @return deep-translator 生成的中文译文公共结果
     */
    CommonResult generateExplanation(CommonParam request);

    /**
     * 根据题目上下文生成并存储 WebP 图片。
     * 真实传参示例：{@code {questionType:"GRAMMAR",questionText:"景气が回復する"}}。
     * 真实返回示例：{@code {success:true,data:{url:"/pic/x.webp"}}}。
     * 异常或副作用示例：Codex 或 FFmpeg 失败时抛出系统异常，不写入题库表。
     *
     * @param request SELPLAT 公共单条请求参数
     * @return 已转 WebP 并存储的图片公共结果
     */
    CommonResult generateImage(CommonParam request);

    /**
     * 根据日语文本生成并存储 NanamiNeural 语音。
     * 真实传参示例：{@code {audioText:"給与",correctOption:"D"}}。
     * 真实返回示例：{@code {success:true,data:{url:"/audio/x.mp3"}}}。
     * 异常或副作用示例：日语文本为空时抛出业务异常，不启动 edge-tts。
     *
     * @param request SELPLAT 公共单条请求参数
     * @return NanamiNeural 生成并存储的语音公共结果
     */
    CommonResult generateAudio(CommonParam request);

    /**
     * 按题目主键读取已有语音，缺失时由服务端完整题目生成、保存并返回。
     * 真实传参示例：{@code {id:100001}}。
     * 真实返回示例：{@code {success:true,data:{url:"/audio/x.mp3"}}}。
     * 异常或副作用示例：题目不存在时不生成文件；缺少语音时新增 MP3 并更新题表媒体字段。
     *
     * @param request 只包含题目主键的公共参数
     * @return 可直接播放的媒体信息
     */
    CommonResult playAudio(CommonParam request);
}
