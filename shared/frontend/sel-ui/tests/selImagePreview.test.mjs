import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/components/image-preview/selImagePreview.js", import.meta.url);
const styleUrl = new URL("../src/components/image-preview/selImagePreview.css", import.meta.url);
const registryUrl = new URL("../src/components/component-registry.json", import.meta.url);

test("图片预览登记为依赖通用对话框的正式 SELUI 控件", async () => {
  const registry = JSON.parse(await readFile(registryUrl, "utf8"));
  const component = registry.components.find((item) => item.id === "selImagePreview");
  assert.deepEqual(component, {
    id: "selImagePreview",
    directory: "image-preview",
    type: "interactive",
    scripts: ["selImagePreview.js"],
    styles: ["selImagePreview.css"],
    publicApi: "sel.components.imagePreview",
    dependencies: ["selDialog"],
    themeAware: true,
  });
});

test("图片预览只在真实溢出后启用抓手，并通过指针捕获限制拖动边界", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const style = await readFile(styleUrl, "utf8");
  assert.match(source, /maximumOffsetX/);
  assert.match(source, /maximumOffsetY/);
  assert.match(source, /state\.offsetX = clamp/);
  assert.match(source, /state\.offsetY = clamp/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /releasePointerCapture/);
  assert.match(source, /state\.viewport\.dataset\.pannable = String\(pannable\)/);
  assert.match(style, /data-pannable="true"\] \{ cursor: grab/);
  assert.match(style, /data-dragging="true"\] \{ cursor: grabbing/);
});
