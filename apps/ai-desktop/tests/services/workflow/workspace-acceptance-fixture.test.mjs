import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { transform } from "esbuild";

const source = readFileSync("electron/system/ipc/workspace-acceptance-fixture.ts", "utf8");
const workspaceIpcSource = readFileSync("electron/system/ipc/domains/register-workspace-ipc.ts", "utf8");
const transformed = await transform(source, { loader: "ts", format: "esm", target: "es2022" });
const { WorkspaceAcceptanceFixture } = await import(`data:text/javascript;base64,${Buffer.from(transformed.code).toString("base64")}`);

test("验收工作区夹具只交付一次，并在验收结束撤销登记和目录", () => {
  // 依赖包装器会把 TMPDIR 指向只读共享缓存；夹具本身接收应用 temp 根，因此测试显式使用 Darwin 可写系统临时目录。
  const temporaryRoot = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-fixture-test-"));
  const roots = [];
  const workspaces = {
    read: () => ({ roots: [...roots] }),
    remove: (id) => {
      const index = roots.findIndex((root) => root.id === id);
      if (index >= 0) roots.splice(index, 1);
    },
    listDirectory: (id, relativePath) => ({ workspaceId: id, relativePath, entries: relativePath === "empty" ? [] : [{ name: "README.md", relativePath: `${relativePath ? `${relativePath}/` : ""}README.md`, kind: "file" }] }),
  };
  try {
    const fixture = new WorkspaceAcceptanceFixture(workspaces, temporaryRoot);
    const reservation = fixture.reserve("basic", 41);
    assert.equal(fixture.takeDirectory(99), null, "其他 Renderer 不能消费验收目录");
    assert.equal(fixture.takeDirectory(41), null, "前置场景不能提前消费一次性验收目录");
    assert.equal(fixture.isDirectorySelectionBlocked(41), true, "前置场景不能退回原生目录选择器");
    fixture.setSceneActive(true);
    const directory = fixture.takeDirectory(41);
    assert.ok(directory);
    assert.equal(reservation.displayName, path.basename(directory));
    assert.match(reservation.displayName, /^韩立验收工作区-/);
    assert.equal(fixture.takeDirectory(41), null);
    assert.match(readFileSync(path.join(directory, "README.md"), "utf8"), /验收工作区/);
    roots.push({ id: "fixture-root", path: directory });
    fixture.cleanup();
    assert.equal(roots.length, 0);
    assert.equal(existsSync(directory), false);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("统一准备入口确认页面可用与工作区可见后才交付清理句柄", async () => {
  const temporaryRoot = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-environment-test-"));
  const roots = [];
  const workspaces = {
    read: () => ({ roots: [...roots] }),
    add: (directory) => {
      const root = { id: "prepared-fixture", path: directory };
      roots.push(root);
      return { primaryId: root.id, roots: [...roots] };
    },
    remove: (id) => {
      const index = roots.findIndex((root) => root.id === id);
      if (index >= 0) roots.splice(index, 1);
    },
    listDirectory: () => ({ entries: [] }),
  };
  try {
    const fixture = new WorkspaceAcceptanceFixture(workspaces, temporaryRoot);
    let pageCallCount = 0;
    const publishedStates = [];
    const target = { isDestroyed: () => false, webContents: { id: 77, send: (channel, state) => publishedStates.push({ channel, state }), executeJavaScript: async () => {
      pageCallCount += 1;
      if (pageCallCount > 1) return "released";
      const directory = fixture.takeDirectory(77);
      const state = workspaces.add(directory);
      fixture.registerWorkspace(77, directory, state);
      return "ready";
    } } };
    const environment = await fixture.prepare("basic", target);
    assert.equal(roots.length, 1, "只有页面确认显示后才向调用方交付环境");
    assert.equal(environment.displayName, path.basename(roots[0].path));
    await environment.dispose();
    assert.equal(roots.length, 0);
    assert.equal(existsSync(path.join(temporaryRoot, environment.displayName)), false);
    assert.deepEqual(publishedStates, [{ channel: "desktop:workspace-state-changed", state: { roots: [] } }], "主进程清理后必须把唯一工作区状态推送回原窗口");
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("统一准备入口可在真实页面生命周期内模拟一次收尾失败并由同一句柄恢复", async () => {
  const temporaryRoot = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-simulated-cleanup-test-"));
  const roots = [];
  const workspaces = {
    read: () => ({ roots: [...roots] }),
    add: (directory) => { const root = { id: "simulated-fixture", path: directory }; roots.push(root); return { primaryId: root.id, roots: [...roots] }; },
    remove: (id) => { const index = roots.findIndex((root) => root.id === id); if (index >= 0) roots.splice(index, 1); },
    listDirectory: () => ({ entries: [] }),
  };
  try {
    const fixture = new WorkspaceAcceptanceFixture(workspaces, temporaryRoot);
    let pageCallCount = 0;
    const target = { isDestroyed: () => false, webContents: { id: 81, send: () => undefined, executeJavaScript: async () => {
      pageCallCount += 1;
      if (pageCallCount > 1) return "released";
      const directory = fixture.takeDirectory(81);
      const state = workspaces.add(directory);
      fixture.registerWorkspace(81, directory, state);
      return "ready";
    } } };
    const environment = await fixture.prepare("basic", target, true);
    const first = await environment.dispose();
    assert.deepEqual(first, { status: "failed", phase: "directory", reason: "受控验收模拟临时目录被占用。", workspaceId: "simulated-fixture" });
    assert.equal(roots.length, 1, "模拟失败不应提前改变工作区状态");
    const second = await environment.dispose();
    assert.deepEqual(second, { status: "completed", recovered: true, workspaceId: "simulated-fixture" });
    assert.equal(roots.length, 0);
    assert.equal(existsSync(path.join(temporaryRoot, environment.displayName)), false);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("统一准备入口在页面未就绪时撤销目录并阻止验收开始", async () => {
  const temporaryRoot = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-environment-failure-test-"));
  const roots = [];
  const workspaces = { read: () => ({ roots: [...roots] }), remove: () => undefined, listDirectory: () => ({ entries: [] }) };
  try {
    const fixture = new WorkspaceAcceptanceFixture(workspaces, temporaryRoot);
    const target = { isDestroyed: () => false, webContents: { id: 78, executeJavaScript: async () => "page-not-ready" } };
    await assert.rejects(fixture.prepare("basic", target), /验收页面未就绪/);
    assert.deepEqual(readdirSync(temporaryRoot), []);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("隔离清理失败恢复场景在目录删除成功前保持同一环境可重试", async () => {
  const temporaryRoot = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-cleanup-recovery-test-"));
  const roots = [];
  let removeAttempts = 0;
  const workspaces = {
    read: () => ({ roots: [...roots] }),
    add: (directory) => {
      const root = { id: "recovery-fixture", path: directory };
      roots.push(root);
      return { primaryId: root.id, roots: [...roots] };
    },
    remove: (id) => {
      const index = roots.findIndex((root) => root.id === id);
      if (index >= 0) roots.splice(index, 1);
    },
    listDirectory: () => ({ entries: [] }),
  };
  try {
    const fixture = new WorkspaceAcceptanceFixture(workspaces, temporaryRoot, (directory) => {
      removeAttempts += 1;
      if (removeAttempts === 1) throw new Error("模拟目录正在被占用");
      rmSync(directory, { recursive: true, force: true });
    });
    let pageCallCount = 0;
    const target = { isDestroyed: () => false, webContents: { id: 79, send: () => undefined, executeJavaScript: async () => {
      pageCallCount += 1;
      if (pageCallCount > 1) return "released";
      const directory = fixture.takeDirectory(79);
      const state = workspaces.add(directory);
      fixture.registerWorkspace(79, directory, state);
      return "ready";
    } } };
    const environment = await fixture.prepare("basic", target);
    const first = await environment.dispose();
    assert.deepEqual(first, { status: "failed", phase: "directory", reason: "模拟目录正在被占用", workspaceId: "recovery-fixture" });
    assert.equal(roots.length, 0, "已移除工作区不能阻止同一环境重试目录清理");
    assert.equal(existsSync(path.join(temporaryRoot, environment.displayName)), true);
    const second = await environment.dispose();
    assert.deepEqual(second, { status: "completed", recovered: true, workspaceId: "recovery-fixture" });
    assert.equal(existsSync(path.join(temporaryRoot, environment.displayName)), false);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("页面投影首次未释放时沿用同一环境重试并标记恢复", async () => {
  const temporaryRoot = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-projection-recovery-test-"));
  const roots = [];
  const workspaces = {
    read: () => ({ roots: [...roots] }),
    add: (directory) => {
      const root = { id: "projection-fixture", path: directory };
      roots.push(root);
      return { primaryId: root.id, roots: [...roots] };
    },
    remove: (id) => {
      const index = roots.findIndex((root) => root.id === id);
      if (index >= 0) roots.splice(index, 1);
    },
    listDirectory: () => ({ entries: [] }),
  };
  try {
    const fixture = new WorkspaceAcceptanceFixture(workspaces, temporaryRoot);
    let pageCallCount = 0;
    const target = { isDestroyed: () => false, webContents: { id: 80, send: () => undefined, executeJavaScript: async () => {
      pageCallCount += 1;
      if (pageCallCount === 1) {
        const directory = fixture.takeDirectory(80);
        const state = workspaces.add(directory);
        fixture.registerWorkspace(80, directory, state);
        return "ready";
      }
      return pageCallCount === 2 ? "projection-stale" : "released";
    } } };
    const environment = await fixture.prepare("basic", target);
    const first = await environment.dispose();
    assert.equal(first.status, "failed");
    assert.equal(first.phase, "workspace");
    const second = await environment.dispose();
    assert.deepEqual(second, { status: "completed", recovered: true, workspaceId: null });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("场景夹具只为已登记临时根提供延迟、一次失败与空目录响应", async () => {
  const temporaryRoot = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-scenario-test-"));
  const roots = [];
  const workspaces = {
    read: () => ({ roots: [...roots] }),
    remove: (id) => {
      const index = roots.findIndex((root) => root.id === id);
      if (index >= 0) roots.splice(index, 1);
    },
    listDirectory: (id, relativePath) => ({ workspaceId: id, relativePath, entries: relativePath === "empty" ? [] : [{ name: "README.md", relativePath: `${relativePath}/README.md`, kind: "file" }] }),
  };
  try {
    const fixture = new WorkspaceAcceptanceFixture(workspaces, temporaryRoot);
    const reservation = fixture.reserve("scenarios", 42);
    fixture.setSceneActive(true);
    const directory = fixture.takeDirectory(42);
    assert.ok(directory);
    assert.equal(existsSync(path.join(directory, "工作区资源浏览-窄窗口超长目录名称验证-保持树和主查看区边界稳定")), true);
    assert.equal(existsSync(path.join(directory, "z-滚动验收目录-01")), true);
    assert.equal(existsSync(path.join(directory, "z-滚动验收目录-48")), true);
    roots.push({ id: "fixture-root", path: directory });
    assert.equal(fixture.registerWorkspace(99, directory, { primaryId: "fixture-root", roots: [...roots] }), null);
    assert.deepEqual(fixture.registerWorkspace(42, directory, { primaryId: "fixture-root", roots: [...roots] }), { displayName: reservation.displayName, workspaceId: "fixture-root" });

    assert.equal(fixture.readDirectory(99, "fixture-root", "slow-a"), null, "其他 Renderer 不能读取验收场景");
    const delayed = fixture.readDirectory(42, "fixture-root", "slow-a");
    assert.equal(delayed?.scenario, "delayed");
    assert.equal(delayed?.fixtureLabel, reservation.displayName);
    assert.deepEqual(fixture.getDirectoryReadEvidence(42, "slow-a"), { relativePath: "slow-a", requestCount: 1, pending: true, outcome: "started" });
    assert.equal(fixture.getDirectoryReadEvidence(99, "slow-a"), null, "其他 Renderer 不能读取夹具请求摘要");
    let delayedSettled = false;
    void delayed?.result.then(() => { delayedSettled = true; });
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(delayedSettled, false, "受控点击后的首张截图必须仍能观察到目录读取中");
    assert.deepEqual(await delayed?.result, { workspaceId: "fixture-root", relativePath: "slow-a", entries: [{ name: "README.md", relativePath: "slow-a/README.md", kind: "file" }] });
    assert.deepEqual(fixture.getDirectoryReadEvidence(42, "slow-a"), { relativePath: "slow-a", requestCount: 1, pending: false, outcome: "succeeded" });

    const firstRetry = fixture.readDirectory(42, "fixture-root", "retry-once");
    assert.equal(firstRetry?.scenario, "retry-once");
    assert.equal(firstRetry?.fixtureLabel, reservation.displayName);
    await assert.rejects(firstRetry?.result, /模拟目录读取失败/);
    assert.deepEqual(fixture.getDirectoryReadEvidence(42, "retry-once"), { relativePath: "retry-once", requestCount: 1, pending: false, outcome: "failed" });
    const retried = fixture.readDirectory(42, "fixture-root", "retry-once");
    assert.equal(retried?.scenario, "retry-once-retry");
    let retriedSettled = false;
    void retried?.result.then(() => { retriedSettled = true; });
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(retriedSettled, false, "重试后的首张截图必须仍能观察到目录读取中");
    assert.deepEqual(fixture.getDirectoryReadEvidence(42, "retry-once"), { relativePath: "retry-once", requestCount: 2, pending: true, outcome: "started" });
    assert.deepEqual(await retried?.result, { workspaceId: "fixture-root", relativePath: "retry-once", entries: [{ name: "README.md", relativePath: "retry-once/README.md", kind: "file" }] });
    assert.deepEqual(fixture.getDirectoryReadEvidence(42, "retry-once"), { relativePath: "retry-once", requestCount: 2, pending: false, outcome: "succeeded" });
    assert.equal(fixture.readDirectory(42, "unregistered-root", "slow-a"), null);
    assert.equal(fixture.readDirectory(42, "fixture-root", "empty"), null);
    fixture.cleanup();
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("夹具以真实路径绑定和清理 macOS 临时目录别名登记", () => {
  const physicalRoot = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-realpath-test-"));
  const aliasParent = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-alias-test-"));
  const aliasRoot = path.join(aliasParent, "temporary-root-alias");
  const roots = [];
  const workspaces = {
    read: () => ({ roots: [...roots] }),
    remove: (id) => {
      const index = roots.findIndex((root) => root.id === id);
      if (index >= 0) roots.splice(index, 1);
    },
    listDirectory: () => ({ entries: [] }),
  };
  try {
    symlinkSync(physicalRoot, aliasRoot, "dir");
    const fixture = new WorkspaceAcceptanceFixture(workspaces, aliasRoot);
    fixture.reserve("scenarios", 45);
    fixture.setSceneActive(true);
    const directory = fixture.takeDirectory(45);
    assert.ok(directory);
    const persistedDirectory = realpathSync.native(directory);
    assert.equal(directory, persistedDirectory, "夹具必须返回与工作区持久化一致的真实路径");
    roots.push({ id: "fixture-realpath-root", path: persistedDirectory });
    assert.deepEqual(
      fixture.registerWorkspace(45, persistedDirectory, { primaryId: "fixture-realpath-root", roots: [...roots] }),
      { displayName: path.basename(directory), workspaceId: "fixture-realpath-root" },
    );
    assert.equal(fixture.readDirectory(45, "fixture-realpath-root", "slow-a")?.scenario, "delayed");
    fixture.cleanup();
    assert.equal(roots.length, 0, "清理应移除使用真实路径登记的夹具根");
    assert.equal(existsSync(persistedDirectory), false);
  } finally {
    rmSync(aliasParent, { recursive: true, force: true });
    rmSync(physicalRoot, { recursive: true, force: true });
  }
});

test("主进程重新装配夹具服务时先回收带私有标记的遗留内容", () => {
  const temporaryRoot = mkdtempSync(path.join("/private/tmp", "ai-desktop-workspace-stale-test-"));
  const roots = [];
  const workspaces = {
    read: () => ({ roots: [...roots] }),
    remove: (id) => {
      const index = roots.findIndex((root) => root.id === id);
      if (index >= 0) roots.splice(index, 1);
    },
    listDirectory: () => ({ entries: [] }),
  };
  try {
    const interruptedFixture = new WorkspaceAcceptanceFixture(workspaces, temporaryRoot);
    const interruptedReservation = interruptedFixture.reserve("scenarios", 43);
    interruptedFixture.setSceneActive(true);
    const interruptedDirectory = interruptedFixture.takeDirectory(43);
    assert.ok(interruptedDirectory);
    roots.push({ id: "stale-fixture", path: interruptedDirectory });
    const unrelatedDirectory = mkdtempSync(path.join(temporaryRoot, "customer-workspace-"));
    roots.push({ id: "formal-workspace", path: unrelatedDirectory });

    const nextFixture = new WorkspaceAcceptanceFixture(workspaces, temporaryRoot);

    assert.equal(existsSync(interruptedDirectory), false, "带私有标记的遗留目录应在 Renderer 首次读取前回收");
    assert.equal(roots.some((root) => root.id === "stale-fixture"), false, "遗留夹具登记不得进入重启后的首次工作区列表");
    assert.equal(existsSync(unrelatedDirectory), true, "未标记目录不能按名称或临时根位置被删除");
    assert.equal(roots.some((root) => root.id === "formal-workspace"), true, "正式工作区登记必须保留");
    const nextReservation = nextFixture.reserve("scenarios", 44);
    assert.notEqual(nextReservation.displayName, interruptedReservation.displayName, "本轮标签必须能在页面中区分旧夹具");
    nextFixture.cleanup();
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("受控目录读取记录起始、失败和重试成功结果，但不归档临时绝对路径", () => {
  const directoryReadHandler = workspaceIpcSource.slice(
    workspaceIpcSource.indexOf('handle("desktop:list-workspace-directory"'),
    workspaceIpcSource.indexOf('handle("desktop:read-workspace-file"'),
  );
  assert.match(directoryReadHandler, /workspaceId: id/);
  assert.match(directoryReadHandler, /fixtureLabel: fixtureRead\.fixtureLabel/);
  assert.match(directoryReadHandler, /outcome: "started"/);
  assert.match(directoryReadHandler, /outcome: "succeeded"/);
  assert.match(directoryReadHandler, /outcome: "failed"/);
  assert.doesNotMatch(directoryReadHandler, /acceptanceDirectory|fixture\.directory/);
  assert.match(workspaceIpcSource, /takeDirectory\(event\.sender\.id\)/);
  assert.match(workspaceIpcSource, /isDirectorySelectionBlocked\(event\.sender\.id\)/);
  assert.match(workspaceIpcSource, /workspace\.fixture_selection_blocked/);
  assert.match(workspaceIpcSource, /registerWorkspace\(event\.sender\.id/);
  assert.match(directoryReadHandler, /readDirectory\(event\.sender\.id/);
});
