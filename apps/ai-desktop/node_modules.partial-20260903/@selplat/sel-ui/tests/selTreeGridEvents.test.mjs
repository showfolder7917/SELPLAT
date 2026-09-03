import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tree = await readFile(new URL("../src/components/tree/selTree.js", import.meta.url), "utf8");
const grid = await readFile(new URL("../src/components/grid/selGrid.js", import.meta.url), "utf8");

test("Tree 通过公共事件和控制器公开展开状态", () => {
  assert.match(tree, /new CustomEvent\("selTree:expandedChange"/);
  assert.match(tree, /expandedIds: Array\.from\(state\.expandedIds\)/);
  assert.match(tree, /getExpandedIds: \(\) => Array\.from\(state\.expandedIds\)/);
});

test("Grid 通过公共事件发布排序列和下一排序方向", () => {
  assert.match(grid, /dataSet|dataset\.selGridSortColumn/);
  assert.match(grid, /new CustomEvent\("selGrid:sortChange"/);
  assert.match(grid, /sortField: String\(selGridColumnData\.field \|\| selGridColumnId\)/);
  assert.match(grid, /sortDirection: selGridSortDirection/);
  assert.match(grid, /removeEventListener\("click", selGridHandleSortChange\)/);
});
