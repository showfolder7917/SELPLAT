package com.sp.selplat.japanese.media;

/** 固定日语题库当前允许写入的两类媒体目录和公开类型。 */
public enum JapaneseMediaType {
    // 图片统一进入 static/pic 并只接受最终 WebP。
    IMAGE("pic", "webp", "image/webp"),
    // 语音统一进入 static/audio 并保存 edge-tts 生成的 MP3。
    AUDIO("audio", "mp3", "audio/mpeg");

    private final String directory;
    private final String extension;
    private final String contentType;

    JapaneseMediaType(String directory, String extension, String contentType) {
        this.directory = directory;
        this.extension = extension;
        this.contentType = contentType;
    }

    /** @return 静态资源子目录，例如 {@code pic}。 */
    public String directory() {
        return directory;
    }

    /** @return 最终扩展名，例如 {@code webp}。 */
    public String extension() {
        return extension;
    }

    /** @return HTTP Content-Type，例如 {@code image/webp}。 */
    public String contentType() {
        return contentType;
    }
}
