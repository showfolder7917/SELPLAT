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
  const view = source("src/features/settings/components/DeveloperSettingsView.tsx");

  assert.match(
    viewModel,
    /settings\.corpusStatusFocus === "semantic-backfill"/u,
  );
  assert.match(
    viewModel,
    /settings\.corpusStatusFocus === "semantic-backfill"\s*\?\s*settings\.corpusSemanticBackfill\?\.message \|\| settings\.corpusIngestion\?\.message \|\| ""\s*:\s*settings\.corpusIngestion\?\.message \|\| settings\.corpusSemanticBackfill\?\.message \|\| ""/u,
  );
  assert.match(settings, /setCorpusStatusFocus\("semantic-backfill"\)/u);
  assert.match(settings, /setCorpusStatusFocus\("ingestion"\)/u);
  assert.match(settings, /if \(!settingsOpen\) return;[\s\S]*getCorpusIngestionStatus\(\)\.then\(setCorpusIngestion\)/u);
  assert.doesNotMatch(settings, /corpusSemanticBackfill\?\.state !== "running" && corpusIngestion\?\.state !== "running"/u);
  assert.match(viewModel, /ingestionStatusMessage: settings\.corpusIngestion\?\.message/u);
  assert.match(view, /corpus\.ingestionStatusMessage && <small>\{corpus\.ingestionStatusMessage\}<\/small>/u);
});
