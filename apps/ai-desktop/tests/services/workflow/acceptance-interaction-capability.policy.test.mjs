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
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({
    content: "在左侧 Explorer 增加工作区入口。",
    impactScope: ["只展示工作区添加入口。"],
    acceptanceCriteria: ["添加工作区后立即出现。"],
  })), []);
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
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({
    content: "验证受控工作区目录的读取恢复与独立滚动。",
    impactScope: ["工作区树仅用于受控目录读取与滚动取证。"],
    acceptanceCriteria: [
      "在受控工作区目录中连续读取同一目录期间请求计数始终为 1。",
      "首次失败后原位置重试并恢复目录条目。",
      "工作区树滚动至超长目录，且不影响任务区和主内容区滚动位置。",
    ],
  })), ["workspace-explorer", "workspace-explorer-scenarios"]);
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({
    content: "验证目录读取恢复。",
    impactScope: ["仅检查目录读取。"],
    acceptanceCriteria: ["失败后重试目录读取。"],
  })), []);
});

test("提案排除验收工具或原生目录时保持最小权限", () => {
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({ exclusions: ["禁止扩展验收工具的原生目录选择能力。"] })), []);
});

test("跨任务人物占用只由已批准的明确验收条件签发", () => {
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({
    content: "完成专题状态收口与人物真实状态同步。",
    impactScope: ["左侧人物栏和人物页只读取协作状态存储。"],
    acceptanceCriteria: ["令狐关联另一项在途任务时，人物栏和人物页显示该任务真实阶段，不显示已完成专题的历史等待状态。"],
  })), ["cross-task-member-occupancy"]);
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({
    content: "完成专题状态收口与人物真实状态同步。",
    impactScope: ["左侧人物栏和人物页只读取协作状态存储。"],
    acceptanceCriteria: ["令狐没有 currentTaskId 时显示空闲。"],
  })), []);
});

test("重启后回收临时工作区由批准范围签发独立能力", () => {
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({
    acceptanceCriteria: ["左侧工作区树可以读取文件，应用重启后自动清理验收临时工作区。"],
  })), ["workspace-explorer", "workspace-startup-recovery"]);
});

test("临时工作区收尾失败恢复由批准范围签发独立能力", () => {
  assert.deepEqual(resolveAcceptanceInteractionCapabilities(proposal({
    acceptanceCriteria: ["左侧工作区树可以读取文件，模拟收尾失败后自动恢复并移除临时工作区。"],
  })), ["workspace-explorer", "workspace-cleanup-recovery"]);
});
