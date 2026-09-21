import { randomUUID } from "node:crypto";
import type { BrowserWindow } from "electron";
import type { CodexDynamicToolsPort } from "../../../../support/platform/codex/index.js";
import type { AttachmentFacade } from "../../../../support/platform/attachments/index.js";
import type { HanliComputerAcceptanceInDto, HanliAcceptanceRunOutDto, HanliAcceptanceStepResultOutDto } from "../../../../../../contracts/services/personas/hanli/index.js";
import { selectHanliAcceptanceContinuation, type HanliAcceptanceContinuation } from "./hanli-acceptance-continuation.policy.js";

// 授权由主进程登记的正式窗口会话实时判断，模型不能扩大权限。
export type AcceptancePrivateAction = "persona-navigation";
export interface PageReviewInteractionPort {
  allows(action: AcceptancePrivateAction): boolean;
}

/** 重载同一正式 renderer，并等到主文档完成加载；该动作不切换地址也不触发业务写入。 */
async function reloadFormalPage(window: BrowserWindow): Promise<void> {
  if (window.isDestroyed()) throw new Error("正式应用窗口已关闭，不能重开页面。");
  const webContents = window.webContents;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeout);
      webContents.removeListener("did-finish-load", onLoaded);
      webContents.removeListener("did-fail-load", onFailed);
      webContents.removeListener("render-process-gone", onRendererGone);
      window.removeListener("closed", onClosed);
    };
    const complete = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onLoaded = () => complete();
    const onFailed = () => complete(new Error("正式页面重开失败。"));
    const onRendererGone = () => complete(new Error("正式页面重开时 renderer 已退出。"));
    const onClosed = () => complete(new Error("正式页面重开时窗口已关闭。"));
    const timeout = setTimeout(() => complete(new Error("正式页面重开等待超时。")), 15_000);
    webContents.once("did-finish-load", onLoaded);
    webContents.once("did-fail-load", onFailed);
    webContents.once("render-process-gone", onRendererGone);
    window.once("closed", onClosed);
    webContents.reload();
  });
  // did-finish-load 后给正式页面一次稳定渲染窗口，再由统一截图链取证。
  await new Promise((resolve) => setTimeout(resolve, 350));
}

/** 仅提供当前应用窗口的单步输入和真实截图，下一动作由模型看到结果后选择。 */
export class HanliComputerAcceptance {
  /** 当前是否已有一轮窗口验收在执行；同一窗口不允许并发控制。 */
  #active = false;
  /** 截图附件存储门面；保存每一步观察与最终判断引用的真实证据。 */
  readonly #screenshots: AttachmentFacade;

  constructor(screenshots: AttachmentFacade) {
    this.#screenshots = screenshots;
  }

