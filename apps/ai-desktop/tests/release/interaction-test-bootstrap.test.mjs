import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../../scripts/run-interaction-tests.mjs", import.meta.url), "utf8");
const config = readFileSync(new URL("../../playwright.interaction.config.ts", import.meta.url), "utf8");
const paths = readFileSync(new URL("../../scripts/interaction-test-paths.mjs", import.meta.url), "utf8");
const packageJson = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
const isolatedMain = readFileSync(new URL("../interaction/isolated-main.cjs", import.meta.url), "utf8");
const sidebarSpec = readFileSync(new URL("../interaction/developer-sidebar.spec.ts", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../../vite.config.mjs", import.meta.url), "utf8");
const taskTestRunner = readFileSync(new URL("../../electron/services/support/capabilities/testing/internal/task-worktree-test.runner.ts", import.meta.url), "utf8");

test("交互测试引导不依赖尚未编译的本地公共包", () => {
  assert.doesNotMatch(runner, /@selplat\/node-common-core/);
  assert.doesNotMatch(config, /@selplat\/node-common-core/);
  assert.match(runner, /resolveInteractionTestPaths/);
  assert.match(config, /resolveInteractionTestPaths/);
  assert.match(paths, /resolveDependencyCache/);
  assert.match(paths, /temporaryMaterialsRoot/);
  assert.match(paths, /archiveLogRoot/);
});

test("桌面交互测试使用固定隔离入口并加载生产文件与正式窗口尺寸", () => {
  assert.match(packageJson, /"test:interaction": "npm run build:developer && node scripts\/run-with-dependencies\.mjs node scripts\/run-interaction-tests\.mjs"/);
  assert.match(isolatedMain, /main-window-layout\.cjs/);
  assert.match(isolatedMain, /AI_DESKTOP_INTERACTION_FILE/);
  assert.doesNotMatch(isolatedMain, /AI_DESKTOP_INTERACTION_URL/);
  assert.match(sidebarSpec, /productionRendererFile/);
  assert.match(sidebarSpec, /1560, height: 980/);
  assert.match(sidebarSpec, /1366, height: 768/);
  assert.match(sidebarSpec, /1000, height: 700/);
  assert.match(sidebarSpec, /设置按钮必须锚定左下/);
  assert.match(sidebarSpec, /设置标题不能竖排/);
  assert.match(viteConfig, /cssCodeSplit: false/);
  assert.match(taskTestRunner, /delete environment\.ELECTRON_RUN_AS_NODE/);
  assert.match(taskTestRunner, /delete environment\.NODE_INSPECT_RESUME_ON_START/);
  assert.match(taskTestRunner, /DEBUG: "pw:browser"/);
  assert.match(sidebarSpec, /delete isolatedEnvironment\.VSCODE_INSPECTOR_OPTIONS/);
});
