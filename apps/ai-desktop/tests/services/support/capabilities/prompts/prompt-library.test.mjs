import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { PromptLibraryFacade } from "../../../../../../../build/ai-desktop/electron/electron/services/support/capabilities/prompts/index.js";
import { controlledTestRoot, projectPaths } from "#test-paths";

const builtinRoot = path.join(projectPaths.buildRoot, "prompt-bundle");

test("提示词库公开阶段和描述并渲染声明变量", () => {
  const library = new PromptLibraryFacade(builtinRoot);
  const prompt = library.list().find((entry) => entry.id === "nangong.conversation");
  assert.equal(prompt?.stage, "conversation");
  assert.equal(prompt?.stageName, "用户交流");
  assert.match(prompt?.description || "", /调查对话/);
  const rendered = library.render("nangong.conversation", { recentConversation: "旧消息", userMessage: "新消息" });
  assert.match(rendered, /旧消息/);
  assert.match(rendered, /新消息/);
  assert.doesNotMatch(rendered, /\{\{recentConversation\}\}/);
});

test("提示词库拒绝缺失变量和未声明变量", () => {
  const library = new PromptLibraryFacade(builtinRoot);
  assert.throws(() => library.render("nangong.conversation", { recentConversation: "旧消息" }), /缺少 userMessage/);
  assert.throws(() => library.render("nangong.topic-draft", { unexpected: "value" }), /未知 unexpected/);
});

test("提示词库拒绝被篡改的正文摘要", () => {
  const temporaryRoot = mkdtempSync(path.join(controlledTestRoot, "prompt-library-"));
  try {
    const manifest = JSON.parse(readFileSync(path.join(builtinRoot, "manifest.json"), "utf8"));
    const bundle = JSON.parse(readFileSync(path.join(builtinRoot, "prompts.json"), "utf8"));
    bundle.prompts[0].content += "\n篡改";
    mkdirSync(temporaryRoot, { recursive: true });
    writeFileSync(path.join(temporaryRoot, "manifest.json"), JSON.stringify(manifest), "utf8");
    writeFileSync(path.join(temporaryRoot, "prompts.json"), JSON.stringify(bundle), "utf8");
    assert.throws(() => new PromptLibraryFacade(temporaryRoot), /摘要校验失败/);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("提示词库按 include 顺序组合并拒绝循环", () => {
  const temporaryRoot = mkdtempSync(path.join(controlledTestRoot, "prompt-includes-"));
  try {
    const records = [
      record("shared.style", "公共风格：{{tone}}", ["tone"], []),
      record("sample.task", "业务正文：{{message}}", ["message"], ["shared.style"]),
    ];
    writeBundle(temporaryRoot, records);
    const library = new PromptLibraryFacade(temporaryRoot);
    assert.equal(library.render("sample.task", { tone: "克制", message: "检查问题" }), "公共风格：克制\n\n业务正文：检查问题");
    records[0].includes = ["sample.task"];
    writeBundle(temporaryRoot, records);
    assert.throws(() => new PromptLibraryFacade(temporaryRoot), /include 循环/);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

function record(id, content, variables, includes) {
  return {
    id,
    name: id,
    description: `${id} 描述`,
    owner: "test",
    workflow: "test",
    stage: "test-stage",
    stageName: "测试阶段",
    trigger: "测试调用",
    version: 1,
    editable: true,
    file: `${id}.md`,
    variables,
    includes,
    content,
    sha256: createHash("sha256").update(content, "utf8").digest("hex"),
  };
}

function writeBundle(root, records) {
  const manifestRecords = records.map(({ content: _content, ...entry }) => entry);
  writeFileSync(path.join(root, "manifest.json"), JSON.stringify({ formatVersion: 1, bundleVersion: "test", generatedAt: new Date(0).toISOString(), promptCount: records.length, prompts: manifestRecords }), "utf8");
  writeFileSync(path.join(root, "prompts.json"), JSON.stringify({ formatVersion: 1, prompts: records }), "utf8");
}
