import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const application = readFileSync(new URL("../../../src/applications/developer/DeveloperApplication.tsx", import.meta.url), "utf8");
const activitySection = readFileSync(new URL("../../../src/applications/developer/sections/DeveloperActivitySection.tsx", import.meta.url), "utf8");
const activityBar = readFileSync(new URL("../../../src/applications/developer/layout/DeveloperActivityBar.tsx", import.meta.url), "utf8");
const controller = readFileSync(new URL("../../../src/applications/developer/model/useDeveloperApplicationController.ts", import.meta.url), "utf8");
const feature = readFileSync(new URL("../../../src/features/test-console/components/TestConsoleFeature.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../../../src/features/test-console/components/TestConsoleFloatingPanel.tsx", import.meta.url), "utf8");
const view = readFileSync(new URL("../../../src/features/test-console/components/TestConsoleView.tsx", import.meta.url), "utf8");
const viewModel = readFileSync(new URL("../../../src/features/test-console/model/createTestConsoleViewModel.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../../src/applications/styles/desktop-applications.css", import.meta.url), "utf8");

test("测试台通过 Developer 四层结构进入左侧活动栏", () => {
  assert.match(application, /DeveloperActivitySection/);
  assert.match(activitySection, /TestConsoleFeature/);
  assert.match(activityBar, /testConsoleControl/);
  assert.match(controller, /testConsolePanel/);
  assert.match(feature, /createTestConsoleViewModel/);
  assert.match(feature, /TestConsoleFloatingPanel/);
});

test("测试台复用 SELUI 浮动窗口和 Disclosure 并支持侧边调整", () => {
  assert.match(panel, /floatingPanel\.mount/);
  assert.match(panel, /activity-test-console/);
  assert.match(panel, /resizable:\s*\{/);
  assert.match(panel, /minWidth:\s*MINIMUM_WIDTH/);
  assert.match(panel, /maxWidth:\s*MAXIMUM_WIDTH/);
  assert.match(panel, /right:\s*true/);
  assert.match(view, /SelUiDisclosure/);
  assert.doesNotMatch(view, /<details|<summary/);
  assert.match(styles, /\.dev-activitybar \.dev-test-console-control/);
  assert.match(styles, /\.dev-activitybar \.dev-test-console\s*\{[^}]*left:\s*58px/);
  assert.match(styles, /\.dev-activitybar \.dev-test-console-content\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.dev-activitybar \.dev-test-console \.test-console-disclosure \.seldisclosure-trigger\s*\{[^}]*width:\s*100%;[^}]*height:\s*44px/);
});

test("测试台只读取权威状态且不以页面文字伪造通过", () => {
  assert.match(viewModel, /source\.collaboration\?\.tasks/);
  assert.match(viewModel, /source\.evolution\?\.archiveRecords/);
  assert.match(viewModel, /task\?\.unifiedTest\?\.status/);
  assert.match(viewModel, /event\.type === "release\.restart_healthy"/);
  assert.match(viewModel, /source\.runtime\.version/);
  assert.match(viewModel, /modelCatalog\.models\.some/);
  assert.doesNotMatch(view, /0\.154\.0|Astra已出现|统一测试通过|重启健康/);
});

test("测试台隐藏本机路径、命令原文和常见敏感字段", () => {
  assert.match(viewModel, /本机路径已隐藏/);
  assert.match(viewModel, /敏感信息已隐藏/);
  assert.doesNotMatch(viewModel, /latestTask\?\.commands.*command/);
  assert.doesNotMatch(view, /payload|runtime\.path|audit\.path|workspaces/);
});
