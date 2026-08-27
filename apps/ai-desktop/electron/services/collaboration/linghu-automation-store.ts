import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  CreateLinghuStartupPromptRequest,
  LinghuAutomationModule,
  LinghuAutomationState,
  LinghuAutomationStateEvent,
  UpdateLinghuStartupPromptRequest,
} from "../../../contracts/collaboration/linghu-automation.js";

type StateListener = (event: LinghuAutomationStateEvent) => void;

export const LINGHU_AUTOMATION_MODULES: readonly LinghuAutomationModule[] = [
  "flow-completion",
  "test-coverage",
  "audit-completeness",
];

export const DEFAULT_LINGHU_STARTUP_PROMPT_TITLE = "自动流程最后保障";

export const DEFAULT_LINGHU_STARTUP_PROMPT = `你是令狐老祖，是保障所有人物完成最后流程的最后一道屏障。只要自动执行开关保持开启，检测永远不能停止。

一级最高职责是逐项检查所有人物已经开始但尚未完成的任务，推动其完成审核、执行、集成、统一测试和最终完成。发现流程停住、异常状态、代码错误、测试失败或重启丢失时，必须找出原因，拆分最小修正任务并恢复原流程。明确需要人工业务选择时可以等待处理，但仍要持续检测并保留恢复点，不能关闭自动检测。

第二职责是检查测试漏点。结合任务改动、失败证据和相邻功能判断主路径、边界路径、异常路径与并发路径是否缺少验证；缺失时先补最小回归测试，再执行修正和复测。持续升级自身测试能力，优化排队等待、重复构建和资源占用，但不得牺牲隔离性、审计性或可靠性。

第三职责是检查日志审计完整性。每项关键动作必须能够关联任务、人物、测试批次、进程、端口、构建目录、排队、占用、冲突、释放、超时和最终结果；发现只有错误文字而缺少结构化事实时，必须补齐审计入口和关联字段。

仅执行以上三项职责，暂不进行页面演化评分、主动页面改版或无关架构优化。所有测试资源必须通过单一跨进程 Facade 申请，禁止调用方直接竞争 Playwright、Electron、端口或构建目录。

每个模块结束后输出：循环编号、模块、问题证据、执行任务、执行者、测试结果、审计完整性、资源等待与执行性能、阻塞和下一步建议。`;

