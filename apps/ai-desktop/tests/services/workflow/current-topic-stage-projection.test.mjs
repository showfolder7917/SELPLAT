import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

async function loadProjection() {
  const result = await build({
    entryPoints: ["electron/services/workflow/domain/topic-final-presentation.projection.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2022",
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

const { projectTopicFinalPresentation } = await loadProjection();

test("最终验收通过在没有后续真实活动时稳定显示完成", () => {
  const result = projectTopicFinalPresentation({
    terminal: { occurredAt: "2026-09-26T00:00:00.000Z", summary: "正式验收通过" },
    laterActivity: null,
  });
  assert.deepEqual(result, {
    status: "completed",
    summary: "正式验收通过",
    nextStep: "可开始下一专题。",
    terminalAt: "2026-09-26T00:00:00.000Z",
  });
});

test("终态后的阻塞活动覆盖旧完成，同时间戳活动不覆盖终态", () => {
  const terminal = { occurredAt: "2026-09-26T00:00:00.000Z", summary: "正式验收通过" };
  assert.equal(projectTopicFinalPresentation({ terminal, laterActivity: {
    occurredAt: "2026-09-26T00:01:00.000Z", status: "blocked", summary: "新一轮验收失败",
  } })?.status, "blocked");
  assert.equal(projectTopicFinalPresentation({ terminal, laterActivity: {
    occurredAt: terminal.occurredAt, status: "running", summary: "同一时刻的旧活动",
  } })?.status, "completed");
});

test("历史审计区只展示时间线读取反馈并复用只读重新读取入口", () => {
  const source = readFileSync(fileURLToPath(new URL("../../../src/features/collaboration/components/TaskCollaborationGroup.tsx", import.meta.url)), "utf8");
  assert.match(source, /const auditHistoryRefreshing = timelineReadStatus === "syncing"/);
  assert.match(source, /const auditHistory = \([\s\S]*auditHistoryRefreshing[\s\S]*正在读取历史审计记录/);
  assert.match(source, /历史审计读取失败[\s\S]*onClick=\{retryTimelineRead\}/);
  assert.match(source, /auditHistoryGroups\.length === 0[\s\S]*没有可显示的审计记录/);
  const emptyGroupsBranch = source.slice(source.indexOf("if (groups.length === 0)"), source.indexOf("return (", source.indexOf("if (groups.length === 0)")) + 2500);
  assert.match(emptyGroupsBranch, /task-collaboration-groups[\s\S]*\{auditHistory\}/);
  assert.doesNotMatch(source, /onContinueTask\(.*auditHistory|onResumeAcceptance\(.*auditHistory/s);
});