  async run(
    goal: HanliComputerAcceptanceInDto,
    window: BrowserWindow,
    model: (
      tools: CodexDynamicToolsPort,
      session: { nextContinuation: () => HanliAcceptanceContinuation | null },
    ) => Promise<void>,
    progress: (message: string) => void,
    interactions: PageReviewInteractionPort,
  ): Promise<HanliAcceptanceRunOutDto> {
    if (this.#active) {
      throw new Error("韩立正在验收，不能同时控制同一窗口。");
    }
    if (!goal.criteria.length) {
      throw new Error("缺少用户验收条件。");
    }
    const criterionIds = goal.criterionIds || goal.criteria.map((_, index) => `criterion-${index + 1}`);
    if (criterionIds.length !== goal.criteria.length || new Set(criterionIds).size !== criterionIds.length
      || criterionIds.some((criterionId) => !/^criterion-[1-9]\d*$/.test(criterionId))) {
      throw new Error("页面验收条件编号必须与当前条件一一对应，并保留原提案编号。");
    }
    const taskCollaborationCriterionIds = new Set(goal.taskCollaborationCriterionIds || []);
    if ([...taskCollaborationCriterionIds].some((criterionId) => !criterionIds.includes(criterionId))) {
      throw new Error("任务协作群页面条件必须属于当前正式页面验收目标。");
    }
    this.#active = true;
    const runId = `hanli-computer-${randomUUID()}`;
    const startedAt = new Date().toISOString();
    const initialBounds = window.getBounds();
    // 操作轨迹只证明真实输入已经发生，不能作为某条原验收条件的最终判断。
    const interactionSteps: HanliAcceptanceStepResultOutDto[] = [];
    // 逐条件结果只保存 finish 或受阻兜底形成的 judgement，供场景编号和证据门禁使用。
    const stepResults: HanliAcceptanceStepResultOutDto[] = [];
    const evidence: string[] = [];
    const postInputEvidence = new Set<string>();
    // 把每张截图与本次动作真正核对的验收条件绑定；finish 不能再用首个失败后的同一张通用截图填满其余条件。
    const criterionEvidenceIds = new Map<string, Set<string>>();
    const taskCollaborationEvidenceIds = new Set<string>();
    let snapshot = "";
    let busy = false;
    let closed = false;
    let inputCount = 0;
    let calls = 0;
    let verdict: "passed" | "failed" | "blocked" = "blocked";
    let completed = false;
    // 终态回合复用同一动态工具，但在模型遗漏 finish 时只保留提交判断这一条路径。
    let finalizationOnly = false;
    // 仅记录 finish 的受限终态，供未完成验收回到同一提案时区分模型未调用与参数被拒绝。
    let finishAttempted = false;
    let finishRejection = "";
    let correctionAttempted = false;
    // 窄窗口只用于当前验收的固定预设；无论验收如何结束都还原起始尺寸。
    let formalWindowResized = false;
    let coordinateSpace: AcceptanceCoordinateSpace = { screenshot: { width: 1, height: 1 }, viewport: { width: 1, height: 1 } };
    const images = async (interactionEvidence?: Record<string, unknown>) => {
      if (window.isDestroyed()) {
        throw new Error("正式应用窗口已关闭");
      }
      const bitmap = await window.webContents.capturePage();
      const screenshotSize = bitmap.getSize();
      const viewport = await window.webContents.executeJavaScript(`(${readAcceptanceViewport.toString()})()`).catch(() => screenshotSize) as AcceptanceViewport;
      const pageEvidence = await window.webContents.executeJavaScript(`(${readAcceptancePageEvidence.toString()})()`).catch(() => ({ status: "unavailable" })) as Record<string, unknown>;
      const taskCollaboration = await window.webContents.executeJavaScript(`(${readTaskCollaborationSurface.toString()})()`).catch(() => ({ status: "unavailable" })) as Record<string, unknown>;
      coordinateSpace = createAcceptanceCoordinateSpace(screenshotSize, viewport);
      const data = bitmap.toDataURL();
      const attachment = await this.#screenshots.save({
        originalDataUrl: data,
        annotatedDataUrl: data,
        hasAnnotations: false,
      });
      snapshot = attachment.id;
      evidence.push(snapshot);
      if (taskCollaboration.status === "visible") taskCollaborationEvidenceIds.add(snapshot);
      if (inputCount > 0) {
        postInputEvidence.add(snapshot);
      }
      const criteria: Array<{ id: string; text: string }> = [];
      for (const [index, text] of goal.criteria.entries()) {
        criteria.push({
          id: criterionIds[index],
          text,
        });
      }
      const observation = {
        observationId: snapshot,
        size: screenshotSize,
        coordinateSpace,
        criteria,
        pageEvidence: { ...pageEvidence, taskCollaboration },
        instruction: taskCollaborationCriterionIds.size
          ? "仅当本步 criterionIds 包含任务卡条件时，才通过 open-task-panel 与 open-task-collaboration 到达任务协作群，并以该页面截图裁决；自由讨论页没有任务卡时只能继续导航或报告验收能力受阻，不能判产品失败。核对其他条件时，若 pageEvidence.status 为 no-visible-conversation，先依据当前截图点击已可见的韩立人物入口回到既有会话；这只切换页面，不发送消息、不修改任务或设置。若入口不可见或点击后仍无会话，再报告验收能力受阻。每一步都先取得新截图，导航后再观察真实页面。"
          : "依据当前正式应用截图选择一个只读或安全导航动作。若 pageEvidence.status 为 no-visible-conversation，先依据当前截图点击已可见的韩立人物入口回到既有会话；这只切换页面，不发送消息、不修改任务或设置。若入口不可见或点击后仍无会话，再报告验收能力受阻。每一步都先取得新截图，导航后再观察真实页面。只判断客户能直接看到和安全操作的页面结果；原验收条件明确要求在当前人物会话内新建或重新建立会话时，允许执行该项可追溯操作。禁止发送消息、修改设置、操作任务流程或扩大到条件未授权的数据，不读取任务时间线或测试记录。",
        ...(interactionEvidence ? { interactionEvidence } : {}),
      };
      return {
        contentItems: [
          {
            type: "inputText" as const,
            text: JSON.stringify(observation),
          },
          {
            type: "inputImage" as const,
            imageUrl: data,
          },
        ],
        success: true,
      };
    };
    const tools: CodexDynamicToolsPort = {
      definitions: [{
        type: "function",
        name: "hanli_computer",
        description: "观察当前正式 AI Desktop 窗口，基于最新截图执行一个只读或安全导航动作，或提交带证据的验收判断。每个页面动作必须声明本步实际核对的 criterionIds；发现失败后仍须继续其余可安全执行条件，最后一次提交完整结果。每条条件必须独立提交功能结果和布局结果，不能以操作成功代替。允许重载当前正式页面；原验收条件明确要求时，允许在当前人物会话内新建或重新建立会话并保留旧记录。禁止发送消息、修改设置、操作任务流程或修改条件未授权的数据。每次动作返回新截图，禁止批量操作。",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["observe", "click", "drag", "scroll", "scroll-task-collaboration", "toggle-task-audit-card", "open-task-panel", "close-task-panel", "open-task-collaboration", "open-hanli-conversation", "scroll-settings-panel", "resize-formal-window", "reload-formal-page", "key", "hover", "finish"],
            },
            observationId: { type: "string", description: "除 observe 外必须原样填写最近一次工具回执中的 observationId；它是截图身份，不能使用步骤编号或自己生成的值。" },
            x: { type: "integer" },
            y: { type: "integer" },
            endX: { type: "integer" },
            endY: { type: "integer" },
            deltaY: { type: "integer" },
            auditCardIndex: {
              type: "integer",
              description: "仅供 toggle-task-audit-card 使用：历史审计中从 0 开始的只读卡序号。该动作只展开或收起对应审计卡，不会触发恢复、审批或派发。",
            },
            resizePreset: {
              type: "string",
              enum: ["narrow", "restore"],
              description: "仅供 resize-formal-window 使用：切换正式应用的固定窄窗口预设或恢复起始尺寸。",
            },
            key: {
              type: "string",
              enum: ["Tab", "Escape", "Home", "ArrowDown", "ArrowUp", "PageDown", "PageUp"],
            },
            reason: { type: "string" },
            criterionIds: {
              type: "array",
              items: { type: "string", enum: criterionIds },
              uniqueItems: true,
              description: "本次观察或动作实际核对的原验收条件编号。除首次总览 observe 和 finish 外不能为空；只有同一动作后的画面能直接支持多个条件时才能同时填写多个编号。",
            },
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  criterionId: { type: "string", enum: criterionIds },
                  status: {
                    type: "string",
                    enum: ["passed", "failed", "blocked"],
                  },
                  blockerKind: {
                    type: "string",
                    enum: ["acceptance-capability", "runtime-environment"],
                    description: "仅当功能或布局为 blocked 时填写；观察到真实页面或安全不符合时必须使用 failed。",
                  },
                  actual: { type: "string" },
                  evidenceId: { type: "string" },
                  layoutStatus: {
                    type: "string",
                    enum: ["passed", "failed", "blocked"],
                  },
                  layoutActual: { type: "string" },
                  layoutEvidenceId: { type: "string" },
                },
                required: ["criterionId", "status", "actual", "evidenceId", "layoutStatus", "layoutActual", "layoutEvidenceId"],
                additionalProperties: false,
              },
            },
          },
          required: ["action", "reason"],
          additionalProperties: false,
        },
      }],
      call: async (_name, raw) => {
        if (closed || completed || window.isDestroyed()) {
          throw new Error("当前验收已结束，交互工具授权已收回。");
        }
        if (busy) {
          throw new Error("上一步尚未返回新截图，禁止并发操作。");
        }
        calls += 1;
        if (calls > 60) {
          throw new Error("本轮已达到60次工具调用上限，保留证据，禁止无限操作。");
        }
        busy = true;
        let attemptedFinish = false;
        try {
          const args = raw as Record<string, unknown>;
          // 提交即使缺少 reason 或最新截图编号，也必须保留为被拒绝的提交尝试。
          attemptedFinish = args?.action === "finish";
          if (attemptedFinish) finishAttempted = true;
          if (!args || typeof args.reason !== "string" || !args.reason.trim()) {
            throw new Error("必须说明当前操作与验收目标的关系");
          }
          if (finalizationOnly && args.action !== "finish") {
            throw new Error("终态回合只允许提交 finish，不能继续操作应用。");
          }
          if (args.action === "observe") {
            const output = await images();
            const observedCriterionIds = validateCriterionCoverage(args.criterionIds, criterionIds, false);
            for (const criterionId of observedCriterionIds) {
              addCriterionEvidence(criterionEvidenceIds, criterionId, snapshot);
            }
            return output;
          }
          if (!snapshot || args.observationId !== snapshot) {
            // 拒绝旧画面动作，同时回传可恢复的观察身份；不执行输入，也不放宽新鲜度校验。
            throw new Error(`必须基于最新截图操作。当前 observationId：${snapshot || "尚未观察"}。本次动作未执行；请重新 observe 获取画面，再原样使用回执中的 observationId。`);
          }
          if (args.action === "finish") {
            if (!Array.isArray(args.findings) || args.findings.length !== goal.criteria.length) {
              throw new Error("每条验收条件都必须返回真实结果，不能漏项。");
            }
            const findings = args.findings as Array<Record<string, unknown>>;
            const containsResultWithoutInteraction = inputCount === 0
              && findings.some((item) => item.status !== "blocked" || item.layoutStatus !== "blocked");
            if (containsResultWithoutInteraction) {
              throw new Error("尚未执行真实交互，功能和布局都只能报告受阻，不能声称验收通过或失败。");
            }
            for (const [index] of goal.criteria.entries()) {
              const criterionId = criterionIds[index];
              const matching = findings.filter((item) => item.criterionId === criterionId);
              const finding = matching[0];
              const hasSingleFinding = matching.length === 1;
              const hasKnownStatus = finding
                ? ["passed", "failed", "blocked"].includes(String(finding.status))
                : false;
              const hasActualResult = finding
                ? typeof finding.actual === "string" && Boolean(finding.actual.trim())
                : false;
              const hasKnownLayoutStatus = finding
                ? ["passed", "failed", "blocked"].includes(String(finding.layoutStatus))
                : false;
              const hasBlockedResult = finding?.status === "blocked" || finding?.layoutStatus === "blocked";
              const hasKnownBlockerKind = finding
                ? ["acceptance-capability", "runtime-environment"].includes(String(finding.blockerKind))
                : false;
              const hasLayoutResult = finding
                ? typeof finding.layoutActual === "string" && Boolean(finding.layoutActual.trim())
                : false;
              let hasValidEvidence = false;
              let hasValidLayoutEvidence = false;
              if (finding?.status === "blocked") {
                hasValidEvidence = evidence.includes(String(finding.evidenceId))
                  && criterionEvidenceIds.get(criterionId)?.has(String(finding.evidenceId)) === true;
              } else if (finding) {
                hasValidEvidence = postInputEvidence.has(String(finding.evidenceId))
                  && criterionEvidenceIds.get(criterionId)?.has(String(finding.evidenceId)) === true;
              }
              if (finding?.layoutStatus === "blocked") {
                hasValidLayoutEvidence = evidence.includes(String(finding.layoutEvidenceId))
                  && criterionEvidenceIds.get(criterionId)?.has(String(finding.layoutEvidenceId)) === true;
              } else if (finding) {
                hasValidLayoutEvidence = postInputEvidence.has(String(finding.layoutEvidenceId))
                  && criterionEvidenceIds.get(criterionId)?.has(String(finding.layoutEvidenceId)) === true;
              }
              if (!hasSingleFinding || !hasKnownStatus || !hasActualResult || !hasValidEvidence
                || !hasKnownLayoutStatus || !hasLayoutResult || !hasValidLayoutEvidence) {
                throw new Error(`${criterionId}缺少唯一功能判断、布局判断或该条件自己核对后的真实截图依据；记录当前失败后继续执行其余可安全验收条件，再一次提交完整结果`);
              }
              if (hasBlockedResult && !hasKnownBlockerKind) {
                throw new Error(`${criterionId}受阻时必须说明材料、验收能力或运行环境原因；真实页面或安全不符合应填写 failed`);
              }
              if (taskCollaborationCriterionIds.has(criterionId)) {
                if (finding?.status !== "blocked" && !taskCollaborationEvidenceIds.has(String(finding?.evidenceId))) {
                  throw new Error(`${criterionId}必须在任务协作群页面截图上裁决，不能由自由讨论页判定产品结果`);
                }
                if (finding?.layoutStatus !== "blocked" && !taskCollaborationEvidenceIds.has(String(finding?.layoutEvidenceId))) {
                  throw new Error(`${criterionId}的布局结论必须在任务协作群页面截图上裁决，不能由自由讨论页判定产品结果`);
                }
              }
            }
            const containsFailure = findings.some((item) => item.status === "failed" || item.layoutStatus === "failed");
            const containsBlocker = findings.some((item) => item.status === "blocked" || item.layoutStatus === "blocked");
            if (containsFailure) {
              verdict = "failed";
            } else if (containsBlocker) {
              verdict = "blocked";
            } else {
              verdict = "passed";
            }
            for (const item of findings) {
              stepResults.push({
                checkId: String(item.criterionId),
                evidenceMode: "page-experience",
                operationIndex: interactionSteps.length + stepResults.length,
                operation: {
                  type: "judgement",
                  criterionId: String(item.criterionId),
                },
                status: item.status as "passed" | "failed" | "blocked",
                blockerKind: item.blockerKind as HanliAcceptanceStepResultOutDto["blockerKind"],
                actual: String(item.actual),
                layoutStatus: item.layoutStatus as "passed" | "failed" | "blocked",
                layoutActual: String(item.layoutActual),
                layoutScreenshotAttachmentId: String(item.layoutEvidenceId),
                screenshotAttachmentId: String(item.evidenceId),
                occurredAt: new Date().toISOString(),
              });
            }
            completed = true;
            let verdictLabel = "受阻";
            if (verdict === "passed") {
              verdictLabel = "通过";
            } else if (verdict === "failed") {
              verdictLabel = "未通过";
            }
            const findingLines: string[] = [];
            for (const item of findings) {
              findingLines.push(`${item.criterionId}：功能 ${item.actual}；布局 ${item.layoutActual}`);
            }
            progress(`韩立验收${verdictLabel}：\n${findingLines.join("\n")}`);
            return { success: true, contentItems: [{ type: "inputText", text: "验收判断已归档，工具权限已收回。" }] };
          }
          if (interactionSteps.length >= 40) {
            throw new Error("本轮达到40步操作上限，需保留证据并说明未完成项。");
          }
          const coveredCriterionIds = validateCriterionCoverage(args.criterionIds, criterionIds, true);
          window.show();
          window.focus();
          let dragEvidence: Record<string, unknown> | null = null;
          let settingsPanelEvidence: Record<string, unknown> | null = null;
          let taskCollaborationEvidence: Record<string, unknown> | null = null;
          let hanliConversationEvidence: Record<string, unknown> | null = null;
          let windowResizeEvidence: Record<string, unknown> | null = null;
          let pageReloadEvidence: Record<string, unknown> | null = null;
          if (args.action === "scroll-task-collaboration") {
            const deltaY = Number(args.deltaY);
            if (!Number.isInteger(args.deltaY) || Math.abs(deltaY) > 1000 || deltaY === 0) {
              throw new Error("任务协作页滚动距离必须为非零整数且不超过1000。");
            }
            const result = await window.webContents.executeJavaScript(`(${scrollTaskCollaboration.toString()})(${deltaY})`) as Record<string, unknown>;
            if (result.status !== "scrolled" && result.status !== "at-boundary" && result.status !== "not-ready") {
              throw new Error(`任务协作页未滚动：${String(result.status)}。`);
            }
            taskCollaborationEvidence = result;
          } else if (args.action === "toggle-task-audit-card") {
            if (!interactions.allows("persona-navigation")) {
              throw new Error("当前正式验收未获任务协作群导航授权。");
            }
            const auditCardIndex = Number(args.auditCardIndex);
            if (!Number.isInteger(auditCardIndex) || auditCardIndex < 0) {
              throw new Error("审计卡序号必须是从 0 开始的非负整数。");
            }
            const result = await window.webContents.executeJavaScript(`(${toggleTaskAuditCard.toString()})(${auditCardIndex})`) as Record<string, unknown>;
            if (result.status !== "opened" && result.status !== "closed") {
              throw new Error(`历史审计卡未切换：${String(result.status)}。`);
            }
            taskCollaborationEvidence = result;
          } else if (args.action === "open-task-panel" || args.action === "close-task-panel" || args.action === "open-task-collaboration") {
            if (!interactions.allows("persona-navigation")) {
              throw new Error("当前正式验收未获任务面板导航授权。");
            }
            const result = await window.webContents.executeJavaScript(`(${navigateTaskCollaboration.toString()})(${JSON.stringify(args.action)})`) as Record<string, unknown>;
            if (result.status !== "opened" && result.status !== "closed" && result.status !== "already-open" && result.status !== "already-closed" && result.status !== "navigated" && result.status !== "already-visible" && result.status !== "task-panel-not-open" && result.status !== "task-panel-not-closed" && result.status !== "task-group-not-visible") {
              throw new Error(`任务协作群导航未完成：${String(result.status)}。`);
            }
            taskCollaborationEvidence = result;
          } else if (args.action === "open-hanli-conversation") {
            if (!interactions.allows("persona-navigation")) {
              throw new Error("当前正式验收未获韩立会话导航授权。");
            }
            hanliConversationEvidence = await window.webContents.executeJavaScript(`(${navigateHanliConversation.toString()})()`) as Record<string, unknown>;
          } else if (args.action === "scroll-settings-panel") {
            const deltaY = Number(args.deltaY);
            if (!Number.isInteger(args.deltaY) || Math.abs(deltaY) > 1000 || deltaY === 0) {
              throw new Error("设置浮层滚动距离必须为非零整数且不超过1000。");
            }
            const result = await window.webContents.executeJavaScript(`(${scrollSettingsPanel.toString()})(${deltaY})`) as Record<string, unknown>;
            if (result.status !== "scrolled" && result.status !== "at-boundary") {
              throw new Error(`设置浮层未滚动：${String(result.status)}。`);
            }
            settingsPanelEvidence = result;
          } else if (args.action === "resize-formal-window") {
            // 全应用布局验收不依赖测试台是否打开；尺寸仍限应用支持的预设。
            if (args.resizePreset === "narrow") {
              // 仅使用应用本身支持的最小窗口预设，保留初始位置，禁止模型提供任意尺寸。
              window.setBounds({ ...initialBounds, width: 1000, height: 700 });
              formalWindowResized = true;
              windowResizeEvidence = { preset: "narrow", bounds: window.getBounds() };
            } else if (args.resizePreset === "restore") {
              if (!formalWindowResized) {
                throw new Error("本轮尚未切换窄窗口，不能恢复尺寸。");
              }
              window.setBounds(initialBounds);
              formalWindowResized = false;
              windowResizeEvidence = { preset: "restore", bounds: window.getBounds() };
            } else {
              throw new Error("窗口尺寸只允许 narrow 或 restore 预设。");
            }
          } else if (args.action === "reload-formal-page") {
            // 只刷新当前正式 renderer；不关闭窗口、不切换地址，也不调用任何业务 IPC。
            await reloadFormalPage(window);
            pageReloadEvidence = { status: "reloaded" };
          } else if (args.action === "hover") {
            const { width, height } = window.getContentBounds();
            assertPointInsideWindow(args.x, args.y, coordinateSpace.screenshot.width, coordinateSpace.screenshot.height, "悬停坐标必须位于当前截图内。");
            const point = mapScreenshotPointToViewport(args.x, args.y, coordinateSpace);
            assertPointInsideWindow(point.x, point.y, width, height, "换算后的悬停坐标必须位于当前应用窗口内。");
            window.webContents.sendInputEvent({ type: "mouseMove", x: point.x, y: point.y });
          } else if (args.action === "click" || args.action === "drag" || args.action === "scroll") {
            const { width, height } = window.getContentBounds();
            assertPointInsideWindow(args.x, args.y, coordinateSpace.screenshot.width, coordinateSpace.screenshot.height, "坐标必须位于当前截图内。");
            const point = mapScreenshotPointToViewport(args.x, args.y, coordinateSpace);
            assertPointInsideWindow(point.x, point.y, width, height, "换算后的坐标必须位于当前应用窗口内。");
            if (args.action === "click") {
              // 只用DOM做安全拦截，绝不通过DOM替模型定位或断言成功。
              const clickStatus = await window.webContents.executeJavaScript(`(${readNavigationClickStatus.toString()})(${point.x},${point.y},(x,y) => (${safeNavigationClick.toString()})(x,y,${interactions.allows("persona-navigation")}))`) as "allowed" | "missed" | "restricted";
              if (closed) {
                throw new Error("验收已终止，未执行点击。");
              }
              if (clickStatus === "missed") {
                throw new Error(`截图坐标 (${args.x}, ${args.y}) 未命中按钮或导航控件，未执行点击。这不是权限拒绝；请在本轮 observe 重新查看截图，校正按钮中心位置后再点击，不能据此判定页面或验收权限受阻。`);
              }
              if (clickStatus !== "allowed") {
                throw new Error("已命中控件，但该控件不在允许的导航范围内，未执行点击。不能换工具绕过限制。");
              }
              window.webContents.sendInputEvent({ type: "mouseDown", x: point.x, y: point.y, button: "left", clickCount: 1 });
              window.webContents.sendInputEvent({ type: "mouseUp", x: point.x, y: point.y, button: "left", clickCount: 1 });
            } else if (args.action === "drag") {
              assertPointInsideWindow(args.endX, args.endY, coordinateSpace.screenshot.width, coordinateSpace.screenshot.height, "拖拽终点必须位于当前截图内。");
              const endPoint = mapScreenshotPointToViewport(args.endX, args.endY, coordinateSpace);
              assertPointInsideWindow(endPoint.x, endPoint.y, width, height, "换算后的拖拽终点必须位于当前应用窗口内。");
              const safe = await window.webContents.executeJavaScript(`(${safeImagePreviewDrag.toString()})(${point.x},${point.y})`) as boolean;
              if (!safe) throw new Error("拖拽只允许命中已打开图片预览的查看区域，未执行输入。");
              window.webContents.sendInputEvent({ type: "mouseMove", x: point.x, y: point.y });
              window.webContents.sendInputEvent({ type: "mouseDown", x: point.x, y: point.y, button: "left", clickCount: 1 });
              window.webContents.sendInputEvent({ type: "mouseMove", x: endPoint.x, y: endPoint.y });
              // 鼠标释放前读取计算样式，截图不含系统指针时仍可证明抓手和拖动状态。
              await window.webContents.executeJavaScript("new Promise((resolve) => requestAnimationFrame(() => resolve(null)))");
              dragEvidence = await window.webContents.executeJavaScript(`(${readImagePreviewState.toString()})()`).catch(() => null);
              window.webContents.sendInputEvent({ type: "mouseUp", x: endPoint.x, y: endPoint.y, button: "left", clickCount: 1 });
            } else {
              const deltaY = Number(args.deltaY);
              if (!Number.isInteger(args.deltaY) || Math.abs(deltaY) > 1000 || deltaY === 0) {
                throw new Error("滚动距离必须为非零整数且不超过1000。");
              }
              window.webContents.sendInputEvent({ type: "mouseWheel", x: point.x, y: point.y, deltaY: Number(args.deltaY), deltaX: 0 });
            }
          } else if (args.action === "key" && ["Tab", "Escape", "Home", "ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(String(args.key))) {
            window.webContents.sendInputEvent({ type: "keyDown", keyCode: String(args.key) });
            window.webContents.sendInputEvent({ type: "keyUp", keyCode: String(args.key) });
          } else throw new Error("不支持的单步操作");
          // 前置状态读取不产生页面输入，不能成为通过或失败判断的交互证据。
          inputCount += 1;
          snapshot = "";
          await new Promise((resolve) => setTimeout(resolve, 150));
          const previewEvidence = await window.webContents.executeJavaScript(`(${readImagePreviewState.toString()})()`).catch(() => null);
          const interactionEvidence = {
            imagePreview: previewEvidence,
            ...(dragEvidence ? { imagePreviewDuringDrag: dragEvidence } : {}),
            ...(settingsPanelEvidence ? { settingsPanel: settingsPanelEvidence } : {}),
            ...(taskCollaborationEvidence ? { taskCollaboration: taskCollaborationEvidence } : {}),
            ...(hanliConversationEvidence ? { hanliConversation: hanliConversationEvidence } : {}),
            ...(windowResizeEvidence ? { formalWindow: windowResizeEvidence } : {}),
            ...(pageReloadEvidence ? { formalPage: pageReloadEvidence } : {}),
          };
          const output = await images(interactionEvidence);
          for (const criterionId of coveredCriterionIds) {
            addCriterionEvidence(criterionEvidenceIds, criterionId, snapshot);
          }
          const previewActual = formatImagePreviewEvidence(previewEvidence, dragEvidence);
          let operation: HanliAcceptanceStepResultOutDto["operation"];
          if (args.action === "hover") {
            operation = { type: "hover", x: Number(args.x), y: Number(args.y), reason: String(args.reason) };
          } else if (args.action === "key") {
            operation = { type: "key", key: String(args.key), reason: String(args.reason) };
          } else if (args.action === "scroll") {
            operation = { type: "scroll", x: Number(args.x), y: Number(args.y), deltaY: Number(args.deltaY), reason: String(args.reason) };
          } else if (args.action === "scroll-task-collaboration") {
            operation = { type: "scroll-task-collaboration", deltaY: Number(args.deltaY), reason: String(args.reason) };
          } else if (args.action === "toggle-task-audit-card") {
            operation = { type: "toggle-task-audit-card", auditCardIndex: Number(args.auditCardIndex), reason: String(args.reason) };
          } else if (args.action === "open-task-panel") {
            operation = { type: "open-task-panel", reason: String(args.reason) };
          } else if (args.action === "close-task-panel") {
            operation = { type: "close-task-panel", reason: String(args.reason) };
          } else if (args.action === "open-task-collaboration") {
            operation = { type: "open-task-collaboration", reason: String(args.reason) };
          } else if (args.action === "open-hanli-conversation") {
            operation = { type: "open-hanli-conversation", reason: String(args.reason) };
          } else if (args.action === "scroll-settings-panel") {
            operation = { type: "scroll-settings-panel", deltaY: Number(args.deltaY), reason: String(args.reason) };
          } else if (args.action === "resize-formal-window") {
            operation = { type: "resize-formal-window", preset: args.resizePreset as "narrow" | "restore", reason: String(args.reason) };
          } else if (args.action === "reload-formal-page") {
            operation = { type: "reload-formal-page", reason: String(args.reason) };
          } else if (args.action === "drag") {
            operation = { type: "drag", x: Number(args.x), y: Number(args.y), endX: Number(args.endX), endY: Number(args.endY), reason: String(args.reason) };
          } else {
            operation = { type: "click", x: Number(args.x), y: Number(args.y), reason: String(args.reason) };
          }
          interactionSteps.push({
            checkId: "interaction",
            evidenceMode: "page-experience",
            operationIndex: interactionSteps.length,
            operation,
            status: "passed",
            actual: `已发送输入，效果由韩立观察截图判断：${args.reason}；${previewActual}`,
            // 输入步骤只保存动作后的画面；真正的布局结论必须在 finish 的逐条件判断中另行提交。
            layoutStatus: "passed",
            layoutActual: "动作后的页面截图已返回，等待逐项布局判断。",
            layoutScreenshotAttachmentId: snapshot,
            screenshotAttachmentId: snapshot,
            occurredAt: new Date().toISOString(),
          });
          progress(`第${inputCount}步：${args.action}；${args.reason}；已返回截图 ${snapshot}`);
          return output;
        } catch (error) {
          // 只保存 finish 的可读校验摘要；不记录模型正文、截图数据或其他工具参数。
          if (attemptedFinish && !completed) {
            finishRejection = error instanceof Error ? error.message : String(error);
          }
          throw error;
        } finally {
          busy = false;
        }
      },
    };
    try {
      await model(tools, {
        nextContinuation: () => {
          const continuation = selectHanliAcceptanceContinuation({
            completed,
            hasArchivedScreenshot: Boolean(snapshot && evidence.includes(snapshot)),
            finishAttempted,
            finishRejection,
            correctionAttempted,
          });
          if (continuation?.kind === "finish-only") {
            finalizationOnly = true;
            progress("验收模型未提交 finish；进入仅允许 finish 的终态回合，禁止继续操作应用。");
          } else if (continuation?.kind === "correction") {
            correctionAttempted = true;
            progress("验收模型的 finish 被校验拒绝；进入一次受限纠正回合，仅可补齐原条件证据后重新提交 finish。");
          }
          return continuation;
        },
      });
    } finally {
      if (formalWindowResized && !window.isDestroyed()) {
        window.setBounds(initialBounds);
      }
      closed = true;
      this.#active = false;
    }
    if (!completed) {
      // 模型正常结束却没有提交 finish 时，已经保存的真实截图不能随着异常丢失。
      // 仅将其归档为受阻，绝不据此推断产品通过或失败；没有截图仍不能构造验收记录。
      if (!snapshot || !evidence.includes(snapshot)) {
        throw new Error("韩立尚未通过交互工具提交完整验收判断，且未留下可归档的真实截图证据。");
      }
      const finishDiagnostic = !finishAttempted
        ? "验收模型未尝试提交 finish。"
        : finishRejection
          ? `验收模型尝试提交 finish，但被现有校验拒绝：${finishRejection}`
          : "验收模型尝试提交 finish，但未形成完成记录。";
      const actual = `验收模型未通过交互工具提交完整判断，当前条件未形成可归档的功能结论。${finishDiagnostic}`;
      const layoutActual = `验收模型未通过交互工具提交完整判断，当前条件未形成可归档的布局结论。${finishDiagnostic}`;
      for (const [index] of goal.criteria.entries()) {
        const criterionId = criterionIds[index];
        stepResults.push({
          checkId: criterionId,
          evidenceMode: "page-experience",
          operationIndex: interactionSteps.length + stepResults.length,
          operation: {
            type: "judgement",
            criterionId,
          },
          status: "blocked",
          blockerKind: "runtime-environment",
          actual,
          layoutStatus: "blocked",
          layoutActual,
          layoutScreenshotAttachmentId: snapshot,
          screenshotAttachmentId: snapshot,
          occurredAt: new Date().toISOString(),
        });
      }
      verdict = "blocked";
      progress(`韩立验收受阻：${actual}`);
    }
    let windowTitle = "已关闭";
    let finalBounds = initialBounds;
    if (!window.isDestroyed()) {
      windowTitle = window.getTitle();
      finalBounds = window.getBounds();
    }
    return {
      version: 3,
      mode: "page-experience",
      runId,
      topicId: goal.topicId,
      proposalId: goal.proposalId,
      criteria: [...goal.criteria],
      status: verdict,
      windowTitle,
      initialBounds,
      finalBounds,
      interactionSteps,
      stepResults,
      evidenceAttachmentIds: evidence,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

/** 校验模型声明的本步验收覆盖范围；真实页面动作必须指向至少一条原条件。 */
function validateCriterionCoverage(value: unknown, allowedCriterionIds: string[], required: boolean): string[] {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || (required && value.length === 0)) {
    throw new Error("本次页面动作必须声明实际核对的 criterionIds，不能在首个失败后用无归属截图填充其余条件。");
  }
  if (value.some((item) => typeof item !== "string" || !allowedCriterionIds.includes(item))) {
    throw new Error("criterionIds 只能包含当前正式验收中的原条件编号。");
  }
  const criterionIds = value as string[];
  if (new Set(criterionIds).size !== criterionIds.length) {
    throw new Error("criterionIds 不能包含重复条件编号。");
  }
  return criterionIds;
}

