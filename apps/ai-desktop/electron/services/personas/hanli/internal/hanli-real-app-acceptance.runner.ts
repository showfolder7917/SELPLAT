import { randomUUID } from "node:crypto";

import type { BrowserWindow } from "electron";

import type { HanliAcceptanceOperationValue, HanliAcceptancePlanOutDto, HanliAcceptanceRunOutDto, HanliAcceptanceStepResultOutDto } from "../../../../../contracts/services/personas/hanli/index.js";
import type { AttachmentFacade as ScreenshotStore } from "../../../support/platform/attachments/index.js";

const BLOCKED_CLICK_TARGET = /删除|清空|移除|退出登录|提交|保存|确认|通过|退回|驳回|分发|发布|重启|delete|clear|remove|submit|approve|reject|dispatch|restart/iu;
const MAX_OPERATIONS = 120;

/** 在真实 Electron 窗口执行有限白名单动作，所有动作都留下可复核结果与截图。 */
export class HanliRealAppAcceptanceRunner {
  readonly #screenshots: ScreenshotStore;

  constructor(screenshots: ScreenshotStore) { this.#screenshots = screenshots; }

  async execute(plan: HanliAcceptancePlanOutDto, targetWindow: BrowserWindow): Promise<HanliAcceptanceRunOutDto> {
    if (targetWindow.isDestroyed()) throw new Error("专题演化工作台已经关闭，无法执行真实界面验收。 ");
    const startedAt = new Date().toISOString();
    const initialBounds = targetWindow.getBounds();
    const stepResults: HanliAcceptanceStepResultOutDto[] = [];
    const evidenceAttachmentIds: string[] = [];
    let operationCount = 0;
    targetWindow.show();
    targetWindow.focus();
    try {
      for (const check of plan.checks) {
        for (const [operationIndex, operation] of check.operations.entries()) {
          operationCount += 1;
          if (operationCount > MAX_OPERATIONS) {
            stepResults.push(result(check.checkId, operationIndex, operation, "blocked", `计划超过 ${MAX_OPERATIONS} 个受控操作，剩余步骤未执行。`));
            break;
          }
          stepResults.push(await this.#executeOperation(targetWindow, check.checkId, operationIndex, operation));
        }
        // 每个检查项结束都截取当前真实窗口，避免只有文字结果而没有可视证据。
        const attachment = await this.#capture(targetWindow);
        evidenceAttachmentIds.push(attachment.id);
        const latest = stepResults.at(-1);
        if (latest?.checkId === check.checkId && !latest.screenshotAttachmentId) latest.screenshotAttachmentId = attachment.id;
      }
    } finally {
      if (!targetWindow.isDestroyed()) targetWindow.setBounds(initialBounds, false);
    }
    const finalBounds = targetWindow.isDestroyed() ? initialBounds : targetWindow.getBounds();
    const status = stepResults.some((item) => item.status === "failed") ? "failed" : stepResults.some((item) => item.status === "blocked") ? "blocked" : "passed";
    return {
      version: 1, runId: `hanli-acceptance-run-${randomUUID()}`, planId: plan.planId, topicId: plan.topicId, proposalId: plan.proposalId,
      status, windowTitle: targetWindow.isDestroyed() ? "专题演化工作台（执行中关闭）" : targetWindow.getTitle(), initialBounds, finalBounds,
      stepResults, evidenceAttachmentIds: [...new Set(evidenceAttachmentIds)], startedAt, completedAt: new Date().toISOString(),
    };
  }

  async #executeOperation(targetWindow: BrowserWindow, checkId: string, operationIndex: number, operation: HanliAcceptanceOperationValue): Promise<HanliAcceptanceStepResultOutDto> {
    try {
      if (operation.type === "focus-window") {
        targetWindow.show(); targetWindow.focus();
        return result(checkId, operationIndex, operation, "passed", "专题演化工作台已显示并获得焦点。");
      }
      if (operation.type === "resize-window") {
        if (operation.width < 980 || operation.width > 1_920 || operation.height < 680 || operation.height > 1_200) return result(checkId, operationIndex, operation, "blocked", "窗口尺寸超出 980×680 至 1920×1200 的安全范围。");
        const current = targetWindow.getBounds();
        targetWindow.setBounds({ ...current, width: operation.width, height: operation.height }, false);
        await wait(120);
        const actual = targetWindow.getBounds();
        return result(checkId, operationIndex, operation, actual.width === operation.width && actual.height === operation.height ? "passed" : "failed", `窗口实际尺寸 ${actual.width}×${actual.height}。`);
      }
      if (operation.type === "click") {
        if (BLOCKED_CLICK_TARGET.test(operation.target)) return result(checkId, operationIndex, operation, "blocked", "该目标可能改变业务数据或审批状态，真实验收执行器禁止自动点击。 ");
        const actual = await targetWindow.webContents.executeJavaScript(`(${runDomOperation.toString()})({ type: "click", target: ${JSON.stringify(operation.target)} })`, true) as { clicked: boolean; description: string };
        await wait(120);
        return result(checkId, operationIndex, operation, actual.clicked ? "passed" : "failed", actual.description);
      }
      if (operation.type === "scroll") {
        const actual = await targetWindow.webContents.executeJavaScript(`(${runDomOperation.toString()})({ type: "scroll", target: ${JSON.stringify(operation.target)}, direction: ${JSON.stringify(operation.direction)}, amount: ${operation.amount} })`, true) as { moved: boolean; description: string };
        await wait(120);
        return result(checkId, operationIndex, operation, actual.moved ? "passed" : "failed", actual.description);
      }
      if (operation.type === "press-key") {
        if (operation.target) {
          const focused = await targetWindow.webContents.executeJavaScript(`(${runDomOperation.toString()})({ type: "focus", target: ${JSON.stringify(operation.target)} })`, true) as boolean;
          if (!focused) return result(checkId, operationIndex, operation, "failed", `没有找到可聚焦目标：${operation.target}`);
        }
        targetWindow.webContents.sendInputEvent({ type: "keyDown", keyCode: operation.key });
        targetWindow.webContents.sendInputEvent({ type: "keyUp", keyCode: operation.key });
        await wait(80);
        return result(checkId, operationIndex, operation, "passed", `已向真实窗口发送按键 ${operation.key}。`);
      }
      if (operation.type === "inspect-text") {
        const visible = await targetWindow.webContents.executeJavaScript(`(${runDomOperation.toString()})({ type: "inspect", text: ${JSON.stringify(operation.text)} })`, true) as boolean;
        return result(checkId, operationIndex, operation, visible ? "passed" : "failed", visible ? `页面可见文本包含：${operation.text}` : `页面可见文本未找到：${operation.text}`);
      }
      const attachment = await this.#capture(targetWindow);
      return { ...result(checkId, operationIndex, operation, "passed", `已保存“${operation.label}”真实窗口截图。`), screenshotAttachmentId: attachment.id };
    } catch (error) {
      return result(checkId, operationIndex, operation, "failed", error instanceof Error ? error.message : "真实界面操作失败。 ");
    }
  }

  async #capture(targetWindow: BrowserWindow) {
    const image = await targetWindow.webContents.capturePage();
    const dataUrl = `data:image/png;base64,${image.toPNG().toString("base64")}`;
    return this.#screenshots.save({ originalDataUrl: dataUrl, annotatedDataUrl: dataUrl, hasAnnotations: false });
  }
}

