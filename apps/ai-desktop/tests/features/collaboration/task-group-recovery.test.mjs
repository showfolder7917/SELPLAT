import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// 渲染真实恢复组件，验证长回执不挤占首屏且原证据仍能展开。
const result = await build({
  entryPoints: [fileURLToPath(new URL("../../../src/features/collaboration/components/TaskGroupRecovery.tsx", import.meta.url))],
  bundle: true, format: "cjs", platform: "node", packages: "external", jsx: "automatic", write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { TaskGroupRecovery } = compiled.exports;
const group = { topicId: "topic-a", proposalId: "proposal-a", nodes: [] };
function render({ reason = "等待重新验证", pending = false, feedback = null, topicId = "topic-a" } = {}) {
  const evolution = {
    state: { oneShotRun: { runId: "run-original", topicId, proposalId: "proposal-a", status: "blocked", blockingReason: reason },
      proposals: [{ proposalId: "proposal-a", status: "blocked" }], automationRuntime: { status: "paused" } },
    resumingRunId: pending ? "run-original" : null, resumeFeedback: feedback,
  };
  return renderToStaticMarkup(createElement(TaskGroupRecovery, { group, evolution, locale: "zh" }));
}

test("千字阻塞回执首屏仅显示摘要，完整证据默认折叠且未丢失", () => {
  const reason = "验收未通过。" + "实际窗口只读，未生成测试任务。".repeat(100) + "证据末尾";
  const html = render({ reason });
  assert.ok(html.match(/<p>(.*?)<\/p>/s)[1].length <= 121);
  assert.match(html, /查看完整原因与证据/);
  assert.match(html, /data-sel-disclosure-content="true" hidden=""/);
  assert.ok(html.includes(`<pre>${reason}</pre>`));
});

test("短阻塞原因无需额外折叠，其他专题不显示此运行恢复信息", () => {
  assert.match(render(), /<p>等待重新验证<\/p>/);
  assert.doesNotMatch(render(), /查看完整原因与证据/);
  assert.equal(render({ topicId: "another-topic" }), "");
});

test("恢复处理中禁用按钮并隐藏旧原因，失败反馈保留警告与完整详情", () => {
  const pending = render({ pending: true });
  assert.match(pending, /disabled=""/);
  assert.match(pending, /正在恢复原任务/);
  assert.doesNotMatch(pending, /等待重新验证/);
  const failure = render({ feedback: { runId: "run-original", error: true, message: "恢复仍受阻。".repeat(100) } });
  assert.match(failure, /role="alert"/);
  assert.match(failure, /查看完整原因与证据/);
  assert.doesNotMatch(failure, /等待重新验证/);
});