/** 保存条件与真实截图的多对多关系，供 finish 阶段逐项阻止通用证据冒充完整验收。 */
function addCriterionEvidence(index: Map<string, Set<string>>, criterionId: string, evidenceId: string): void {
  const current = index.get(criterionId) || new Set<string>();
  current.add(evidenceId);
  index.set(criterionId, current);
}

/** 只滚动当前可见任务协作群的详情面板，不能推动页面标题与主要操作离开视口。 */
async function scrollTaskCollaboration(deltaY: number): Promise<Record<string, unknown>> {
  const page = document.querySelector<HTMLElement>(".task-collaboration-page");
  const detail = page?.querySelector<HTMLElement>(".task-timeline-detail-pane");
  const readSurface = () => {
    const pageRect = page?.getBoundingClientRect();
    const pageStyle = page ? getComputedStyle(page) : null;
    const detailRect = detail?.getBoundingClientRect();
    const detailStyle = detail ? getComputedStyle(detail) : null;
    const pageVisible = Boolean(page && pageRect && pageRect.width > 0 && pageRect.height > 0
      && pageStyle?.display !== "none" && pageStyle?.visibility !== "hidden");
    const detailVisible = Boolean(detail && detailRect && detailRect.width > 0 && detailRect.height > 0
      && detailStyle?.display !== "none" && detailStyle?.visibility !== "hidden");
    return {
      pageVisible,
      detailVisible,
      pageSize: pageRect ? { width: Math.round(pageRect.width), height: Math.round(pageRect.height) } : null,
      detailSize: detailRect ? { width: Math.round(detailRect.width), height: Math.round(detailRect.height) } : null,
    };
  };
  let surface = readSurface();
  // 窄窗口调整和折叠区展开会跨帧完成；只等待已触发的页面回显，不读取或改写业务事实。
  for (let attempt = 0; attempt < 3 && (!surface.pageVisible || !surface.detailVisible); attempt += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    surface = readSurface();
  }
  if (!page || !detail || !surface.pageVisible || !surface.detailVisible) {
    return { status: "not-ready", detailConnected: Boolean(detail?.isConnected), ...surface };
  }
  const pageScrollTop = page.scrollTop;
  const before = detail.scrollTop;
  const maxScrollTop = Math.max(0, detail.scrollHeight - detail.clientHeight);
  detail.scrollTop = Math.max(0, Math.min(maxScrollTop, before + deltaY));
  const after = detail.scrollTop;
  return {
    status: after === before ? "at-boundary" : "scrolled",
    scrollTop: Math.round(after),
    maxScrollTop: Math.round(maxScrollTop),
    pageScrollTop: Math.round(pageScrollTop),
  };
}