/** 原子持久化令狐老祖自动保障开关、循环恢复点和用户可维护的启动文案。 */
export class LinghuAutomationStore {
  readonly #filePath: string;
  readonly #listeners = new Set<StateListener>();
  #state: LinghuAutomationState;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#state = this.#load();
  }

  state(): LinghuAutomationState { return structuredClone(this.#state); }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  setEnabled(enabled: boolean): LinghuAutomationState {
    return this.#commit(enabled ? "automation.enabled" : "automation.disabled", (state) => {
      state.enabled = enabled;
      state.blockingReason = enabled ? null : "自动执行已关闭";
    });
  }

  createPrompt(request: CreateLinghuStartupPromptRequest): LinghuAutomationState {
    const now = new Date().toISOString();
    const prompt = {
      promptId: `linghu-prompt-${randomUUID()}`,
      title: normalizeTitle(request?.title),
      content: normalizeContent(request?.content),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    return this.#commit("prompt.created", (state) => {
      state.prompts.push(prompt);
      state.activePromptId = prompt.promptId;
      state.blockingReason = null;
    });
  }

  updatePrompt(promptId: string, request: UpdateLinghuStartupPromptRequest): LinghuAutomationState {
    return this.#commit("prompt.updated", (state) => {
      const prompt = requirePrompt(state, promptId);
      if (request.title !== undefined) prompt.title = normalizeTitle(request.title);
      if (request.content !== undefined) prompt.content = normalizeContent(request.content);
      if (request.enabled !== undefined) prompt.enabled = request.enabled;
      prompt.updatedAt = new Date().toISOString();
      if (state.activePromptId === promptId && !prompt.enabled) {
        state.activePromptId = state.prompts.find((candidate) => candidate.enabled && candidate.promptId !== promptId)?.promptId || null;
      }
    });
  }

  deletePrompt(promptId: string): LinghuAutomationState {
    return this.#commit("prompt.deleted", (state) => {
      requirePrompt(state, promptId);
      state.prompts = state.prompts.filter((prompt) => prompt.promptId !== promptId);
      if (state.activePromptId === promptId) state.activePromptId = state.prompts.find((prompt) => prompt.enabled)?.promptId || null;
    });
  }

  selectPrompt(promptId: string): LinghuAutomationState {
    return this.#commit("prompt.selected", (state) => {
      const prompt = requirePrompt(state, promptId);
      if (!prompt.enabled) throw new Error("停用的启动文案不能作为当前入口。");
      state.activePromptId = promptId;
      state.blockingReason = null;
    });
  }

  updateRuntime(reason: string, update: (state: LinghuAutomationState) => void): LinghuAutomationState {
    return this.#commit(reason, update);
  }

  #commit(reason: string, update: (state: LinghuAutomationState) => void): LinghuAutomationState {
    const next = structuredClone(this.#state);
    update(next);
    next.updatedAt = new Date().toISOString();
    this.#write(next);
    this.#state = next;
    const event = { state: this.state(), reason };
    for (const listener of this.#listeners) listener(event);
    return event.state;
  }

  #load(): LinghuAutomationState {
    const primaryExisted = existsSync(this.#filePath);
    for (const candidate of [this.#filePath, `${this.#filePath}.bak`]) {
      const value = readState(candidate);
      if (value) {
        migrateState(value);
        this.#write(value);
        return value;
      }
    }
    const state = createInitialState();
    if (primaryExisted) {
      // 自动状态无法证明用户最后一次选择时必须安全关闭，禁止因损坏自行恢复为开启。
      state.enabled = false;
      state.blockingReason = "自动状态损坏，已安全关闭；请由用户重新开启";
    }
    this.#write(state);
    return state;
  }

  #write(state: LinghuAutomationState): void {
    mkdirSync(path.dirname(this.#filePath), { recursive: true });
    const temporary = `${this.#filePath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    renameSync(temporary, this.#filePath);
    copyFileSync(this.#filePath, `${this.#filePath}.bak`);
  }
}

function createInitialState(): LinghuAutomationState {
  const now = new Date().toISOString();
  const promptId = "linghu-default-flow-guardian";
  return {
    version: 2,
    enabled: false,
    pollIntervalMs: 30_000,
    cycle: 1,
    currentModule: "flow-completion",
    activePromptId: promptId,
    activeTaskId: null,
    pendingRepairProposalId: null,
    recoveryAttemptCount: 0,
    currentFaultFingerprint: null,
    recoveryAttemptsByFingerprint: {},
    detectionCursor: null,
    flowSnapshots: [],
    testResourceState: null,
    recoveryCheckpoint: null,
    lastDispatchAt: null,
    lastCompletedAt: null,
    lastCheckedAt: null,
    blockingReason: "自动执行已关闭",
    lastFeedback: null,
    lastModuleReport: null,
    prompts: [{ promptId, title: DEFAULT_LINGHU_STARTUP_PROMPT_TITLE, content: DEFAULT_LINGHU_STARTUP_PROMPT, enabled: true, createdAt: now, updatedAt: now }],
    updatedAt: now,
  };
}

function readState(filePath: string): LinghuAutomationState | null {
  try {
    const value = JSON.parse(readFileSync(filePath, "utf8")) as LinghuAutomationState;
    return [1, 2].includes(Number(value.version)) && Array.isArray(value.prompts) ? value : null;
  } catch {
    return null;
  }
}

function migrateState(value: LinghuAutomationState): void {
  value.pendingRepairProposalId ??= null;
  if (Number(value.version) === 1) {
    // 旧默认文案包含页面演化和四模块职责；升级时只迁移受保护默认入口，不覆盖用户另建文案。
    const defaultPrompt = value.prompts.find((prompt) => prompt.promptId === "linghu-default-flow-guardian");
    if (defaultPrompt) {
      defaultPrompt.title = DEFAULT_LINGHU_STARTUP_PROMPT_TITLE;
      defaultPrompt.content = DEFAULT_LINGHU_STARTUP_PROMPT;
      defaultPrompt.updatedAt = new Date().toISOString();
    }
    value.version = 2;
  }
  value.pollIntervalMs = 30_000;
  value.currentModule = LINGHU_AUTOMATION_MODULES.includes(value.currentModule) ? value.currentModule : "flow-completion";
  value.recoveryAttemptCount ??= 0;
  value.currentFaultFingerprint ??= null;
  value.recoveryAttemptsByFingerprint ??= {};
  value.detectionCursor ??= null;
  value.flowSnapshots ??= [];
  value.testResourceState ??= null;
  value.recoveryCheckpoint ??= null;
  value.lastCheckedAt ??= null;
  value.blockingReason ??= null;
  value.lastModuleReport ??= null;
  if (!value.prompts.some((prompt) => prompt.promptId === value.activePromptId && prompt.enabled)) {
    value.activePromptId = value.prompts.find((prompt) => prompt.enabled)?.promptId || null;
  }
}

function requirePrompt(state: LinghuAutomationState, promptId: string) {
  const prompt = state.prompts.find((candidate) => candidate.promptId === promptId);
  if (!prompt) throw new Error("启动文案不存在。");
  return prompt;
}

function normalizeTitle(value: string): string {
  const title = typeof value === "string" ? value.trim().slice(0, 80) : "";
  if (!title) throw new Error("启动文案名称不能为空。");
  return title;
}

function normalizeContent(value: string): string {
  const content = typeof value === "string" ? value.trim().slice(0, 20_000) : "";
  if (!content) throw new Error("启动文案内容不能为空。");
  return content;
}
