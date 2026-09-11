import {
  // useState 保存“新建令狐展示会话”请求是否正在执行，防止用户重复提交。
  useState,
} from "react";

import type {
  // LinghuAutomationStateOutDto 是主进程返回的最新令狐展示边界。
  LinghuAutomationStateOutDto,
} from "../../../../contracts/system/desktop/index";
import {
  // 协作 Desktop API 是新建令狐展示会话的唯一进程边界。
  getOptionalCollaborationDesktopApi,
} from "../../../foundation/desktop-api";

type LinghuDisplayConversationControllerOptions = {
  /** 将可恢复错误交还协作 Feature，确保工作区只显示一份错误状态。 */
  onError(message: string): void;
  /** 把主进程返回的令狐状态写回协作 Feature 的权威状态。 */
  onState(state: LinghuAutomationStateOutDto): void;
};

/**
 * 拥有令狐“新建展示会话”动作的副作用。
 *
 * 工作区 Section 只读取 busy 并触发 start，不再直接调用 Desktop API。
 */
export function useLinghuDisplayConversationController(
  options: LinghuDisplayConversationControllerOptions,
) {
  const [busy, setBusy] = useState(false);

  /** 创建新的可见会话边界，不启动巡检或后台任务。 */
  async function start() {
    if (busy) return;
    const collaborationApi = getOptionalCollaborationDesktopApi();
    if (!collaborationApi) {
      options.onError("请在桌面应用中操作");
      return;
    }

    setBusy(true);
    options.onError("");
    try {
      const state = await collaborationApi.newLinghuDisplayConversation();
      options.onState(state);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "无法新建会话";
      options.onError(message.replace(/^Error invoking remote method '[^']+':\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  return { busy, start };
}