/** 只切换当前页面已展示的历史审计卡，并把该只读卡留在详情视口供截图核对。 */
async function toggleTaskAuditCard(auditCardIndex: number): Promise<Record<string, unknown>> {
  const page = document.querySelector<HTMLElement>(".task-collaboration-page");
  const auditHistory = page?.querySelector<HTMLElement>(".task-collaboration-audit-history");
  const historyDisclosure = auditHistory?.querySelector<HTMLElement>(":scope > .seldisclosure-root");
  const historyTrigger = historyDisclosure?.querySelector<HTMLButtonElement>("button[data-sel-disclosure-trigger]");
  if (!page || !auditHistory || !historyDisclosure || !historyTrigger) {
    return { status: "audit-history-unavailable" };
  }
  if (historyTrigger.getAttribute("aria-expanded") !== "true") {
    return { status: "audit-history-collapsed" };
  }
  const cards = Array.from(auditHistory.querySelectorAll<HTMLElement>(".task-collaboration-audit-history-card"));
  const card = cards[auditCardIndex];
  const trigger = card?.querySelector<HTMLButtonElement>("button[data-sel-disclosure-trigger]");
  if (!card || !trigger) {
    return { status: "audit-card-unavailable", auditCardCount: cards.length };
  }
  card.scrollIntoView({ block: "nearest" });
  const wasOpen = trigger.getAttribute("aria-expanded") === "true";
  trigger.click();
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  return {
    status: wasOpen ? "closed" : "opened",
    auditCardIndex,
    auditCardCount: cards.length,
  };
}

