import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serviceModule = path.resolve(appRoot, "../../build/ai-desktop/electron/electron/services/support/capabilities/rules/rule-bundle.facade.js");
const { RuleBundleService } = await import(pathToFileURL(serviceModule));
const sha256 = (content) => createHash("sha256").update(content, "utf8").digest("hex");

function fixtureRoot(name) {
  return path.join(tmpdir(), `ai-desktop-rule-bundle-${process.pid}-${name}`);
}

function writeBuiltin(root, rules) {
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "rules.json"), JSON.stringify({ formatVersion: 1, rules }), "utf8");
  writeFileSync(path.join(root, "manifest.json"), JSON.stringify({
    formatVersion: 1,
    bundleVersion: "test-1",
    generatedAt: "2026-08-27T00:00:00.000Z",
    ruleCount: rules.length,
    rules: rules.map(({ logicalId, sha256: hash, customerOverridable }) => ({ logicalId, sha256: hash, customerOverridable })),
  }), "utf8");
}

test("validated customer overlay replaces only an overridable built-in rule", () => {
  const root = fixtureRoot("accepted");
  const builtinRoot = path.join(root, "builtin");
  const overlayRoot = path.join(root, "overrides");
  try {
    const content = "# Builtin\nbase";
    writeBuiltin(builtinRoot, [{ logicalId: "CUSTOMIZABLE_RULE", title: "Builtin", content, sha256: sha256(content), customerOverridable: true }]);
    mkdirSync(overlayRoot, { recursive: true });
    writeFileSync(path.join(overlayRoot, "customer.json"), JSON.stringify({ formatVersion: 1, rules: [{ logicalId: "CUSTOMIZABLE_RULE", content: "# Customer\noverride" }] }), "utf8");
    const service = new RuleBundleService(builtinRoot, overlayRoot);
    assert.equal(service.status().state, "ready");
    assert.equal(service.status().overlayRuleCount, 1);
    assert.equal(service.resolve("CUSTOMIZABLE_RULE").rule.source, "customer-overlay");
    assert.match(service.renderDeveloperInstructions(), /# Customer/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("one invalid record rejects its whole overlay file and preserves built-ins", () => {
  const root = fixtureRoot("rejected");
  const builtinRoot = path.join(root, "builtin");
  const overlayRoot = path.join(root, "overrides");
  try {
    const content = "# Locked\nbase";
    writeBuiltin(builtinRoot, [{ logicalId: "LOCKED_RULE", title: "Locked", content, sha256: sha256(content), customerOverridable: false }]);
    mkdirSync(overlayRoot, { recursive: true });
    writeFileSync(path.join(overlayRoot, "invalid.json"), JSON.stringify({ formatVersion: 1, rules: [{ logicalId: "LOCKED_RULE", content: "forbidden" }] }), "utf8");
    const service = new RuleBundleService(builtinRoot, overlayRoot);
    assert.equal(service.status().state, "degraded");
    assert.equal(service.status().rejectedOverlayCount, 1);
    assert.equal(service.resolve("LOCKED_RULE").rule.source, "builtin");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("production manifest keeps development resources out of the packaged whitelist", () => {
  const manifest = JSON.parse(readFileSync(path.join(appRoot, "ruleengine/manifest/production-rules.json"), "utf8"));
  assert.ok(manifest.rules.length > 0);
  assert.ok(manifest.rules.every((rule) => !rule.resourcePath.split("/").some((segment) => /^(archive|history|tests?|templates?|python|会话)$/i.test(segment))));
});
