package com.sp.selplat.japanese.n2bluebookquestion.service.impl;

import com.sp.selplat.common.util.CommonResult;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.japanese.common.service.JapaneseBaseServiceImpl;
import com.sp.selplat.japanese.n2bluebookquestion.dao.JapaneseN2BlueBookQuestionDao;
import com.sp.selplat.japanese.n2bluebookquestion.service.JapaneseN2BlueBookQuestionService;
import com.sp.selplat.japanese.n2bluebookquestion.service.JapaneseQuestionContentService;
import org.springframework.stereotype.Service;

/** 绑定当前表 DAO，默认字段和 CRUD 由项目父类提供。 */
@Service
public class JapaneseN2BlueBookQuestionServiceImpl
        extends JapaneseBaseServiceImpl<JapaneseN2BlueBookQuestionDao>
        implements JapaneseN2BlueBookQuestionService {

    private final JapaneseQuestionContentService contentService;

    /**
     * 注入独立的 Codex、语音和媒体生成能力。
     * 真实传参示例：Spring 注入 {@code JapaneseQuestionContentServiceImpl} 的接口代理。
     * 真实返回示例：构造后 CRUD 与三项生成能力由同一题库 Service 对外提供。
     * 异常或副作用示例：能力缺失时 Spring 启动失败；构造过程不启动外部进程。
     *
     * @param contentService 题目内容生成接口
     */
    public JapaneseN2BlueBookQuestionServiceImpl(
            JapaneseQuestionContentService contentService) {
        this.contentService = contentService;
    }

    /**
     * 将公共参数容器中的题目上下文交给共用内容生成能力。
     * 真实传参示例：{@code {questionText:"給与",correctOption:"D"}}。
     * 真实返回示例：{@code {success:true,data:{explanation:"給与读作きゅうよ"}}}。
     * 异常或副作用示例：题干或答案缺失时抛出业务异常，不启动 Codex。
     *
     * @param request SELPLAT 公共单条请求参数
     * @return Codex 解释的公共结果
     */
    @Override
    public CommonResult generateExplanation(CommonParam request) {
        return contentService.generateExplanation(request);
    }

    /**
     * 将公共参数容器中的题目上下文交给共用图片生成能力。
     * 真实传参示例：{@code {questionText:"平均工资略低",correctOption:"D"}}。
     * 真实返回示例：{@code {success:true,data:{url:"/pic/x.webp"}}}。
     * 异常或副作用示例：生成失败时抛出系统异常且不写入题库表。
     *
     * @param request SELPLAT 公共单条请求参数
     * @return WebP 图片媒体的公共结果
     */
    @Override
    public CommonResult generateImage(CommonParam request) {
        return contentService.generateImage(request);
    }

    /**
     * 将公共参数容器中的日语文本交给共用语音生成能力。
     * 真实传参示例：{@code {audioText:"給与",correctOption:"D"}}。
     * 真实返回示例：{@code {success:true,data:{url:"/audio/x.mp3"}}}。
     * 异常或副作用示例：文本无效时抛出业务异常，不启动 edge-tts。
     *
     * @param request SELPLAT 公共单条请求参数
     * @return NanamiNeural 语音媒体的公共结果
     */
    @Override
    public CommonResult generateAudio(CommonParam request) {
        return contentService.generateAudio(request);
    }
}