/** 只读取正式页面中可见的任务协作群标识；不访问 IPC、任务事实或测试桥。 */
function readTaskCollaborationSurface(): Record<string, unknown> {
  const page = document.querySelector<HTMLElement>(".task-collaboration-page");
  const region = page?.closest<HTMLElement>('[role="region"][aria-label="任务协作群"]') || page;
  const rect = page?.getBoundingClientRect();
  const visible = Boolean(page && region && rect && rect.width > 0 && rect.height > 0 && getComputedStyle(page).display !== "none" && getComputedStyle(page).visibility !== "hidden");
  const detail = page?.querySelector<HTMLElement>(".task-timeline-detail-pane");
  const detailRect = detail?.getBoundingClientRect();
  const detailVisible = Boolean(detail && detailRect && detailRect.width > 0 && detailRect.height > 0 && getComputedStyle(detail).display !== "none" && getComputedStyle(detail).visibility !== "hidden");
  const panelToggle = document.querySelector<HTMLButtonElement>('button.section-toggle[aria-controls="developer-task-list"]');
  return {
    status: visible ? "visible" : "hidden",
    taskPanelExpanded: panelToggle?.getAttribute("aria-expanded") === "true",
    detailPaneConnected: Boolean(detail?.isConnected),
    detailPaneVisible: detailVisible,
    detailPaneSize: detailRect ? { width: Math.round(detailRect.width), height: Math.round(detailRect.height) } : null,
  };
}

