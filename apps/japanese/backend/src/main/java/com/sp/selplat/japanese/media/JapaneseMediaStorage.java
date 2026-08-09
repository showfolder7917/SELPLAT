package com.sp.selplat.japanese.media;

import com.sp.selplat.japanese.media.model.JapaneseMediaAsset;
import java.nio.file.Path;

/** 定义媒体对象写入契约，本地目录和未来云对象存储必须返回同一访问结构。 */
public interface JapaneseMediaStorage {

    /**
     * 保存一份已经完成格式转换的题库媒体。
     * 真实传参示例：{@code IMAGE,/tmp/generated.webp}。
     * 真实返回示例：{@code {storageProvider:"local",url:"/pic/n2-blue-book-question-a.webp"}}。
     * 异常或副作用示例：写入失败时抛出系统异常；成功后新增一个媒体文件。
     *
     * @param mediaType 图片或语音类型
     * @param sourceFile 已生成的临时媒体文件
     * @return 可落库并供页面访问的媒体对象
     */
    JapaneseMediaAsset store(JapaneseMediaType mediaType, Path sourceFile);
}
