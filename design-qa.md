检测是否完成 中 日 英国际化
检测树是否完成 reference-data 中的登记
检测表格是否完成登记
检测window是否完成登记
检测其他空间是否完成登记
拆解工程中的所有按钮点击 
每个按钮功能是否完整


# Reference Data Workbench Design QA

final result: passed

## Result

Passed. No open P0, P1, or P2 visual issues remain.

## Evidence

- Visual source of truth: `/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-749726b2-add1-41f8-a14c-82f94245c0e3.png`
- Implemented page capture: `/Users/showfolder/Documents/workSpace/SELF/SELPLAT/OPTION/temp/reference-data-five-table-workbench.png`
- Focused source region: `/Users/showfolder/Documents/workSpace/SELF/SELPLAT/OPTION/temp/reference-data-source-top.png`
- Focused implementation region: `/Users/showfolder/Documents/workSpace/SELF/SELPLAT/OPTION/temp/reference-data-implementation-top.png`
- Combined focused comparison: `/Users/showfolder/Documents/workSpace/SELF/SELPLAT/OPTION/temp/reference-data-focused-comparison.jpg`
- Source pixels: 1973 × 1235
- Implementation pixels: 1974 × 1243
- Evaluated state: desktop dark theme, `ReferenceDataType` module active, all records and all statuses selected.

## Comparison

- The implemented page retains the source hierarchy, dark SEL surface, title/status/filter bands, left navigation, grid proportions, footer, spacing rhythm, borders, and emphasis levels.
- Intentional product changes are limited to the requested scope: the title identifies the workbench, the navigation exposes five database-backed modules, the range filter is available, and row operations include the requested status toggle.
- The focused top-region comparison confirms that headings, filters, navigation, table header alignment, data density, badges, and row actions remain visually coherent at the reference viewport.
- The five module states were also checked interactively. Their first-page row counts are 2, 7, 2, 4, and 20 (35 total table-header records), and every module renders its database-resolved column set.

## Iteration history

1. The first browser pass exposed closed CLOB serialization during real table loading; the three JSON extension columns were migrated to a stable `VARCHAR(10000)` representation.
2. Module switching exposed stale grid search/type/status contracts; `selGrid.setLocale()` now refreshes the runtime contract and incompatible module filters are reset.
3. The table-column dialog initially reset `visible` to false; public window select initialization now preserves both selected and default-selected state. Final verification reports `visible=true`.
4. Final browser pass found no page logs and no remaining blocking visual or interaction defects.

## Compact toolbar follow-up

- Reference: `/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-ce6b67f2-a32a-40c3-8126-a4b9d140e318.png`
- Verified viewport: 1915 × 900.
- Final toolbar columns: search 408 px, data range 320 px, status 272 px, reset 104 px.
- Final positions: the controls occupy x=34 through x=1174, with the remaining toolbar width intentionally left empty on the right.
- Browser result: no console errors and no document-level horizontal overflow.

## MDA database field COMMENT tooltip follow-up

- Visual source: `/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-e33668df-1cd8-412b-914b-0112afffdfc5.png`.
- Evaluated page: `http://127.0.0.1:8080/mda/mda.html?reload=20260811-header-comment`.
- Evaluated state: MDA control database, `MdaConnectionProfile` default table query, pointer over the `id` table header.
- All 16 real database fields received their own JDBC `COMMENT` through the standard `selGrid` tooltip input.
- The visible tooltip reads `连接配置主键，由公共号段生成`; it uses the existing shared dark crystal tooltip surface and does not alter header height, column widths, or scrolling.
- A separate `SELECT 1 AS ready` result verified that a column without a matching database COMMENT receives neither tooltip content nor always-display mode.
- Browser result: no warning/error logs, no document-level horizontal overflow, and no open P0/P1/P2 visual issues.

## MDA Select From Where context-menu follow-up

- Visual source: `/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-d89bf190-dbb7-45dc-ab21-c3288f8cfecb.png`.
- Evaluated page: `http://127.0.0.1:8080/mda/mda.html?reload=20260811-select-from-where-1`.
- Evaluated state: MDA control database, `MdaConnectionProfile` result grid, context menu opened on the `connectionName` value `MDA 控制库`.
- The one-row `Select From Where` menu reuses the shared dark crystal context-menu surface, stays anchored to the clicked value, and preserves the result grid geometry.
- The editor received four verified predicates: quoted Chinese text, unquoted numeric ID, unquoted boolean, and `IS NULL`; each generated query occupies exactly two lines and is separated from the previous statement by a semicolon and blank line.
- Escape close, reopen at a new cell, and outside-click close all passed; the public editor retained focus after append.
- Browser result: no warning/error logs, no document-level horizontal overflow, and no open P0/P1/P2 visual issues.