/** 精确操作既有任务面板和任务协作群入口，不暴露任何业务写入控件。 */
async function navigateTaskCollaboration(action: string): Promise<Record<string, unknown>> {
  const toggle = document.querySelector<HTMLButtonElement>('button.section-toggle[aria-controls="developer-task-list"]');
  const panel = document.querySelector<HTMLElement>("#developer-task-list");
  if (!toggle || !panel) return { status: "task-panel-unavailable" };
  const taskCollaborationVisible = (): boolean => {
    const page = document.querySelector<HTMLElement>(".task-collaboration-page");
    const rect = page?.getBoundingClientRect();
    return Boolean(page && rect && rect.width > 0 && rect.height > 0 && getComputedStyle(page).display !== "none" && getComputedStyle(page).visibility !== "hidden");
  };
  const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  // 点击任务面板后等待有限帧数，只把浏览器已回显的状态作为正式验收事实。
  const waitForPanel = async (expectedExpanded: boolean): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if ((toggle.getAttribute("aria-expanded") === "true") === expectedExpanded) return true;
      await nextFrame();
    }
    return (toggle.getAttribute("aria-expanded") === "true") === expectedExpanded;
  };
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  if (action === "open-task-panel") {
    if (expanded) return { status: "already-open", taskPanelExpanded: true, taskCollaborationVisible: taskCollaborationVisible() };
    toggle.click();
    const opened = await waitForPanel(true);
    return {
      status: opened ? "opened" : "task-panel-not-open",
      taskPanelExpanded: toggle.getAttribute("aria-expanded") === "true",
      taskCollaborationVisible: taskCollaborationVisible(),
    };
  }
  if (action === "close-task-panel") {
    if (!expanded) return { status: "already-closed", taskPanelExpanded: false, taskCollaborationVisible: taskCollaborationVisible() };
    toggle.click();
    const closed = await waitForPanel(false);
    return {
      status: closed ? "closed" : "task-panel-not-closed",
      taskPanelExpanded: toggle.getAttribute("aria-expanded") === "true",
      taskCollaborationVisible: taskCollaborationVisible(),
    };
  }
  if (action !== "open-task-collaboration") return { status: "unsupported" };
  if (!expanded) return { status: "task-panel-collapsed", taskPanelExpanded: false, taskCollaborationVisible: taskCollaborationVisible() };
  const entry = panel.querySelector<HTMLButtonElement>("button.collaboration-task-group-entry");
  if (!entry) return { status: "task-group-entry-unavailable" };
  if (taskCollaborationVisible()) return { status: "already-visible", taskPanelExpanded: true, taskCollaborationVisible: true };
  entry.click();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await nextFrame();
    if (taskCollaborationVisible()) return { status: "navigated", taskPanelExpanded: true, taskCollaborationVisible: true };
  }
  return {
    status: "task-group-not-visible",
    taskPanelExpanded: toggle.getAttribute("aria-expanded") === "true",
    taskCollaborationVisible: false,
  };
}

