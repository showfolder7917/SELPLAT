/**
 * Codex 会话页面的 Section。
 *
 * Controller 提供业务状态，ViewModel 选择文案和对话框状态，子组件负责各自可见区域。
 */

import { createCodexConversationViewModel } from "../model/createCodexConversationViewModel";
import { AutomaticTestDialog } from "./AutomaticTestDialog";
import type { CodexConversationWorkspaceProps } from "./CodexConversationWorkspace.types";
import { CodexConversationComposer } from "./CodexConversationWorkspace/CodexConversationComposer";
import { CodexConversationTimeline } from "./CodexConversationWorkspace/CodexConversationTimeline";

/** 按时间线、编辑区和自动测试提示的顺序组合主 Codex 会话。 */
export function CodexConversationWorkspace(props: CodexConversationWorkspaceProps) {
  // 显示模型（ViewModel）统一选择语言文案，并把自动测试状态转换为纯对话框输入。
  const viewModel = createCodexConversationViewModel(props);

  return (
    <>
      {/* 消息时间线显示客户与 Codex 的完整交流。 */}
      <CodexConversationTimeline
        locale={props.locale}
        controller={props.controller}
        collaboration={props.collaboration}
        text={viewModel.text}
      />

      {/* 会话编辑区显示队列、附件、输入框和截图工具。 */}
      <CodexConversationComposer
        locale={props.locale}
        sandboxMode={props.sandboxMode}
        controller={props.controller}
        screenshot={props.screenshot}
        text={viewModel.text}
      />

      {/* 纯对话框只显示 ViewModel 已经准备好的阻断信息。 */}
      <AutomaticTestDialog viewModel={viewModel.automaticTestDialog} />
    </>
  );
}
