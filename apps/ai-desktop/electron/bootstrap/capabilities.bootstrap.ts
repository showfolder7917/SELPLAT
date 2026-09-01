import { mkdirSync } from "node:fs";
import path from "node:path";

import type { EventCenterFacade } from "../services/capabilities/event-center/index.js";
import { ConversationFacade } from "../services/capabilities/conversation/index.js";
import { RuleBundleFacade } from "../services/capabilities/rules/index.js";
import { AttachmentFacade } from "../services/platform/attachments/index.js";
import { createFileCodexSessionRepository } from "../services/platform/codex/index.js";
import { CommandGovernanceFacade } from "../services/platform/security/index.js";
import { SettingsFacade } from "../services/platform/settings/index.js";

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
  const codexHome = path.join(options.userDataRoot, "codex-home");
  mkdirSync(codexHome, { recursive: true });
  const collaborationRoot = path.join(options.userDataRoot, "collaboration");
  const screenshots = new AttachmentFacade(path.join(options.temporaryMaterialsRoot, "截图"));
  const dispatch = new ConversationFacade(
    path.join(options.userDataRoot, "conversation-dispatch.json"),
    (type, details, taskId) => options.eventCenter.recordEvent(type, details, taskId),
  );
  return { trustedCommands, codexSessions, settings, rules, codexHome, collaborationRoot, screenshots, dispatch };
}
