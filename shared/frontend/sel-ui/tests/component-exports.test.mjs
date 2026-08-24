import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildComponentExports, synchronizePackageManifest } from "../scripts/sync-component-exports.mjs";

const registry = JSON.parse(await readFile(new URL("../src/components/component-registry.json", import.meta.url), "utf8"));
const packageManifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("全部登记控件都有正式脚本和样式出口", () => {
  const expected = buildComponentExports(registry);
  const actual = Object.fromEntries(Object.entries(packageManifest.exports).filter(([key]) => key.startsWith("./components/")));
  assert.deepEqual(actual, expected);
});

test("新增控件登记会自动生成对应正式出口", () => {
  const nextRegistry = {
    ...registry,
    components: [...registry.components, {
      id: "selFutureControl",
      directory: "future-control",
      scripts: ["selFutureControl.js"],
      styles: ["selFutureControl.css"],
    }],
  };
  const synchronized = synchronizePackageManifest(packageManifest, nextRegistry);
  assert.equal(synchronized.exports["./components/future-control"].default, "./src/components/future-control/selFutureControl.js");
  assert.equal(synchronized.exports["./components/future-control/styles"].default, "./src/components/future-control/selFutureControl.css");
});
