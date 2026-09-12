import assert from "node:assert/strict";
import test from "node:test";
import { HanliDecisionService } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/decision/hanli-decision.service.js";

const evidence = ["消息区与输入区的职责已核对"];
const acceptanceCriteria = ["滚动消息时输入区保持可见"];
const proposal = { topicId: "topic", title: "消息页布局", evidence, acceptanceCriteria };
const check = { status: "passed", reason: "布局职责与用户操作路径有对应方案", evidence, acceptanceCriteria };
const reviewed = () => ({ architecture: structuredClone(check), layout: structuredClone(check), userJourney: structuredClone(check) });
async function decide(designReview) {
  const service = new HanliDecisionService({
    store: { state: () => ({ topics: [{ topicId: "topic", evidence }] }) },
    memory: null, prompts: { render: () => "review" },
    askHanli: async () => JSON.stringify({ decision: "approved", advice: "建议通过", designReview }),
    readStableUserId: () => "test", readProjectScope: () => "test",
  });
  return service.reviewOneShotProposal(proposal);
}

test("缺少设计判断时不能仅凭 approved 派发执行", async () => {
  const result = await decide(undefined);
  assert.equal(result.decision, "supplement-required");
  assert.match(result.advice, /架构/);
  assert.match(result.advice, /页面布局/);
  assert.match(result.advice, /用户操作路径/);
});
test("设计检查引用本轮证据和验收条件后允许通过，并保存审查意见", async () => {
  const result = await decide(reviewed());
  assert.equal(result.decision, "approved");
  assert.match(result.advice, /韩立设计检查/);
});
test("布局未通过、捏造证据或缺少验收条件分别退回南宫婉补充", async () => {
  for (const patch of [
    { status: "needs-work", reason: "输入区会遮挡消息" },
    { evidence: ["不存在于本轮的证据"] },
    { acceptanceCriteria: ["未经约定的新验收条件"] },
    { acceptanceCriteria: [] },
  ]) {
    const review = reviewed();
    Object.assign(review.layout, patch);
    assert.equal((await decide(review)).decision, "supplement-required");
  }
});
test("非界面方案可以说明布局不适用，但不能跳过架构检查", async () => {
  const review = reviewed();
  review.layout = { status: "not-applicable", reason: "该范围不修改界面", evidence, acceptanceCriteria: [] };
  assert.equal((await decide(review)).decision, "approved");
  review.architecture.status = "not-applicable";
  assert.equal((await decide(review)).decision, "supplement-required");
});