## MDA execute-selected-SQL follow-up

- Visual source: `/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-7f05a9b9-fdfa-42b4-8d0b-f0e14f937c1b.png`.
- Evaluated page: `http://127.0.0.1:8080/mda/mda.html?reload=20260811-execute-selected-sql-1`.
- Evaluated state: MDA control database, `MdaConnectionProfile` query tab, SQL text visibly selected before execution.
- The selected query `SELECT * FROM MdaConnectionProfile WHERE id = 10003` executed from the existing button and returned exactly the matching row.
- With an empty selection, `Command + Enter` executed the complete editor value `SELECT * FROM MdaConnectionProfile WHERE id = 100000` and returned the second matching row.
- The existing editor geometry, toolbar, line number, result grid and shared dark theme remain unchanged; the browser console contains no errors and no P0/P1/P2 visual issue was introduced.

## MDA selected-SQL focus-loss regression

- Regression source: `/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-78e79cb8-a86c-4ea7-8d8c-0400129cb485.png`.
- Exact editor fixture: two queries for `ReferenceDataTableColumn`, with only the second two-line `WHERE viewCode = 'type-management'` query selected.
- The toolbar `mousedown` now keeps focus in the shared editor and snapshots the selected text before the button action can collapse it.
- The action event was verified to carry only the second query; after an artificial focus/selection collapse, `restoreSelection()` returned focus and the exact original start/end range.
- The live 8080 host dev-runtime now serves the new `selectedValue`, `mousedown`, and `restoreSelection` contracts with cache-busted MDA resources.
- The fix changes no editor or result-grid geometry, color, spacing, or typography; no new visual issue was introduced.
- Selection is now mandatory: executing with no nonblank selection shows `请先选中需要执行的 SQL。` and sends no SQL request, preventing hidden execution of additional statements.

## MDA multi-field WHERE follow-up

- Visual source: `/var/folders/mm/bdkr2fj53rl88019r0hfw_y40000gn/T/codex-clipboard-42a7f67f-bf11-42bc-a5d7-1505235d0f7e.png`.
- Every result column that maps to a real database field now shows a compact native checkbox before its existing header label; computed or aliased columns remain non-selectable.
- The checkbox and label share the existing column width, preserve COMMENT tooltips and column resize handles, and do not change table height or horizontal-scroll calculation.
- Automated DOM regression selected `databaseType` and `connectionName` and verified the public grid API returned both stable column keys in header order.
- MDA consumes only that public selection snapshot and builds predicates from the right-clicked row as `WHERE databaseType = 'H2'` followed by `AND connectionName = 'MDA 控制库'`.
- With no checked header field, `Select From Where` retains the existing single clicked-cell behavior.

# AI Desktop Developer Sidebar Unified QA

final result: passed

## Evidence

- Narrow viewport: `/Users/showfolder/Documents/workSpace/SELF/SELPLAT/apps/ai-desktop/temp/interaction/unified/narrow.png`
- Regular viewport: `/Users/showfolder/Documents/workSpace/SELF/SELPLAT/apps/ai-desktop/temp/interaction/unified/regular.png`
- Tasks expanded: `/Users/showfolder/Documents/workSpace/SELF/SELPLAT/apps/ai-desktop/temp/interaction/unified/tasks-expanded.png`
- Tasks collapsed: `/Users/showfolder/Documents/workSpace/SELF/SELPLAT/apps/ai-desktop/temp/interaction/unified/tasks-collapsed.png`

## Result

- The real Electron renderer passed resource-explorer, workspace, and tasks disclosure interactions using semantic Playwright locators.
- Explorer width and workspace/tasks height respond to keyboard adjustment; Home restores defaults.
- The workspace/tasks boundary keeps a 5 px hit target while drawing one 1 px line, with no duplicate border.
- The 900×700 and 1280×900 views have no horizontal workspace overflow, content overlap, or open P0/P1/P2 visual issue.
- The formally built developer app was restarted once and the official Codex app-server remains connected.
