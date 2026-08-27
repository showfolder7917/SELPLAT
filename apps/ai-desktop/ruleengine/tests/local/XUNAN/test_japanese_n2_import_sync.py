"""Japanese N2 corrected dataset application-API sync tests."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
ABILITY_ROOT = (
    PROJECT_ROOT
    / "apps/ai-desktop/ruleengine/python/local/XUNAN/abilities"
)
IMPORTER_PATH = ABILITY_ROOT / "japanese_n2_red_blue_book_importer.py"
OPTION_TEMP_ROOT = PROJECT_ROOT / "OPTION/temp"


def load_importer():
    """Load the production importer and its sibling path guard."""
    sys.path.insert(0, str(ABILITY_ROOT))
    module_name = "japanese_n2_import_sync"
    spec = importlib.util.spec_from_file_location(module_name, IMPORTER_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class JapaneseN2ImportSyncTest(unittest.TestCase):
    """Keep corrected-record writes on the public Japanese CRUD contract."""

    @classmethod
    def setUpClass(cls) -> None:
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        cls.importer = load_importer()

    def test_sync_updates_existing_and_creates_missing_records(self) -> None:
        records = []
        for question_no in range(1, 731):
            records.append({
                "sourceQuestionNo": question_no,
                "questionType": "GRAMMAR",
                "questionText": "これは（　）です。",
                "optionA": "正解",
                "optionB": "誤り",
                "optionC": "別案",
                "optionD": "未定",
                "correctOption": "A",
                "explanation": "正确答案是A。",
                "audioText": "これは正解です。",
            })
        calls = []

        def fake_api_json(url, data=None):
            calls.append((url, data))
            if url.endswith("getStore.htm?pageNo=1&pageSize=1000"):
                return {"records": [{
                    "id": 100001,
                    "sourceBook": self.importer.SOURCE_BOOK,
                    "sourceQuestionNo": 1,
                }]}
            return {"success": True}

        original_api_json = self.importer.api_json
        self.importer.api_json = fake_api_json
        try:
            with tempfile.TemporaryDirectory(
                    prefix="japanese-sync-", dir=OPTION_TEMP_ROOT) as directory:
                dataset = Path(directory) / "dataset.json"
                dataset.write_text(json.dumps({
                    "aiReviewMode": "codex_ai_without_pdf",
                    "aiReviewConfidenceCounts": {"HIGH": 730, "MEDIUM": 0, "LOW": 0},
                    "records": records,
                }), encoding="utf-8")

                created, updated = self.importer.sync_records(
                    dataset, "http://127.0.0.1:8080")
        finally:
            self.importer.api_json = original_api_json

        self.assertEqual((729, 1), (created, updated))
        update_call = next(call for call in calls if call[0].endswith("update.htm"))
        self.assertEqual(100001, update_call[1]["id"])
        self.assertEqual("これは正解です。", update_call[1]["audioText"])
        self.assertEqual(729, sum(url.endswith("create.htm") for url, _data in calls))

    def test_sync_rejects_raw_ocr_dataset_before_api_call(self) -> None:
        with tempfile.TemporaryDirectory(
                prefix="japanese-sync-raw-", dir=OPTION_TEMP_ROOT) as directory:
            dataset = Path(directory) / "raw.json"
            dataset.write_text(json.dumps({"records": []}), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "must pass"):
                self.importer.sync_records(dataset, "http://127.0.0.1:8080")


if __name__ == "__main__":
    unittest.main()
