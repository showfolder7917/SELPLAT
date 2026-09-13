import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";

const source = readFileSync("electron/services/workflow/domain/acceptance-interaction-capability.policy.ts", "utf8");
const transformed = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
const { resolveAcceptanceInteractionCapabilities } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);

const proposal = (overrides = {}) => ({
  content: "在左侧 Explorer 增加工作区资源浏览。",
  impactScope: ["左侧工作区面板支持添加工作区、按需读取目录与文件。"],
  acceptanceCriteria: ["添加工作区后立即出现，可展开目录，文件可在应用内只读查看。"],
  exclusions: [],
  ...overrides,
});

test("工作区验收能力只由完整已批准范围签发", () => {
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal()), ["workspace-explorer"]);
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({ acceptanceCriteria: ["添加工作区后立即出现。"] })), []);
});

test("任一已批准的受控工作区场景都签发场景夹具能力", () => {
  const scoped = proposal({
    acceptanceCriteria: ["添加工作区后立即出现；目录与文件可在应用内只读查看；目录加载时其他目录可浏览且重复点击不重复请求；目录失败后可在原位置重试；空目录显示非错误状态。"],
  });
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(scoped), ["workspace-explorer", "workspace-explorer-scenarios"]);
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({ acceptanceCriteria: ["添加工作区后立即出现，可展开目录，文件可在应用内只读查看。", "目录加载时其他目录可浏览；失败后原位重试。"] })), ["workspace-explorer", "workspace-explorer-scenarios"]);
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({
    acceptanceCriteria: ["添加工作区后立即出现；目录与文件可在应用内只读查看；重复读取同一目录不得产生重复请求；滚动工作区树至超长目录并确认窄窗口无横向溢出。"],
  })), ["workspace-explorer", "workspace-explorer-scenarios"]);
});

test("提案排除验收工具或原生目录时保持最小权限", () => {
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({ exclusions: ["禁止扩展验收工具的原生目录选择能力。"] })), []);
});
