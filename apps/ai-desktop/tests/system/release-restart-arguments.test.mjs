import test from "node:test";
import assert from "node:assert/strict";
import { releaseRestartArguments } from "../../../../build/ai-desktop/electron/electron/system/bootstrap/release-restart-arguments.js";

test("发布重启保留隔离身份且更新版本，不携带旧健康检查", () => {
  const identity = ["--ai-desktop-user-data-dir=/isolated/user-data", "--ai-desktop-acceptance-isolation-root=/isolated", "--ai-desktop-acceptance-protected-project-root=/formal", "--ai-desktop-acceptance-protected-user-data-root=/formal-data"];
  const args = releaseRestartArguments("/isolated/project", "new-sha", ["app", "--selplat-root=/old", "--ai-desktop-runtime-sha=old", "--ai-desktop-health-check-file=/old-health", ...identity]);
  assert.deepEqual(args, ["--selplat-root=/isolated/project", "--ai-desktop-variant=developer", "--ai-desktop-runtime-sha=new-sha", ...identity]);
});
test("正式实例重启不产生隔离参数", () => {
  assert.equal(releaseRestartArguments("/formal", "sha", []).length, 3);
});
