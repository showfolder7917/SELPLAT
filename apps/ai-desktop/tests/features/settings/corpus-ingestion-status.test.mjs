import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function source(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

test("自动入库状态默认优先，当前补齐操作可回显完成结果并在设置打开期间持续刷新", () => {
  const viewModel = source("src/features/settings/model/createDeveloperSettingsViewModel.ts");
  const settings = source("src/features/settings/model/useDesktopSettings.ts");

  assert.match(
    viewModel,
    /settings\.corpusStatusFocus === "semantic-backfill"/u,
  );
  assert.match(
    viewModel,
    /statusMessage: settings\.corpusSemanticBackfill\?\.message \|\| settings\.corpusIngestion\?\.message/u,
  );
  assert.match(settings, /setCorpusStatusFocus\("semantic-backfill"\)/u);
  assert.match(settings, /setCorpusStatusFocus\("ingestion"\)/u);
  assert.match(settings, /if \(!settingsOpen\) return;[\s\S]*getCorpusIngestionStatus\(\)\.then\(setCorpusIngestion\)/u);
  assert.doesNotMatch(settings, /corpusSemanticBackfill\?\.state !== "running" && corpusIngestion\?\.state !== "running"/u);
});
