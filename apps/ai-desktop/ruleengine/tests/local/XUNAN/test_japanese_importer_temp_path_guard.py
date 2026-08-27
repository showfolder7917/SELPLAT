"""Japanese PDF importer OPTION/temp path-escape regression tests."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import re
import subprocess
import sys
import unittest


PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
ACTIVE_USER_MATCHES = re.findall(
    r"(?m)^- 当前稳定用户 ID：`([^`]+)`\s*$",
    (PROJECT_ROOT / "AGENTS.md").read_text(encoding="utf-8"),
)
if len(ACTIVE_USER_MATCHES) != 1:
    raise RuntimeError("AGENTS.md 必须且只能声明一个当前稳定用户 ID。")
ACTIVE_STABLE_USER_ID = ACTIVE_USER_MATCHES[0].strip()
ABILITY_ROOT = (
    PROJECT_ROOT
    / "apps/ai-desktop/ruleengine/python/local"
    / ACTIVE_STABLE_USER_ID
    / "abilities"
)
GUARD_PATH = ABILITY_ROOT / "japanese_import_temp_path_guard.py"
IMPORTER_PATH = ABILITY_ROOT / "japanese_n2_red_blue_book_importer.py"
OPTION_TEMP_ROOT = (PROJECT_ROOT / "OPTION" / "temp").resolve()


def load_guard_module():
    """Load the real application path guard without copying production logic."""
    spec = importlib.util.spec_from_file_location("japanese_temp_path_guard_test", GUARD_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class JapaneseImporterTempPathGuardTests(unittest.TestCase):
    """Prevent Japanese importer runtime files from returning to project-root tmp."""

    def test_japanese_import_default_root_is_under_option_temp(self) -> None:
        """The stable Japanese import task root must be owned by OPTION/temp."""
        guard = load_guard_module()
        self.assertTrue(guard.JAPANESE_IMPORT_TEMP_ROOT.is_relative_to(OPTION_TEMP_ROOT))
        self.assertEqual(
            guard.JAPANESE_IMPORT_TEMP_ROOT,
            OPTION_TEMP_ROOT / "japanese" / "n2-red-blue-book-import",
        )

    def test_guard_accepts_owned_descendant_and_rejects_escape(self) -> None:
        """Accept one task descendant but reject broad root and legacy tmp paths."""
        guard = load_guard_module()
        accepted = guard.ensure_option_temp_path(
            Path("OPTION/temp/japanese/n2-red-blue-book-import/result.json"),
            "result",
        )
        self.assertEqual(
            accepted,
            OPTION_TEMP_ROOT / "japanese/n2-red-blue-book-import/result.json",
        )
        with self.assertRaises(ValueError):
            guard.ensure_option_temp_path(Path("tmp/pdfs/result.json"), "result")
        with self.assertRaises(ValueError):
            guard.ensure_option_temp_path(Path("OPTION/temp"), "result")

    def test_cli_rejects_legacy_tmp_before_reading_dataset(self) -> None:
        """A bad CLI argument must fail before it can create or consume legacy tmp data."""
        result = subprocess.run(
            [
                sys.executable,
                str(IMPORTER_PATH),
                "validate",
                "--dataset",
                "tmp/pdfs/n2-import/dataset.json",
            ],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must be inside", result.stderr)
        self.assertFalse((PROJECT_ROOT / "tmp").exists())


if __name__ == "__main__":
    unittest.main()
