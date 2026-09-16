import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const acceptanceSource = readFileSync("electron/services/personas/hanli/internal/acceptance/hanli-computer-acceptance.ts", "utf8");
const operationSource = readFileSync("contracts/services/personas/hanli/value/acceptance.value.ts", "utf8");
const goalSource = readFileSync("contracts/services/personas/hanli/dto/computer-acceptance.in.dto.ts", "utf8");
const runtimeSource = readFileSync("electron/services/workflow/internal/evolution/persona-evolution.runtime.ts", "utf8");

test("任务卡页面验收使用明确目标、语义导航和页面截图门禁", () => {
  assert.match(goalSource, /taskCollaborationCriterionIds/);
  assert.match(runtimeSource, /taskCollaborationCriterionIds[\s\S]*requiresTaskCollaborationSurface/);
  assert.match(operationSource, /type: "open-task-panel"[\s\S]*type: "close-task-panel"[\s\S]*type: "open-task-collaboration"/);
  assert.match(acceptanceSource, /taskCollaborationCriterionIds\.has\(criterionId\)[\s\S]*不能由自由讨论页判定产品结果/);
  assert.match(acceptanceSource, /navigateTaskCollaboration[\s\S]*button\.section-toggle\[aria-controls="developer-task-list"\][\s\S]*button\.collaboration-task-group-entry/);
  assert.match(acceptanceSource, /async function navigateTaskCollaboration[\s\S]*waitForPanel[\s\S]*task-panel-not-open[\s\S]*task-panel-not-closed[\s\S]*task-group-not-visible/);
  assert.match(acceptanceSource, /taskCollaborationVisible: true/);
  assert.match(acceptanceSource, /resize-formal-window[\s\S]*width: 1000, height: 700/);
});

test("任务协作群滚动只移动详情面板", () => {
  const scrollStart = acceptanceSource.indexOf("function scrollTaskCollaboration");
  const scrollEnd = acceptanceSource.indexOf("function readTaskCollaborationSurface", scrollStart);
  const scrollSource = acceptanceSource.slice(scrollStart, scrollEnd);
  assert.match(scrollSource, /querySelector<HTMLElement>\("\.task-timeline-detail-pane"\)/);
  assert.match(scrollSource, /detail\.scrollTop/);
  assert.match(scrollSource, /pageScrollTop/);
  assert.doesNotMatch(scrollSource, /page\.scrollTop\s*=/);
});
