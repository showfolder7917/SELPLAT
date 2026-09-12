import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("electron/services/personas/hanli/hanli.facade.ts", "utf8");
const start = source.indexOf("executeComputerAcceptance(");
const end = source.indexOf("  /** 审批最终执行结果", start);
const acceptanceMethod = source.slice(start, end);

test("验收步骤保留专题审计但不写入韩立客户会话", () => {
  assert.match(acceptanceMethod, /recordEvent\("hanli\.acceptance\.computer_progress"/);
  assert.doesNotMatch(acceptanceMethod, /appendPersonaInternalMessage|computer:/);
  assert.doesNotMatch(acceptanceMethod, /onPersonaConversationChanged/);
});
