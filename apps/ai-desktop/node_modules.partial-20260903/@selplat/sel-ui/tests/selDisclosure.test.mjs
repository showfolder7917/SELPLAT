import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/components/disclosure/selDisclosure.js", import.meta.url), "utf8");

test("selDisclosure 统一登记展开状态、事件和销毁生命周期", () => {
  assert.match(source, /window\.sel\.register\("components\.disclosure"/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /selDisclosure:change/);
  assert.match(source, /trigger\.removeEventListener\("click", toggle\)/);
  assert.match(source, /content\.hidden = !open/);
});