function result(checkId: string, operationIndex: number, operation: HanliAcceptanceOperationValue, status: HanliAcceptanceStepResultOutDto["status"], actual: string): HanliAcceptanceStepResultOutDto {
  return { checkId, operationIndex, operation: structuredClone(operation), status, actual: actual.slice(0, 2_000), screenshotAttachmentId: null, occurredAt: new Date().toISOString() };
}

function wait(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

function runDomOperation(input: { type: "click" | "focus" | "scroll" | "inspect"; target?: string; text?: string; direction?: "up" | "down"; amount?: number }): unknown {
  // 此函数会被完整序列化到渲染进程；依赖必须全部保持在函数体内，避免 Electron 页面缺少主进程辅助函数。
  const isVisible = (element: Element): boolean => { const bounds = element.getBoundingClientRect(); const style = window.getComputedStyle(element); return bounds.width > 0 && bounds.height > 0 && style.display !== "none" && style.visibility !== "hidden"; };
  const describe = (element: Element): string => (element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || element.tagName).replaceAll(/\s+/gu, " ").trim().slice(0, 300);
  const matchesTarget = (element: Element, target: string): boolean => { const value = describe(element).toLocaleLowerCase(); const expected = target.replaceAll(/\s+/gu, " ").trim().toLocaleLowerCase(); return value === expected || value.includes(expected); };
  const interactive = (): Element[] => [...document.querySelectorAll("button,a,input,select,textarea,[role='button'],[role='tab'],[role='treeitem'],[tabindex]")].filter(isVisible);
  if (input.type === "click") {
    const element = interactive().find((item) => matchesTarget(item, input.target || "")) as HTMLElement | undefined;
    if (!element) return { clicked: false, description: `没有找到可点击目标：${input.target || ""}` };
    element.scrollIntoView({ block: "center", inline: "nearest" }); element.click();
    return { clicked: true, description: `已点击：${describe(element)}` };
  }
  if (input.type === "focus") {
    const element = interactive().find((item) => matchesTarget(item, input.target || "")) as HTMLElement | undefined;
    if (!element) return false;
    element.scrollIntoView({ block: "center", inline: "nearest" }); element.focus();
    return document.activeElement === element;
  }
  if (input.type === "inspect") {
    const expected = (input.text || "").replaceAll(/\s+/gu, " ").trim();
    return [...document.querySelectorAll("body *")].some((item) => isVisible(item) && (item.textContent || "").replaceAll(/\s+/gu, " ").includes(expected));
  }
  const target = input.target || "";
  const seed = target ? [...document.querySelectorAll("*")].find((item) => isVisible(item) && matchesTarget(item, target)) : document.scrollingElement;
  let element = seed as HTMLElement | null;
  while (element && element !== document.body && element.scrollHeight <= element.clientHeight) element = element.parentElement;
  const scroller = element && element.scrollHeight > element.clientHeight ? element : document.scrollingElement;
  if (!scroller) return { moved: false, description: `没有找到可滚动区域：${target || "页面"}` };
  const before = scroller.scrollTop;
  scroller.scrollBy({ top: input.direction === "down" ? (input.amount || 0) : -(input.amount || 0), behavior: "instant" });
  const after = scroller.scrollTop;
  return { moved: after !== before, description: `滚动位置 ${before} → ${after}，最大 ${Math.max(0, scroller.scrollHeight - scroller.clientHeight)}。` };
}
