import type { ComposerAttachment } from "../../conversation";

/** 将剪贴板图片规范化为 PNG，避免各人物输入区重复维护浏览器图片转换逻辑。 */
export async function imageFileToPngDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("剪贴板内容不是图片。");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法读取剪贴板图片。");
    context.drawImage(bitmap, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}

/** 向会话追加已签发图片，并统一执行最多五张的输入约束。 */
export function appendComposerAttachment(current: ComposerAttachment[], attachment: ComposerAttachment): ComposerAttachment[] {
  return current.some((item) => item.id === attachment.id) || current.length >= 5 ? current : [...current, attachment];
}
