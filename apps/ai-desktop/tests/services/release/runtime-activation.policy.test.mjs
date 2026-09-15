import assert from "node:assert/strict";
import test from "node:test";

import { requiresRuntimeActivation } from "../../../electron/services/support/capabilities/release/internal/runtime-activation.policy.ts";

const verifierPath = "apps/ai-desktop/electron/services/support/capabilities/release/internal/integration.verifier.ts";

test("仅候选变更预检运行器职责且未加载候选时要求受控激活", () => {
  assert.equal(requiresRuntimeActivation([], null, "candidate-sha"), false);
  assert.equal(requiresRuntimeActivation([verifierPath], null, "candidate-sha"), true);
  assert.equal(requiresRuntimeActivation([verifierPath], "candidate-sha", "candidate-sha"), false);
  assert.equal(requiresRuntimeActivation(["apps/ai-desktop/src/features/hanli/components/HanliConversationWorkspace.tsx"], null, "candidate-sha"), false);
});
