import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const store = readFileSync(new URL("../../../../../electron/services/support/platform/settings/internal/settings.store.ts", import.meta.url), "utf8");
const resource = readFileSync(new URL("../../../../../contracts/foundation/i18n/fixed-ui-text.ts", import.meta.url), "utf8");

test("设置读取区分默认值和恢复失败，失败后不会用默认配置覆盖已有文件", () => {
  assert.match(store, /readForRenderer\(\): DesktopSettingsReadOutDto/);
  assert.match(store, /source: "default"/);
  assert.match(store, /source: "recovered"/);
  assert.match(store, /if \(existsSync\(this\.#filePath\)\) this\.#readStored\(\)/);
  assert.match(store, /patch\.locale === "ja" \|\| patch\.locale === "zh-CN" \|\| patch\.locale === "en"/);
});

test("固定界面资源提供三语、中文回退和受控缺键诊断", () => {
  assert.match(resource, /"zh-CN"/);
  assert.match(resource, /\bja:/);
  assert.match(resource, /\ben:/);
  assert.match(resource, /FIXED_UI_TEXT\["zh-CN"\]\[key\]/);
  assert.match(resource, /missingText/);
});
