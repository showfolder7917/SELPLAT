import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { assertWorkspaceDataPath, resolvePathDiagnosticWorkspaceRoot, resolveSelectedWorkspaceRoot } from "../../../../../scripts/selected-workspace-root.mjs";
import { appRoot, controlledTestRoot } from "#test-paths";

test("发布、签名、验证和规则构建共用所选工作区门面", () => {
  for (const relative of [
    "electron-builder.developer.config.cjs",
    "scripts/build-rule-bundle.mjs",
    "scripts/sign-mac-developer-app.mjs",
    "scripts/interaction-test-paths.mjs",
    "scripts/test-document-runner.mjs",
    "scripts/verify-mac-developer-app.mjs",
    "scripts/verify-package-content.mjs",
  ]) {
    assert.match(readFileSync(path.join(appRoot, relative), "utf8"), /resolveSelectedWorkspaceRoot|output:\s*path\.join\(selplatRoot/u, relative);
  }
});

test("路径诊断入口只读取候选工作树，不提升为运行数据工作区", () => {
  const source = readFileSync(path.join(appRoot, "scripts/resolve-application-paths.mjs"), "utf8");
  assert.match(source, /resolvePathDiagnosticWorkspaceRoot\(sourceProjectRoot\)/);
  assert.match(source, /source-worktree-diagnostic-only/);
});

test("发布候选源码始终使用显式选择工作区作为数据根", { concurrency: false }, () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "selected-workspace-root-"));
  const prior = process.env.SELPLAT_ROOT;
  try {
    mkdirSync(path.join(root, "apps", "ai-desktop"), { recursive: true });
    writeFileSync(path.join(root, "settings.gradle"), "rootProject.name='fixture'\n", "utf8");
    writeFileSync(path.join(root, "apps", "ai-desktop", "package.json"), "{}\n", "utf8");
    process.env.SELPLAT_ROOT = root;
    const candidateSource = path.join(root, "cache", "collaboration", "worktrees", "release", "release-1");
    assert.equal(resolveSelectedWorkspaceRoot(candidateSource), root);
    assert.equal(assertWorkspaceDataPath(root, path.join(root, "OPTION", "temp", "evidence")), path.join(root, "OPTION", "temp", "evidence"));
    assert.throws(() => assertWorkspaceDataPath(root, path.join(root, "cache", "collaboration", "worktrees", "release", "evidence")), /候选工作树/);
  } finally {
    if (prior === undefined) delete process.env.SELPLAT_ROOT;
    else process.env.SELPLAT_ROOT = prior;
    rmSync(root, { recursive: true, force: true });
  }
});

test("隔离工作树缺少所选工作区时给出可操作提示", { concurrency: false }, () => {
  const prior = process.env.SELPLAT_ROOT;
  try {
    delete process.env.SELPLAT_ROOT;
    assert.throws(
      () => resolveSelectedWorkspaceRoot("/tmp/collaboration/worktrees/release/release-1"),
      /工作区中没有工程，请添加工程/,
    );
  } finally {
    if (prior === undefined) delete process.env.SELPLAT_ROOT;
    else process.env.SELPLAT_ROOT = prior;
  }
});

test("路径诊断只读识别结构完整的协作工作树，不放宽运行数据工作区限制", { concurrency: false }, () => {
  const root = mkdtempSync(path.join(controlledTestRoot, "path-diagnostic-worktree-"));
  const prior = process.env.SELPLAT_ROOT;
  try {
    mkdirSync(path.join(root, "apps", "ai-desktop"), { recursive: true });
    writeFileSync(path.join(root, "settings.gradle"), "rootProject.name='fixture'\n", "utf8");
    writeFileSync(path.join(root, "apps", "ai-desktop", "package.json"), "{}\n", "utf8");
    delete process.env.SELPLAT_ROOT;
    const candidateSource = path.join(root, "collaboration", "worktrees", "task", "r1");
    mkdirSync(candidateSource, { recursive: true });
    writeFileSync(path.join(candidateSource, "settings.gradle"), "rootProject.name='candidate'\n", "utf8");
    mkdirSync(path.join(candidateSource, "apps", "ai-desktop"), { recursive: true });
    writeFileSync(path.join(candidateSource, "apps", "ai-desktop", "package.json"), "{}\n", "utf8");
    assert.equal(resolvePathDiagnosticWorkspaceRoot(candidateSource), candidateSource);
    assert.throws(() => resolveSelectedWorkspaceRoot(candidateSource), /工作区中没有工程，请添加工程/);
  } finally {
    if (prior === undefined) delete process.env.SELPLAT_ROOT;
    else process.env.SELPLAT_ROOT = prior;
    rmSync(root, { recursive: true, force: true });
  }
});
