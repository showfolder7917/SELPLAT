import assert from "node:assert/strict";
import { build } from "esbuild";
import test from "node:test";
import { fileURLToPath } from "node:url";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../../../src/features/evolution/model/evolution-state-synchronizer.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  write: false,
});
const { createEvolutionStateSynchronizer } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("实时失败状态不会被较早发起的验收中初始读取覆盖", () => {
  const synchronizer = createEvolutionStateSynchronizer();
  const accepting = { updatedAt: "2026-09-12T05:10:00.000Z", currentTopicStage: { status: "accepting" } };
  const failed = { updatedAt: "2026-09-12T05:10:01.000Z", currentTopicStage: { status: "failed-pending-repair" } };

  assert.deepEqual(synchronizer.acceptLive(failed), failed);
  assert.equal(synchronizer.acceptInitial(accepting), null);
});

test("没有实时事件时仍采用初始演化快照", () => {
  const synchronizer = createEvolutionStateSynchronizer();
  const initial = { updatedAt: "2026-09-12T05:10:00.000Z", currentTopicStage: { status: "accepting" } };

  assert.deepEqual(synchronizer.acceptInitial(initial), initial);
});
