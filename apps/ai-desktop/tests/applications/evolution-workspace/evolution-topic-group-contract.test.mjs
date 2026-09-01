import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const groupSource = readFileSync(new URL("../../../src/features/evolution/components/EvolutionTopicGroupView.tsx", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../../../src/features/evolution/components/EvolutionControlWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../../src/applications/styles/desktop-applications.css", import.meta.url), "utf8");

test("专题协作群独立于南宫婉个人聊天并按专题折叠展示真实交接", () => {
  assert.match(workspaceSource, /manual-group.*专题协作群/);
  assert.match(groupSource, /aria-label="专题协作群页面"/);
  assert.match(groupSource, /evolution-topic-group-topic" open/);
  assert.match(groupSource, /\@\{entry\.nextOwner\}/);
  assert.match(groupSource, /查看状态与完整报告/);
  assert.match(groupSource, /阻塞报告/);
});

test("专题协作群使用权威档案投影且不再混入旧实时横幅", () => {
  assert.match(groupSource, /getEvolutionTopicDossier/);
  assert.match(groupSource, /data-active=\{entry\.active\}/);
  assert.doesNotMatch(groupSource, /EvolutionLiveActivity|evolution-live-activity/);
  assert.match(styles, /evolution-group-active/);
  assert.match(styles, /article\[data-active="true"\]/);
});
