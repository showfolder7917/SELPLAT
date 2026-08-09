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
     * 直接调用本机 Codex CLI 生成题目解释。
     * 真实传参示例：题干、四项选择和正确答案 D。
     * 真实返回示例：{@code {success:true,data:{explanation:"給与读作きゅうよ"}}}。
     * 异常或副作用示例：Codex 不可用时返回统一系统异常；不修改题目记录。
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
}
