import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const launcher = readFileSync(new URL("../scripts/start-variant.bat", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

test("开发启动器使用 Vite 热更新并在主进程编译后自动重启 Electron", () => {
  const command = manifest.scripts["desktop:dev:developer"];
  assert.match(command, /VITE_APP_VARIANT=developer vite/);
  assert.match(command, /tsconfig\.electron\.json --watch/);
  assert.match(command, /VITE_DEV_SERVER_URL=http:\/\/127\.0\.0\.1:5173 electronmon \./);
  assert.equal(manifest.devDependencies.electronmon, "^2.0.4");
  assert.match(launcher, /if \/i "%DESKTOP_VARIANT%"=="developer"/);
  assert.match(launcher, /npm run desktop:dev:developer/);
  assert.match(readme, /React、CSS 和渲染逻辑保存后立即更新/);
  assert.match(readme, /主进程、preload 或共享契约编译后由 `electronmon` 自动重启/);
});
