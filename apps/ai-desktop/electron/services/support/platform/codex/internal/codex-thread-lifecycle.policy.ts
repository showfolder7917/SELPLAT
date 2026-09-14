/**
 * 判断官方 Codex 存储是否已经不存在指定线程。
 *
 * 线程已经消失时，删除动作的目标已经满足；恢复动作也不能再通过重试成功。
 * 统一识别这一事实后，上层可以清除单个人物的失效恢复凭据并建立新线程，
 * 同时保留 AI Memory 中的业务会话和历史消息。
 */
export function isMissingCodexThreadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no rollout found for thread id/i.test(message);
}
