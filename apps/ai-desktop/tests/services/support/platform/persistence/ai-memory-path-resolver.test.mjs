import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveAiMemoryPaths } from "../../../../../../../build/ai-desktop/electron/electron/system/config/ai-memory-path-resolver.js";
import { appRoot, controlledTestRoot, projectRoot } from "#test-paths";

mkdirSync(controlledTestRoot, { recursive: true });

test("正式配置把所有 Developer 运行入口固定到应用 db 根", () => {
  const resolved = resolveAiMemoryPaths(projectRoot);
  assert.equal(resolved.configPath, path.join(appRoot, "db", "ai-memory-paths.json"));
  assert.equal(resolved.databaseRoot, path.join(appRoot, "db"));
  assert.equal(resolved.databaseFile, "events.sqlite3");
  assert.equal(resolved.databasePath, path.join(appRoot, "db", "events.sqlite3"));
  assert.deepEqual(JSON.parse(readFileSync(resolved.configPath, "utf8")), {
    schemaVersion: 2,
    databaseFile: "events.sqlite3",
  });

  const appConfigSource = readFileSync(path.join(appRoot, "electron", "system", "config", "app-config.ts"), "utf8");
  assert.match(appConfigSource, /resolveConfiguredAiMemoryPaths\(resolveProjectRoot\(\)\)/);
  assert.doesNotMatch(appConfigSource, /resolveConfiguredAiMemoryPaths\(app\.getPath\("userData"\)\)/);
});

test("路径解析只读取显式配置且不会创建数据库或备用目录", () => {
  const fixture = createFixture({ databaseFile: "custom-events.sqlite3" });
  try {
    const resolved = resolveAiMemoryPaths(fixture.projectRoot);
    assert.equal(resolved.databasePath, path.join(fixture.databaseRoot, "custom-events.sqlite3"));
    assert.equal(existsSync(resolved.databasePath), false);
  } finally {
    rmSync(fixture.projectRoot, { recursive: true, force: true });
  }
});

test("缺失、损坏、旧版机器路径和文件名逃逸均被阻断", () => {
  const missing = mkdtempSync(path.join(controlledTestRoot, "ai-memory-path-missing-"));
  try {
    assert.throws(() => resolveAiMemoryPaths(missing), /路径配置不存在/);
  } finally {
    rmSync(missing, { recursive: true, force: true });
  }

  for (const [name, rawConfiguration, expected] of [
    ["broken", "{", /路径配置无法读取/],
    ["array", "[]", /配置根必须是 JSON 对象/],
    ["version", JSON.stringify({ schemaVersion: 1, databaseFile: "events.sqlite3" }), /配置版本不受支持/],
    ["machine-root", JSON.stringify({ schemaVersion: 2, databaseRoot: "/Users/example/project/db", databaseFile: "events.sqlite3" }), /包含不支持字段：databaseRoot/],
    ["escape", null, /不是安全的 SQLite 文件名/],
  ]) {
    const fixture = createFixture(undefined, name);
    try {
      const configuration = name === "escape"
        ? JSON.stringify({ schemaVersion: 2, databaseFile: "../events.sqlite3" })
        : rawConfiguration;
      writeFileSync(fixture.configPath, `${configuration}\n`, "utf8");
      assert.throws(() => resolveAiMemoryPaths(fixture.projectRoot), expected);
    } finally {
      rmSync(fixture.projectRoot, { recursive: true, force: true });
    }
  }
});

test("Git只精确忽略活跃SQLite文件并继续跟踪配置和SQL", () => {
  const gitignore = readFileSync(path.join(projectRoot, ".gitignore"), "utf8");
  for (const entry of [
    "/apps/ai-desktop/db/events.sqlite3",
    "/apps/ai-desktop/db/events.sqlite3-wal",
    "/apps/ai-desktop/db/events.sqlite3-shm",
  ]) assert.match(gitignore, new RegExp(`^${entry.replaceAll("/", "\\/").replaceAll(".", "\\.")}$`, "m"));
  assert.doesNotMatch(gitignore, /^\*\.sqlite3$/m);
  assert.equal(existsSync(path.join(appRoot, "db", "ai-memory-paths.json")), true);
});

function createFixture(overrides = {}, suffix = "valid") {
  const fixtureProjectRoot = mkdtempSync(path.join(controlledTestRoot, `ai-memory-path-${suffix}-`));
  const configRoot = path.join(fixtureProjectRoot, "apps", "ai-desktop", "db");
  mkdirSync(configRoot, { recursive: true });
  const configPath = path.join(configRoot, "ai-memory-paths.json");
  writeFileSync(configPath, `${JSON.stringify({ schemaVersion: 2, databaseFile: "events.sqlite3", ...overrides }, null, 2)}\n`, "utf8");
  return { projectRoot: fixtureProjectRoot, configPath, databaseRoot: configRoot };
}
