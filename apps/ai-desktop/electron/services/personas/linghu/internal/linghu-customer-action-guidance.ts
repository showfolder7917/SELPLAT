import path from "node:path";

import type {
  CollaborationCustomerActionGuidanceOutDto,
  CollaborationTaskOutDto,
} from "../../../../../contracts/services/workflow/index.js";
import type { LinghuAutomaticFlowSnapshotOutDto } from "../../../../../contracts/services/personas/linghu/index.js";

/** 只向令狐提供已经落库的卡点事实，避免模型用猜测补全原因。 */
export function customerActionFacts(
  task: CollaborationTaskOutDto,
  snapshot: LinghuAutomaticFlowSnapshotOutDto | undefined,
  sourceFingerprint: string,
): Record<string, unknown> {
  const location = customerActionLocation(task);
  return {
    sourceFingerprint,
    taskId: task.taskId,
    taskTitle: task.snapshot.title,
    taskState: task.state,
    currentStage: snapshot?.phase || null,
    blockingKind: snapshot?.blockingKind || null,
    blockingReason: task.blockingReason || null,
    recoveryTargetState: task.recoveryTargetState || null,
    workspaceRoot: location.workspaceRoot,
    uncommittedFiles: location.affectedFiles,
    absoluteFilePaths: location.absoluteFilePaths,
    integrationFailure: task.integrationFailure ? {
      kind: task.integrationFailure.kind,
      phase: task.integrationFailure.phase || null,
      summary: task.integrationFailure.summary || null,
      detail: task.integrationFailure.detail,
      conflictFiles: task.integrationFailure.conflictFiles,
    } : null,
  };
}

const forbiddenInstruction = /\brm\s+-rf\b|\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-f|绕过(?:权限|安全|审批)|删除所有/iu;

/** 严格解析令狐的客户指导；程序只校验结构和安全，不代替令狐写业务文案。 */
export function parseCustomerActionGuidance(
  text: string,
  sourceFingerprint: string,
  generatedBy: CollaborationCustomerActionGuidanceOutDto["generatedBy"],
  location?: ReturnType<typeof customerActionLocation>,
): CollaborationCustomerActionGuidanceOutDto {
  const candidate = extractJsonObject(text);
  const input = JSON.parse(candidate) as Record<string, unknown>;
  const title = requiredText(input.title, "title", 120);
  const problem = requiredText(input.problem, "problem", 1_000);
  const reasonCustomerMustAct = requiredText(input.reasonCustomerMustAct, "reasonCustomerMustAct", 1_000);
  const steps = requiredTextList(input.steps, "steps", 12, 500);
  const completionCriteria = requiredTextList(input.completionCriteria, "completionCriteria", 8, 500);
  const allText = [title, problem, reasonCustomerMustAct, ...steps, ...completionCriteria].join("\n");
  if (forbiddenInstruction.test(allText)) throw new Error("令狐生成的客户操作指导包含危险或越权操作，已拒绝展示。");
  return {
    guidanceId: `customer-action:${sourceFingerprint}`,
    sourceFingerprint,
    title,
    problem,
    reasonCustomerMustAct,
    steps,
    completionCriteria,
    workspaceRoot: location?.workspaceRoot || null,
    affectedFiles: location?.affectedFiles || [],
    resumeLabel: "从卡点继续",
    generatedBy,
    createdAt: new Date().toISOString(),
  };
}

/** 目录和文件来自 Git 结构化证据，不能交给模型猜测或在页面写死。 */
export function customerActionLocation(task: CollaborationTaskOutDto): {
  workspaceRoot: string | null;
  affectedFiles: string[];
  absoluteFilePaths: string[];
} {
  const primaryRoot = task.snapshot.workspaceState.roots.find((root) => root.id === task.snapshot.workspaceState.primaryId)?.path || null;
  const workspaceRoot = task.integrationFailure?.workspaceRoot || primaryRoot;
  const affectedFiles = [...new Set(task.integrationFailure?.conflictFiles || [])].filter(Boolean);
  const absoluteFilePaths = workspaceRoot
    ? affectedFiles.map((file) => path.isAbsolute(file) ? path.normalize(file) : path.resolve(workspaceRoot, file))
    : affectedFiles.filter(path.isAbsolute).map((file) => path.normalize(file));
  return { workspaceRoot, affectedFiles, absoluteFilePaths };
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("令狐未返回客户操作指导 JSON。");
  return trimmed.slice(start, end + 1);
}

function requiredText(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`令狐客户操作指导缺少 ${name}。`);
  return value.trim().slice(0, maxLength);
}

function requiredTextList(value: unknown, name: string, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`令狐客户操作指导缺少 ${name}。`);
  const items = value.slice(0, maxItems).map((item) => requiredText(item, name, maxLength));
  if (items.length === 0) throw new Error(`令狐客户操作指导缺少 ${name}。`);
  return items;
}
