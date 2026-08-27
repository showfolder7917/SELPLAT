#!/usr/bin/env python3
"""Enforce SELPLAT's single OPTION/temp root for Japanese importer runtime data."""

from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = next(
    candidate
    for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
OPTION_TEMP_ROOT = (PROJECT_ROOT / "OPTION" / "temp").resolve()
JAPANESE_IMPORT_TEMP_ROOT = (
    OPTION_TEMP_ROOT / "japanese" / "n2-red-blue-book-import"
)


def ensure_option_temp_path(
        path: Path, label: str, *, must_exist: bool = False) -> Path:
    """Resolve one runtime path and reject the OPTION/temp root or any path outside it."""
    candidate = path if path.is_absolute() else PROJECT_ROOT / path
    resolved = candidate.resolve(strict=False)
    if resolved == OPTION_TEMP_ROOT or not resolved.is_relative_to(OPTION_TEMP_ROOT):
        raise ValueError(
            f"{label} must be inside {OPTION_TEMP_ROOT}; received {resolved}")
    if must_exist and not resolved.exists():
        raise FileNotFoundError(f"{label} does not exist: {resolved}")
    return resolved