/** 仅打开当前正式窗口中已呈现的韩立成员页，并回执会话时间线是否已恢复；不会发送消息或修改任务。 */
async function navigateHanliConversation(): Promise<Record<string, unknown>> {
  const timelineVisible = (): boolean => Array.from(document.querySelectorAll<HTMLElement>(".selconversation-timeline"))
    .some((timeline) => {
      const rect = timeline.getBoundingClientRect();
      const style = getComputedStyle(timeline);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
  if (timelineVisible()) return { status: "already-visible" };
  // 人物入口位于可折叠任务面板内；先恢复既有导航表面，再选择已经渲染的韩立入口。
  const toggle = document.querySelector<HTMLButtonElement>('button.section-toggle[aria-controls="developer-task-list"]');
  const panel = document.querySelector<HTMLElement>("#developer-task-list");
  if (!toggle || !panel) return { status: "task-panel-unavailable" };
  const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  if (toggle.getAttribute("aria-expanded") !== "true") {
    toggle.click();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await nextFrame();
      if (toggle.getAttribute("aria-expanded") === "true") break;
    }
  }
  if (toggle.getAttribute("aria-expanded") !== "true") {
    return { status: "task-panel-not-open", taskPanelExpanded: false };
  }
  const entry = Array.from(panel.querySelectorAll<HTMLButtonElement>("button.collaboration-member"))
    .find((member) => member.textContent?.trim().startsWith("韩立"));
  if (!entry) return { status: "hanli-member-unavailable", taskPanelExpanded: true };
  if (entry.disabled) return { status: "hanli-member-disabled" };
  entry.click();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await nextFrame();
    if (timelineVisible()) return { status: "navigated" };
  }
  return { status: "conversation-not-visible" };
}

/** 只滚动当前可见设置浮层的固定内容容器，并回执位置，不读取或修改设置内容。 */
function scrollSettingsPanel(deltaY: number): Record<string, unknown> {
  // SELUI 面板使用 position: fixed；可见固定定位元素的 offsetParent 允许为 null，不能以它判断隐藏。
  const panel = document.querySelector<HTMLElement>(".dev-settings[data-sel-floating-panel=\"developer-settings\"]");
  const content = panel?.querySelector<HTMLElement>(".dev-settings-content");
  if (!panel || !content || panel.hidden || !panel.isConnected || !content.isConnected || content.getClientRects().length === 0 || content.clientHeight <= 0) {
    return { status: "hidden" };
  }
  const before = content.scrollTop;
  const maxScrollTop = Math.max(0, content.scrollHeight - content.clientHeight);
  content.scrollTop = Math.max(0, Math.min(maxScrollTop, before + deltaY));
  const after = content.scrollTop;
  return {
    status: after === before ? "at-boundary" : "scrolled",
    scrollTop: Math.round(after),
    maxScrollTop: Math.round(maxScrollTop),
  };
}

/** 区分坐标误点与真正的导航限制；只判断命中身份，不替模型定位目标或判断页面成功。 */
function readNavigationClickStatus(x: number, y: number, isAllowed: (x: number, y: number) => boolean): "allowed" | "missed" | "restricted" {
  const control = document.elementFromPoint(x, y)?.closest("button,[role=tab],[role=treeitem]");
  if (!control) return "missed";
  return isAllowed(x, y) ? "allowed" : "restricted";
}

function safeNavigationClick(x: number, y: number, allowNavigation = false): boolean {
  const node = document.elementFromPoint(x, y)?.closest("button,[role=tab],[role=treeitem]");
  if (!node || !allowNavigation) {
    return false;
  }
  // 折叠标题可能含历史“审批通过”等文字，按真实只读控件身份判断，不按内容误拦截。
  if (node.matches("button[data-sel-disclosure-trigger]") && node.closest("[data-sel-disclosure]")) return true;
  const label = (node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent || "").trim();
  if (/删除|清空|移除|提交|保存|确认|通过|退回|分发|发布|重启|自动巡检|自动托管/u.test(label)) {
    return false;
  }
  // 设置入口只负责打开固定浮层；必须同时命中外层容器，避免放行设置内容中的业务按钮。
  if (node.classList.contains("activity-settings") && node.closest(".dev-settings-control")) {
    return true;
  }
  // 任务协作群入口位于可折叠任务区内；只允许展开这一精确容器，不能放行其他区块的折叠按钮。
  if (node.matches('button.section-toggle[aria-controls="developer-task-list"]')) {
    return true;
  }
  // 任务计数与名称紧邻，不能依赖文本边界；只允许任务列表中的固定导航入口切换右侧面板。
  if (node.matches("button.collaboration-task-group-entry") && node.closest("#developer-task-list")) {
    return true;
  }
  // 空状态唯一入口只打开韩立会话，不提交任务、确认或恢复流程。
  if (node.matches("button.task-collaboration-empty-action") && node.closest(".task-collaboration-page .task-collaboration-empty")) {
    return true;
  }
  if (node.classList.contains("collaboration-member")) {
    return true;
  }
  if (node.matches(".selconversation-message-image-trigger") && node.closest(".selconversation-message-attachments")) {
    return true;
  }
  if (node.matches(".selimagepreview-action, .seldialog-close") && node.closest('dialog[data-sel-dialog="selDialogImagePreviewId"][open]')) {
    return true;
  }
  // 只放行现有工作区树的浏览和文件点击；主进程仍按冻结材料校验目录与文件。
  if (node.classList.contains("workspace-tree-row") && node.closest("#developer-workspace-tree")) return true;
  // 预览只能由已授权文件打开后出现，因此允许验收器触发既有复制与关闭操作来观察反馈和恢复状态。
  if (node.matches("button") && node.closest(".workspace-file-preview-panel")) return true;
  return node.getAttribute("role") === "tab" || /^(韩立|南宫婉|令狐老祖|紫灵|元瑶|宋玉|冰魄仙子|墨大夫|厉飞雨|张铁|李化元|单会话|协同模式|折叠侧栏|展开侧栏)(\s|$)/u.test(label);
}

interface AcceptanceViewport {
  width: number;
  height: number;
}

interface AcceptanceCoordinateSpace {
  screenshot: AcceptanceViewport;
  viewport: AcceptanceViewport;
}

/** 读取渲染器CSS像素尺寸，供截图像素坐标换算为输入坐标。 */
function readAcceptanceViewport(): AcceptanceViewport {
  return { width: Math.max(1, Math.round(window.innerWidth)), height: Math.max(1, Math.round(window.innerHeight)) };
}

/**
 * 从当前正式 renderer 读取客户能够看到的会话语义和几何边界。
 * 它只补足截图在当前模型中不可读时的无障碍证据，不访问 IPC、业务存储或隐藏任务状态。
 */
