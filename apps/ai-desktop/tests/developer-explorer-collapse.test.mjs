import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../src/variants/developer/DeveloperApp.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/variants/developer/developer.css", import.meta.url), "utf8");
const projectAgents = readFileSync(new URL("../../../AGENTS.md", import.meta.url), "utf8");
const activeUser = projectAgents.match(/^- 当前稳定用户 ID：`([^`]+)`$/m)?.[1];
if (!activeUser) throw new Error("AGENTS.md 未声明当前稳定用户 ID。");
const aiDesktopRuleRoot = `../ruleengine/rules/local/${activeUser}/selplat/应用/ai-desktop/`;
const aiDesktopRuleIndex = readFileSync(new URL(`${aiDesktopRuleRoot}RULE_INDEX.md`, import.meta.url), "utf8");
const aiDesktopRule = readFileSync(new URL(`${aiDesktopRuleRoot}rule/RUL_AIDesktop官方Harness接入规则.md`, import.meta.url), "utf8");
const workspaceRuntimeRule = readFileSync(new URL(`${aiDesktopRuleRoot}rule/RUL_AIDesktopHarness工作区与运行时规则.md`, import.meta.url), "utf8");

test("资源管理器折叠整栏并由活动栏图标恢复", () => {
  assert.match(component, /developer-shell.*explorer-collapsed/);
  assert.match(component, /aria-pressed=\{explorerExpanded\}/);
  assert.match(component, /setExplorerExpanded\(\(value\) => !value\)/);
  assert.match(styles, /\.developer-shell\.explorer-collapsed\s*\{[^}]*grid-template-columns:\s*52px 0/);
  assert.match(styles, /\.developer-shell\.explorer-collapsed \.dev-explorer\s*\{\s*display:\s*none/);
  assert.doesNotMatch(styles, /\.developer-shell\.explorer-collapsed \.dev-composer\s*\{/);
});

test("资源管理器宽度支持拖拽和键盘调整", () => {
  assert.match(component, /className="explorer-resizer"/);
  assert.match(component, /role="separator"[\s\S]*aria-orientation="vertical"/);
  assert.match(component, /onPointerDown=\{startExplorerResize\}/);
  assert.match(styles, /grid-template:[^;]*var\(--explorer-width\)/);
  assert.doesNotMatch(component, /workspace-pane-resizer/);
  assert.doesNotMatch(component, /workspacePaneHeight/);
  assert.doesNotMatch(styles, /workspace-pane-resizer/);
  assert.match(styles, /\.workspace-pane > \.workspace-list\s*\{[^}]*flex:\s*1 1 auto/);
  assert.doesNotMatch(styles, /\.workspace-list\s*\{[^}]*max-height:\s*calc\(100% - 164px\)/);
  assert.doesNotMatch(styles, /\.workspace-tree\s*\{[^}]*max-height:\s*210px/);
  assert.match(styles, /\.workspace-tree\s*\{[^}]*overflow:\s*visible/);
});

test("工作区与任务使用单一活动分区并让当前分区置顶占满", () => {
  assert.match(component, /activeExplorerSection/);
  assert.match(component, /setActiveExplorerSection\(\(current\) => current === section \? null : section\)/);
  assert.match(component, /active-\$\{activeExplorerSection \?\? "none"\}/);
  assert.match(component, /aria-controls="developer-task-list"/);
  assert.match(component, /aria-expanded=\{tasksSectionExpanded\}/);
  assert.match(component, /id="developer-task-list"/);
  assert.match(styles, /\.explorer-pane\.expanded\s*\{[^}]*flex:\s*1 1 auto;[^}]*order:\s*0/);
  assert.match(styles, /\.explorer-pane\.collapsed\s*\{[^}]*order:\s*1/);
  assert.match(styles, /\.explorer-pane\.collapsed > \.dev-section-title\s*\{[^}]*border-top:\s*1px solid var\(--sel-theme-line\)/);
  assert.doesNotMatch(styles, /\.tasks-pane\.expanded\s*\{[^}]*flex-basis:\s*180px/);
  assert.match(styles, /\.dev-section-title\.tasks\s*\{\s*border-top:\s*0/);
});

test("当前用户 AI Desktop 规则已登记侧栏单区独占与标签新建入口契约", () => {
  assert.match(aiDesktopRuleIndex, new RegExp(`AI_DESKTOP_OFFICIAL_HARNESS_RULES\\s*=\\s*local/${activeUser}/selplat/应用/ai-desktop/rule/RUL_AIDesktop官方Harness接入规则\\.md`));
  // 版本会随同一规则的后续能力递增；这里验证版本格式和本功能契约，避免把合法升级误报为回归。
  assert.match(aiDesktopRule, /rule_version\s*=\s*\d+\.\d+\.\d+/);
  // 聚合规则已按职责拆分；先核对依赖登记，再到工作区分片读取真实业务约束。
  assert.match(aiDesktopRule, /requires_rule_ids\s*=.*AI_DESKTOP_HARNESS_WORKSPACE_RUNTIME_RULES/);
  assert.match(aiDesktopRuleIndex, new RegExp(`AI_DESKTOP_HARNESS_WORKSPACE_RUNTIME_RULES\\s*=\\s*local/${activeUser}/selplat/应用/ai-desktop/rule/RUL_AIDesktopHarness工作区与运行时规则\\.md`));
  assert.match(workspaceRuntimeRule, /developer_sidebar_section_disclosure_contract\.3\s*=\s*workspace_tasks_single_active/);
  assert.match(workspaceRuntimeRule, /developer_sidebar_section_disclosure_contract\.4\s*=\s*refresh_conversation_action_in_codex_chat_tab_before_close_with_localized_rebuild_session_tip/);
  assert.match(workspaceRuntimeRule, /developer_sidebar_resizer_contract\.3\s*=\s*no_workspace_tasks_height_divider/);
  assert.match(workspaceRuntimeRule, /developer_sidebar_active_section_layout_contract\s*=\s*active_section_top_and_fill_available_height/);
  assert.match(workspaceRuntimeRule, /developer_sidebar_active_section_layout_contract\.2\s*=\s*inactive_section_heading_only_at_bottom/);
  assert.match(component, /<div className=\{`dev-tab\$\{evolutionWorkspacePerspective \? " with-workspace-action" : ""\}`\}><Prompt24Regular \/><span>\{collaborationMode \? collaborationTabTitle : "Codex Chat"\}<\/span>/);
  assert.match(component, /newCodexSession:\s*"重新建立一个 Codex 会话"/);
  assert.match(component, /className="tab-new-task"[^>]*data-sel-tooltip=\{text\.newCodexSession\}[^>]*data-sel-tooltip-mode="always"[^>]*aria-label=\{text\.newCodexSession\}[^>]*onClick=\{\(\) => void startNewTask\(\)\}[^>]*><ArrowClockwise24Regular \/><\/button>/);
  assert.doesNotMatch(component, /className="tab-new-task"[^>]*\stitle=/);
  assert.doesNotMatch(component, /className="section-action new-task"/);
  assert.match(styles, /\.dev-tab \.tab-new-task\s*\{/);
  assert.match(component, /tooltip\.attach\(host/);
  assert.doesNotMatch(styles, /data-tooltip|content:\s*attr\(/);
  assert.doesNotMatch(styles, /\.dev-section-title \.new-task\s*\{/);
});
