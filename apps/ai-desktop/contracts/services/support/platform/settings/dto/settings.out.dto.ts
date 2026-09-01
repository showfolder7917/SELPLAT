/**
 * 桌面设置协议，保存用户可配置且允许跨进程传递的运行偏好。
 *
 * 生产者：Renderer 设置面板和主进程 SettingsStore。
 * 消费者：Codex 会话创建、界面本地化和沙箱配置流程。
 * 数据方向：renderer <-> preload <-> main。
 * 本文件不保存认证令牌、机器私密路径或服务实现对象。
 */
import type { LocaleValue, ModelServiceTierValue, ReasoningEffortValue, SandboxModeValue } from "../../../../../foundation/index.js";

export interface DesktopSettingsOutDto {
  locale: LocaleValue;
  sandboxMode: SandboxModeValue;
  defaultModel: string | null;
  reasoningEffort: ReasoningEffortValue | null;
  serviceTier: ModelServiceTierValue;
  codexAppCorpusIngestionEnabled: boolean;
}
