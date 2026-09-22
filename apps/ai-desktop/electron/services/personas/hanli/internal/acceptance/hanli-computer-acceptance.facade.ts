import type { BrowserWindow } from "electron";
import type { HanliComputerAcceptanceInDto, HanliAcceptanceRunOutDto } from "../../../../../../contracts/services/personas/hanli/index.js";
import type { AttachmentFacade } from "../../../../support/platform/attachments/index.js";
import type { CodexDynamicToolsPort } from "../../../../support/platform/codex/index.js";
import type { HanliAcceptanceContinuation } from "./hanli-acceptance-continuation.policy.js";
import type { PageReviewInteractionPort } from "./hanli-acceptance-page.port.js";
import { HanliComputerAcceptanceRunner } from "./hanli-computer-acceptance.js";

export type { PageReviewInteractionPort } from "./hanli-acceptance-page.port.js";

/**
 * 韩立正式页面验收的唯一门面。
 *
 * 上层只认识 run；窗口工具、证据账本和会话状态机均封装在 runner 内，
 * 后续替换 Electron 页面适配器时不会扩散到 HanliFacade 或流程运行时。
 */
export class HanliComputerAcceptance {
  readonly #runner: HanliComputerAcceptanceRunner;

  constructor(screenshots: AttachmentFacade) {
    this.#runner = new HanliComputerAcceptanceRunner(screenshots);
  }

  run(
    goal: HanliComputerAcceptanceInDto,
    window: BrowserWindow,
    model: (
      tools: CodexDynamicToolsPort,
      session: { nextContinuation: () => HanliAcceptanceContinuation | null },
    ) => Promise<void>,
    progress: (message: string) => void,
    interactions: PageReviewInteractionPort,
  ): Promise<HanliAcceptanceRunOutDto> {
    return this.#runner.run(goal, window, model, progress, interactions);
  }
}
