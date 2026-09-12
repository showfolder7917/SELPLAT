import assert from "node:assert/strict";
import test from "node:test";

import { normalizeModelOption } from "../../../../../../../build/ai-desktop/electron/electron/services/support/platform/codex/codex.facade.js";

test("Codex 0.154.0 模型目录蛇形字段转换为桌面选择器协议", () => {
  const model = normalizeModelOption({
    slug: "gpt-6-astra",
    display_name: "GPT-6-Astra",
    description: "Most capable model",
    default_reasoning_level: "medium",
    supported_reasoning_levels: [{ effort: "low" }, { effort: "medium" }, { effort: "ultra" }],
    additional_speed_tiers: ["fast"],
    service_tiers: [{ id: "priority" }],
    visibility: "list",
  });
  assert.deepEqual(model, {
    id: "gpt-6-astra",
    displayName: "GPT-6-Astra",
    description: "Most capable model",
    provider: null,
    supportedReasoningEfforts: ["low", "medium", "ultra"],
    supportedServiceTiers: ["default", "fast"],
    defaultReasoningEffort: "medium",
    isDefault: false,
  });
});

test("缺少slug、id和model的未知目录项被明确过滤", () => {
  assert.equal(normalizeModelOption({ display_name: "Unknown" }), null);
});
