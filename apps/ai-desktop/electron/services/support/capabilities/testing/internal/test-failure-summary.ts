/** 测试失败摘要同时保留命令开头与错误尾部；中段省略不改变原始异常。 */
export function summarizeTestFailure(message: string): string {
  const limit = 2_000;
  if (message.length <= limit) return message;
  const marker = "\n…中间输出已省略…\n";
  const headingLength = 300;
  return message.slice(0, headingLength) + marker + message.slice(-(limit - headingLength - marker.length));
}