function readAcceptancePageEvidence(): Record<string, unknown> {
  const timelines = Array.from(document.querySelectorAll<HTMLElement>(".selconversation-timeline"));
  const timeline = timelines.find((candidate) => {
    const style = getComputedStyle(candidate);
    const rect = candidate.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  });
  if (!timeline) {
    return {
      status: "no-visible-conversation",
      title: document.title,
      viewport: { width: Math.round(window.innerWidth), height: Math.round(window.innerHeight) },
    };
  }

  const root = timeline.closest<HTMLElement>(".selconversation-root");
  const composer = root?.querySelector<HTMLElement>(".selconversation-composer") || null;
  const timelineRect = timeline.getBoundingClientRect();
  const composerRect = composer?.getBoundingClientRect() || null;
  const allMessages = Array.from(timeline.querySelectorAll<HTMLElement>(".selconversation-message"));
  const returnedMessages = allMessages.slice(-30);
  const messages = returnedMessages.map((message, offset) => {
    const rect = message.getBoundingClientRect();
    const text = (message.innerText || message.textContent || "").trim();
    return {
      index: allMessages.length - returnedMessages.length + offset + 1,
      role: message.dataset.role || "unknown",
      text: text.slice(0, 6_000),
      textTruncated: text.length > 6_000,
      visibleInTimeline: rect.bottom > timelineRect.top && rect.top < timelineRect.bottom,
      bounds: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) },
    };
  });
  const lastMessageRect = allMessages.at(-1)?.getBoundingClientRect() || null;
  const maxScrollTop = Math.max(0, timeline.scrollHeight - timeline.clientHeight);
  const overlapHeight = lastMessageRect && composerRect
    ? Math.max(0, Math.min(lastMessageRect.bottom, composerRect.bottom) - Math.max(lastMessageRect.top, composerRect.top))
    : 0;
  const overlapWidth = lastMessageRect && composerRect
    ? Math.max(0, Math.min(lastMessageRect.right, composerRect.right) - Math.max(lastMessageRect.left, composerRect.left))
    : 0;

  return {
    status: "ready",
    source: "customer-visible-renderer",
    title: document.title,
    viewport: { width: Math.round(window.innerWidth), height: Math.round(window.innerHeight) },
    conversation: {
      label: timeline.getAttribute("aria-label") || "",
      messageCount: allMessages.length,
      returnedFromIndex: allMessages.length - returnedMessages.length + 1,
      scrollTop: Math.round(timeline.scrollTop),
      maxScrollTop: Math.round(maxScrollTop),
      atBottom: maxScrollTop - timeline.scrollTop <= 2,
      bounds: { top: Math.round(timelineRect.top), bottom: Math.round(timelineRect.bottom), height: Math.round(timelineRect.height) },
      messages,
    },
    layout: {
      composerBounds: composerRect
        ? { top: Math.round(composerRect.top), bottom: Math.round(composerRect.bottom), height: Math.round(composerRect.height) }
        : null,
      lastMessageBounds: lastMessageRect
        ? { top: Math.round(lastMessageRect.top), bottom: Math.round(lastMessageRect.bottom), height: Math.round(lastMessageRect.height) }
        : null,
      lastMessageComposerOverlap: overlapHeight > 0 && overlapWidth > 0,
      overlapHeight: Math.round(overlapHeight),
    },
  };
}

function createAcceptanceCoordinateSpace(screenshot: AcceptanceViewport, viewport: AcceptanceViewport): AcceptanceCoordinateSpace {
  return {
    screenshot: { width: Math.max(1, Math.round(screenshot.width)), height: Math.max(1, Math.round(screenshot.height)) },
    viewport: { width: Math.max(1, Math.round(viewport.width)), height: Math.max(1, Math.round(viewport.height)) },
  };
}

/** 将模型依据截图给出的像素坐标转换为Electron和DOM使用的CSS视口坐标。 */
function mapScreenshotPointToViewport(x: unknown, y: unknown, coordinateSpace: AcceptanceCoordinateSpace): { x: number; y: number } {
  return {
    x: Math.round(Number(x) * coordinateSpace.viewport.width / coordinateSpace.screenshot.width),
    y: Math.round(Number(y) * coordinateSpace.viewport.height / coordinateSpace.screenshot.height),
  };
}

function safeImagePreviewDrag(x: number, y: number): boolean {
  const node = document.elementFromPoint(x, y);
  // 仅允许可平移的大图视区接收拖拽，未溢出的图片不应被验收工具强行拖动。
  const viewport = node?.closest<HTMLElement>(".selimagepreview-viewport");
  return Boolean(
    viewport?.dataset.pannable === "true"
      && viewport.closest('dialog[data-sel-dialog="selDialogImagePreviewId"][open]'),
  );
}

/** 读取预览组件的公开状态和视区交互标识，作为操作后的审计证据。 */
function readImagePreviewState(): Record<string, unknown> | null {
  const dialog = document.querySelector<HTMLDialogElement>('dialog[data-sel-dialog="selDialogImagePreviewId"]');
  const viewport = dialog?.querySelector<HTMLElement>(".selimagepreview-viewport");
  const image = dialog?.querySelector<HTMLElement>(".selimagepreview-image");
  const preview = (window as typeof window & { sel?: { components?: { imagePreview?: { getState?: () => Record<string, unknown> } } } }).sel?.components?.imagePreview?.getState?.();
  if (!dialog || !viewport || !image || !preview) return null;
  const viewportRect = viewport.getBoundingClientRect();
  const imageRect = image.getBoundingClientRect();
  const maximumOffsetX = Math.max(0, (imageRect.width - viewportRect.width) / 2);
  const maximumOffsetY = Math.max(0, (imageRect.height - viewportRect.height) / 2);
  const offsetX = imageRect.left + imageRect.width / 2 - (viewportRect.left + viewportRect.width / 2);
  const offsetY = imageRect.top + imageRect.height / 2 - (viewportRect.top + viewportRect.height / 2);
  return {
    open: preview.open === true,
    zoom: preview.zoom,
    pannable: viewport.dataset.pannable === "true",
    dragging: viewport.dataset.dragging === "true",
    cursor: getComputedStyle(viewport).cursor,
    offsetX: Math.round(offsetX),
    offsetY: Math.round(offsetY),
    maximumOffsetX: Math.round(maximumOffsetX),
    maximumOffsetY: Math.round(maximumOffsetY),
    withinBounds: Math.abs(offsetX) <= maximumOffsetX + 1 && Math.abs(offsetY) <= maximumOffsetY + 1,
  };
}

/** 预览状态不可读时明确保留证据缺口，避免把截图外观当作操作成功。 */
function formatImagePreviewEvidence(value: unknown, duringDrag: unknown): string {
  if (!value || typeof value !== "object") return "图片预览状态不可读取，证据不足";
  const state = value as Record<string, unknown>;
  const dragState = duringDrag && typeof duringDrag === "object" ? duringDrag as Record<string, unknown> : null;
  const dragEvidence = dragState ? `；拖动中 cursor=${String(dragState.cursor)}，dragging=${String(dragState.dragging)}` : "";
  return `图片预览状态：open=${String(state.open)}，zoom=${String(state.zoom)}，pannable=${String(state.pannable)}，cursor=${String(state.cursor)}，offset=(${String(state.offsetX)},${String(state.offsetY)})，max=(${String(state.maximumOffsetX)},${String(state.maximumOffsetY)})，withinBounds=${String(state.withinBounds)}${dragEvidence}`;
}

/** 校验模型给出的窗口坐标，阻止把窗口外位置传入 Electron 输入事件。 */
function assertPointInsideWindow(x: unknown, y: unknown, width: number, height: number, message: string): void {
  const numericX = Number(x);
  const numericY = Number(y);
  const isIntegerPoint = Number.isInteger(numericX) && Number.isInteger(numericY);
  const isInsideHorizontalBounds = numericX >= 0 && numericX < width;
  const isInsideVerticalBounds = numericY >= 0 && numericY < height;
  if (!isIntegerPoint || !isInsideHorizontalBounds || !isInsideVerticalBounds) {
    throw new Error(message);
  }
}
