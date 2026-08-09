package com.sp.selplat.japanese.media.model;

/**
 * 统一描述本地或未来云存储返回的媒体对象。
 *
 * @param storageProvider 存储提供方，例如 {@code local}
 * @param objectKey 提供方内部对象键，例如 {@code pic/n2-blue-book-question-abc.webp}
 * @param url 页面可直接访问的地址，例如 {@code /pic/n2-blue-book-question-abc.webp}
 * @param contentType 媒体类型，例如 {@code image/webp}
 * @param sizeBytes 文件字节数，例如 {@code 23841}
 */
public record JapaneseMediaAsset(
        String storageProvider,
        String objectKey,
        String url,
        String contentType,
        long sizeBytes) {
}
