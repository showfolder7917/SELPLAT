import assert from "node:assert/strict";
import test from "node:test";
import { acceptanceEvidenceProblems } from "../../../../../build/ai-desktop/electron/electron/services/personas/hanli/internal/acceptance-evidence-policy.js";
import { AcceptanceHandoffService } from "../../../../../build/ai-desktop/electron/electron/services/workflow/internal/acceptance-handoff.service.js";

const check = { checkId: "navigation", verificationMode: "interaction", operations: [{ type: "click", target: "韩立" }, { type: "inspect-text", text: "与韩立自由讨论" }] };
const plan = { checks: [check] };
const run = { evidenceAttachmentIds: ["screenshot"], stepResults: check.operations.map((operation, operationIndex) => ({ checkId: check.checkId, operationIndex, operation, status: "passed", screenshotAttachmentId: "screenshot" })) };

test("截图和聚焦不能冒充交互验收", () => {
  const errors = acceptanceEvidenceProblems({ checks: [{ ...check, operations: [{ type: "capture", label: "已经切换" }] }] });
  assert.ok(errors.some((error) => error.includes("缺少结果断言")));
  assert.ok(errors.some((error) => error.includes("缺少真实交互")));
});
test("真实交互后有断言且逐步证据完整才通过", () => assert.deepEqual(acceptanceEvidenceProblems(plan, run), []));
test("漏步骤、伪造操作、缺截图均不能通过", () => {
  assert.ok(acceptanceEvidenceProblems(plan, { ...run, stepResults: [] }).length);
  assert.ok(acceptanceEvidenceProblems(plan, { ...run, stepResults: run.stepResults.map((step) => ({ ...step, operation: { type: "capture", label: "替代" } })) }).length);
  assert.ok(acceptanceEvidenceProblems(plan, { ...run, evidenceAttachmentIds: [] }).length);
});
test("交互前的断言不能证明交互后结果", () => assert.ok(acceptanceEvidenceProblems({ checks: [{ ...check, operations: [...check.operations].reverse() }] }).length));
test("显式观察项仍必须有结果断言", () => {
  assert.deepEqual(acceptanceEvidenceProblems({ checks: [{ ...check, verificationMode: "observation", operations: [{ type: "inspect-layout", target: "任务" }] }] }), []);
});

test("验收真实阶段产生内部交接和用户结果且关闭进行中节点", () => {
  const events = [], messages = [];
  const proposal = { proposalId: "p", topicId: "t" };
  const service = new AcceptanceHandoffService({ store: { state: () => ({ topics: [{ topicId: "t", title: "验收导航", createdAt: "2026-09-04T00:00:00Z" }] }) }, recordTimelineEvent: (event) => events.push(event), readHanliConversationId: () => "c", memory: { appendPersonaInternalMessage: (message) => { messages.push(message); return { messages }; } } });
  service.publish(proposal, "received", "已收到结果并提交验收");
  service.publish(proposal, "started", "开始检查");
  service.publish(proposal, "passed", "真实检查通过，依据run-1");
  assert.equal(events[1].fact.nodeId, events[2].fact.nodeId);
  assert.equal(events[2].group.status, "completed");
  assert.equal(messages.filter((message) => message.messageId.startsWith("internal:")).length, 3);
  assert.equal(messages.at(-1).speakerPersonaId, "han-li");
  assert.match(messages.at(-1).content, /run-1/);
});
