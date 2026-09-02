import { mkdirSync } from "node:fs";
import path from "node:path";

import type { EventCenterFacade } from "../../services/support/capabilities/event-center/index.js";
import { ConversationFacade } from "../../services/support/capabilities/conversation/index.js";
import { PromptLibraryFacade } from "../../services/support/capabilities/prompts/index.js";
import { RuleBundleFacade } from "../../services/support/capabilities/rules/index.js";
import { AttachmentFacade } from "../../services/support/platform/attachments/index.js";
import { createFileCodexSessionRepository } from "../../services/support/platform/codex/index.js";
import { CommandGovernanceFacade } from "../../services/support/platform/security/index.js";
import { SettingsFacade } from "../../services/support/platform/settings/index.js";

export interface CapabilityBootstrapOptions {
  userDataRoot: string;
  buildRoot: string;
  temporaryMaterialsRoot: string;
  packaged: boolean;
  resourcesPath: string;
  eventCenter: EventCenterFacade;
}

/** 创建不依赖人物和 Workflow 的公共能力，并返回可注入的公开 Facade。 */
export function createCapabilityContext(options: CapabilityBootstrapOptions) {
  const trustedCommands = new CommandGovernanceFacade(path.join(options.userDataRoot, "trusted-project-commands.json"));
  const codexSessions = createFileCodexSessionRepository(path.join(options.userDataRoot, "active-codex-session.json"));
  const settings = new SettingsFacade(path.join(options.userDataRoot, "desktop-settings.json"));
  const rules = new RuleBundleFacade(
    options.packaged ? path.join(options.resourcesPath, "ruleengine") : path.join(options.buildRoot, "rule-bundle"),
    path.join(options.userDataRoot, "ruleengine", "overrides"),
  );
  // 内置提示词和规则分别打包；提示词只改变 AI 表达与判断，不能扩大规则或沙箱权限。
  const prompts = new PromptLibraryFacade(
    options.packaged ? path.join(options.resourcesPath, "prompts") : path.join(options.buildRoot, "prompt-bundle"),
  );
  const codexHome = path.join(options.userDataRoot, "codex-home");
  mkdirSync(codexHome, { recursive: true });
  const collaborationRoot = path.join(options.userDataRoot, "collaboration");
  const screenshots = new AttachmentFacade(path.join(options.temporaryMaterialsRoot, "截图"));
  const dispatch = new ConversationFacade(
    path.join(options.userDataRoot, "conversation-dispatch.json"),
    (type, details, taskId) => options.eventCenter.recordEvent(type, details, taskId),
  );
  return { trustedCommands, codexSessions, settings, rules, prompts, codexHome, collaborationRoot, screenshots, dispatch };
}
