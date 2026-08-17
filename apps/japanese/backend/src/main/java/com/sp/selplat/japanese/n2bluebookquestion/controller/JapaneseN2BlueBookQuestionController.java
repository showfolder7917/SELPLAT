package com.sp.selplat.japanese.n2bluebookquestion.controller;

import com.sp.selplat.common.web.controller.BaseController;
import com.sp.selplat.common.web.controller.ModuleDescription;
import com.sp.selplat.common.util.CommonParam;
import com.sp.selplat.common.util.JsonUtils;
import com.sp.selplat.japanese.n2bluebookquestion.service.JapaneseN2BlueBookQuestionService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 发布 JapaneseN2BlueBookQuestion 固定表公共 CRUD。 */
@RestController
@ModuleDescription(
    code = "japanese-n2-blue-book-question",
    name = "N2BlueBookQuestion",
    description = "JapaneseN2BlueBookQuestion 管理"
)
@RequestMapping(
    value = "/api/japanese/n2-blue-book-question/",
    produces = MediaType.APPLICATION_JSON_VALUE
)
public class JapaneseN2BlueBookQuestionController
        extends BaseController<JapaneseN2BlueBookQuestionService> {

    /**
     * 通过后端 deep-translator 插件把朗读文本翻译为简体中文。
     * 真实传参示例：{@code {audioText:"今年の給与は去年より低い。"}}。
     * 真实返回示例：{@code {success:true,data:{explanation:"今年的工资比去年低。"}}}。
     * 异常或副作用示例：朗读文本为空或免费翻译服务不可用时返回统一异常；不修改题目记录。
     *
     * @param request 当前编辑中的完整题目
     * @return 固定公共 JSON
     */
    @PostMapping("generate-explanation.htm")
    public String generateExplanation(
            @RequestBody CommonParam request) {
        return JsonUtils.toJsonIgnoreNull(getService().generateExplanation(request));
    }

    /**
     * 直接调用本机 Codex CLI 生成图片并压缩成 WebP。
     * 真实传参示例：语法题题干、四项选择和正确答案 C。
     * 真实返回示例：{@code {success:true,data:{url:"/pic/x.webp"}}}。
     * 异常或副作用示例：Codex 或 FFmpeg 失败时不写题表；成功时新增 WebP 文件。
     *
     * @param request 当前编辑中的完整题目
     * @return 固定公共 JSON
     */
    @PostMapping("generate-image.htm")
    public String generateImage(
            @RequestBody CommonParam request) {
        return JsonUtils.toJsonIgnoreNull(getService().generateImage(request));
    }

    /**
     * 使用指定 edge-tts venv 的 NanamiNeural 生成日语语音。
     * 真实传参示例：audioText 为题干中的完整日语句子。
     * 真实返回示例：{@code {success:true,data:{url:"/audio/x.mp3"}}}。
     * 异常或副作用示例：edge-tts 失败时不写题表；成功时新增 MP3 文件。
     *
     * @param request 当前编辑中的完整题目
     * @return 固定公共 JSON
     */
    @PostMapping("generate-audio.htm")
    public String generateAudio(
            @RequestBody CommonParam request) {
        return JsonUtils.toJsonIgnoreNull(getService().generateAudio(request));
    }

    /**
     * 播放指定题目语音，缺少媒体时先由服务端生成并保存。
     * 真实传参示例：{@code {id:100001}}。
     * 真实返回示例：{@code {success:true,data:{url:"/audio/x.mp3"}}}。
     * 异常或副作用示例：已有语音只读；缺少时新增 MP3 并更新题表媒体字段。
     *
     * @param request 题目主键
     * @return 固定公共 JSON
     */
    @PostMapping("play-audio.htm")
    public String playAudio(@RequestBody CommonParam request) {
        return JsonUtils.toJsonIgnoreNull(getService().playAudio(request));
    }
}
