"""页面真实视觉测试能力。

功能：
使用 Playwright 打开真实页面，按指定视口截图、滚动、统计选择器数量并检查文本。

作用：
为网页测试、页面布局验证和截图留痕提供统一本地执行入口。

适用场景：
- 前端页面改动后需要真实浏览器截图验证布局
- 检查元素遮挡、重叠、首屏、滚动区域或响应式表现
- 需要把截图路径、DOM 计数和文本检查结果写入执行文档或记账
"""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from typing import Any, Callable


ABILITY_ID = "page_visual_tester"
ABILITY_NAME = "页面真实视觉测试"
ABILITY_DESC = "使用 Python/Playwright 打开真实页面并输出截图、布局检查和 JSON 结果。"

REQUIRED_SKILLS: list[str] = []
REQUIRED_APPS: list[str] = []

CODE_ROOT = Path(__file__).resolve().parents[1]
# 从页面测试能力所在位置反推项目根目录，使测试证据不再依赖废弃的外部记忆目录。
WORKSPACE_ROOT = CODE_ROOT.parents[2]
# 将页面截图和结果 JSON 统一落入项目内 OPTION 临时目录，便于本地复核和清理。
DEFAULT_OUTPUT_ROOT = WORKSPACE_ROOT / "OPTION" / "temp" / "page_visual_tests"


class PageVisualTestError(RuntimeError):
    """页面视觉测试失败。"""


def _now_id() -> str:
    return datetime.now().astimezone().strftime("%Y%m%d%H%M%S")


def _slugify(value: str) -> str:
    slug = re.sub(r"[^0-9A-Za-z._-]+", "-", value.strip())[:80].strip("-")
    return slug or "page"


def _as_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _normalize_selector_checks(value: Any) -> list[dict[str, Any]]:
    checks: list[dict[str, Any]] = []
    for item in _as_list(value):
        if isinstance(item, str) and item.strip():
            checks.append({"name": item.strip(), "selector": item.strip()})
        elif isinstance(item, dict) and str(item.get("selector") or "").strip():
            checks.append(
                {
                    "name": str(item.get("name") or item.get("selector")).strip(),
                    "selector": str(item.get("selector")).strip(),
                    "expected_count": item.get("expected_count"),
                    "min_count": item.get("min_count"),
                    "max_count": item.get("max_count"),
                }
            )
    return checks


def _normalize_text_checks(value: Any) -> list[dict[str, str]]:
    checks: list[dict[str, str]] = []
    for item in _as_list(value):
        if isinstance(item, str) and item.strip():
            checks.append({"name": item.strip(), "text": item.strip(), "selector": "body"})
        elif isinstance(item, dict) and str(item.get("text") or "").strip():
            checks.append(
                {
                    "name": str(item.get("name") or item.get("text")).strip(),
                    "text": str(item.get("text")).strip(),
                    "selector": str(item.get("selector") or "body").strip(),
                }
            )
    return checks


def _normalize_scrolls(value: Any) -> list[dict[str, Any]]:
    scrolls: list[dict[str, Any]] = []
    for index, item in enumerate(_as_list(value)):
        if isinstance(item, (int, float, str)):
            y = _as_int(item, 0)
            scrolls.append({"name": f"scroll-{index + 1}-{y}", "selector": "", "y": y})
        elif isinstance(item, dict):
            y = _as_int(item.get("y") or item.get("scroll_y"), 0)
            name = str(item.get("name") or f"scroll-{index + 1}-{y}").strip()
            scrolls.append(
                {
                    "name": _slugify(name),
                    "selector": str(item.get("selector") or "").strip(),
                    "y": y,
                }
            )
    return scrolls


def _build_config(context: dict[str, Any]) -> dict[str, Any]:
    url = str(context.get("url") or "").strip()
    if not url:
        raise PageVisualTestError("缺少 url。")
    viewport_width = _as_int(context.get("viewport_width") or context.get("width"), 1600)
    viewport_height = _as_int(context.get("viewport_height") or context.get("height"), 900)
    wait_ms = _as_int(context.get("wait_ms"), 1000)
    timeout_ms = _as_int(context.get("timeout_ms"), 30000)
    channel = str(context.get("browser_channel") or "chrome").strip()
    output_dir = str(context.get("output_dir") or "").strip()
    if not output_dir:
        output_dir = str(DEFAULT_OUTPUT_ROOT / f"{_now_id()}-{_slugify(url)}")
    return {
        "url": url,
        "viewport_width": viewport_width,
        "viewport_height": viewport_height,
        "wait_ms": wait_ms,
        "timeout_ms": timeout_ms,
        "browser_channel": channel,
        "output_dir": output_dir,
        "initial_screenshot": bool(context.get("initial_screenshot", True)),
        "full_page": bool(context.get("full_page", False)),
        "scrolls": _normalize_scrolls(context.get("scrolls") or context.get("scroll_steps")),
        "selector_checks": _normalize_selector_checks(
            context.get("selector_checks") or context.get("counts") or context.get("count_selectors")
        ),
        "text_checks": _normalize_text_checks(context.get("text_checks") or context.get("must_contain")),
    }


def _check_selector_count(check: dict[str, Any], count: int) -> bool:
    expected = check.get("expected_count")
    if expected is not None and count != _as_int(expected, -1):
        return False
    min_count = check.get("min_count")
    if min_count is not None and count < _as_int(min_count, 0):
        return False
    max_count = check.get("max_count")
    if max_count is not None and count > _as_int(max_count, count):
        return False
    return True


def _run_with_python_playwright(config: dict[str, Any]) -> dict[str, Any]:
    try:
        from playwright.sync_api import sync_playwright
    except ModuleNotFoundError as error:
        raise PageVisualTestError("Python playwright 包不可用。") from error

    output_dir = Path(config["output_dir"]).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    screenshots: list[str] = []
    selector_results: list[dict[str, Any]] = []
    text_results: list[dict[str, Any]] = []

    with sync_playwright() as playwright:
        launch_options: dict[str, Any] = {"headless": True}
        if config["browser_channel"]:
            launch_options["channel"] = config["browser_channel"]
        browser = playwright.chromium.launch(**launch_options)
        page = browser.new_page(
            viewport={
                "width": config["viewport_width"],
                "height": config["viewport_height"],
            }
        )
        page.goto(config["url"], wait_until="networkidle", timeout=config["timeout_ms"])
        if config["wait_ms"] > 0:
            page.wait_for_timeout(config["wait_ms"])

        def screenshot(name: str) -> str:
            path = output_dir / f"{_slugify(name)}.png"
            page.screenshot(path=str(path), full_page=config["full_page"])
            screenshots.append(str(path))
            return str(path)

        if config["initial_screenshot"]:
            screenshot("initial")
        for scroll in config["scrolls"]:
            selector = scroll.get("selector") or ""
            y = _as_int(scroll.get("y"), 0)
            if selector:
                page.locator(selector).evaluate("(el, y) => { el.scrollTop = y; }", y)
            else:
                page.evaluate("(y) => { document.scrollingElement.scrollTop = y; }", y)
            if config["wait_ms"] > 0:
                page.wait_for_timeout(config["wait_ms"])
            screenshot(scroll.get("name") or f"scroll-{y}")

        for check in config["selector_checks"]:
            count = page.locator(check["selector"]).count()
            selector_results.append(
                {
                    "name": check["name"],
                    "selector": check["selector"],
                    "count": count,
                    "passed": _check_selector_count(check, count),
                }
            )

        for check in config["text_checks"]:
            text = page.locator(check["selector"]).inner_text(timeout=config["timeout_ms"])
            text_results.append(
                {
                    "name": check["name"],
                    "selector": check["selector"],
                    "text": check["text"],
                    "passed": check["text"] in text,
                }
            )
        browser.close()

    passed = all(item["passed"] for item in selector_results + text_results)
    return {
        "status": "completed" if passed else "failed",
        "runner": "python_playwright",
        "url": config["url"],
        "viewport": {"width": config["viewport_width"], "height": config["viewport_height"]},
        "output_dir": str(output_dir),
        "screenshots": screenshots,
        "selector_results": selector_results,
        "text_results": text_results,
    }


def _find_npx_playwright_node_modules() -> Path | None:
    npm_home = Path.home() / ".npm" / "_npx"
    if not npm_home.exists():
        return None
    candidates = sorted(
        npm_home.glob("*/node_modules/playwright/index.js"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        return None
    return candidates[0].parents[1]


def _ensure_npx_playwright_available() -> Path:
    node_modules = _find_npx_playwright_node_modules()
    if node_modules is not None:
        return node_modules
    subprocess.run(
        ["npx", "--yes", "playwright", "--version"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    node_modules = _find_npx_playwright_node_modules()
    if node_modules is None:
        raise PageVisualTestError("无法定位 npx Playwright 运行目录。")
    return node_modules


def _run_with_npx_playwright_bridge(config: dict[str, Any]) -> dict[str, Any]:
    output_dir = Path(config["output_dir"]).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    node_modules = _ensure_npx_playwright_available()
    script = r"""
const { chromium } = require('playwright');
const fs = require('node:fs');
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

function slugify(value) {
  return String(value || 'screenshot').replace(/[^0-9A-Za-z._-]+/g, '-').slice(0, 80).replace(/^-+|-+$/g, '') || 'screenshot';
}

function checkCount(check, count) {
  if (check.expected_count !== null && check.expected_count !== undefined && count !== Number(check.expected_count)) return false;
  if (check.min_count !== null && check.min_count !== undefined && count < Number(check.min_count)) return false;
  if (check.max_count !== null && check.max_count !== undefined && count > Number(check.max_count)) return false;
  return true;
}

(async () => {
  const screenshots = [];
  const selectorResults = [];
  const textResults = [];
  const launchOptions = { headless: true };
  if (cfg.browser_channel) launchOptions.channel = cfg.browser_channel;
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({
    viewport: { width: cfg.viewport_width, height: cfg.viewport_height },
    deviceScaleFactor: 1
  });
  await page.goto(cfg.url, { waitUntil: 'networkidle', timeout: cfg.timeout_ms });
  if (cfg.wait_ms > 0) await page.waitForTimeout(cfg.wait_ms);

  async function screenshot(name) {
    const path = `${cfg.output_dir}/${slugify(name)}.png`;
    await page.screenshot({ path, fullPage: Boolean(cfg.full_page) });
    screenshots.push(path);
  }

  if (cfg.initial_screenshot) await screenshot('initial');
  for (const scroll of cfg.scrolls || []) {
    const y = Number(scroll.y || 0);
    if (scroll.selector) {
      await page.locator(scroll.selector).evaluate((el, nextY) => { el.scrollTop = nextY; }, y);
    } else {
      await page.evaluate((nextY) => { document.scrollingElement.scrollTop = nextY; }, y);
    }
    if (cfg.wait_ms > 0) await page.waitForTimeout(cfg.wait_ms);
    await screenshot(scroll.name || `scroll-${y}`);
  }

  for (const check of cfg.selector_checks || []) {
    const count = await page.locator(check.selector).count();
    selectorResults.push({
      name: check.name,
      selector: check.selector,
      count,
      passed: checkCount(check, count)
    });
  }

  for (const check of cfg.text_checks || []) {
    const text = await page.locator(check.selector).innerText({ timeout: cfg.timeout_ms });
    textResults.push({
      name: check.name,
      selector: check.selector,
      text: check.text,
      passed: text.includes(check.text)
    });
  }

  await browser.close();
  const passed = [...selectorResults, ...textResults].every((item) => item.passed);
  console.log(JSON.stringify({
    status: passed ? 'completed' : 'failed',
    runner: 'npx_playwright_bridge',
    url: cfg.url,
    viewport: { width: cfg.viewport_width, height: cfg.viewport_height },
    output_dir: cfg.output_dir,
    screenshots,
    selector_results: selectorResults,
    text_results: textResults
  }));
})().catch((error) => {
  console.log(JSON.stringify({
    status: 'failed',
    runner: 'npx_playwright_bridge',
    error: String(error && error.stack || error)
  }));
  process.exitCode = 1;
});
"""
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        config_path = temp_path / "config.json"
        script_path = temp_path / "page_visual_tester_bridge.js"
        normalized_config = dict(config)
        normalized_config["output_dir"] = str(output_dir)
        config_path.write_text(json.dumps(normalized_config, ensure_ascii=False), encoding="utf-8")
        script_path.write_text(script, encoding="utf-8")
        env = dict(os.environ)
        env["NODE_PATH"] = str(node_modules)
        completed = subprocess.run(
            ["node", str(script_path), str(config_path)],
            cwd=str(Path.cwd()),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    stdout = completed.stdout.strip()
    if not stdout:
        raise PageVisualTestError(completed.stderr.strip() or "npx Playwright 桥接执行无输出。")
    result = json.loads(stdout.splitlines()[-1])
    if completed.returncode != 0 and result.get("status") != "failed":
        result["status"] = "failed"
    if completed.stderr.strip():
        result["stderr"] = completed.stderr.strip()
    return result


def run_page_visual_test(
    context: dict[str, Any],
    *,
    runner: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    config = _build_config(context)
    if runner is not None:
        result = runner(config)
    else:
        try:
            result = _run_with_python_playwright(config)
        except PageVisualTestError as python_error:
            result = _run_with_npx_playwright_bridge(config)
            result["python_playwright_fallback_reason"] = str(python_error)
    result.setdefault("ability", ABILITY_ID)
    result.setdefault("output_dir", config["output_dir"])
    result["config"] = {
        "url": config["url"],
        "viewport_width": config["viewport_width"],
        "viewport_height": config["viewport_height"],
        "wait_ms": config["wait_ms"],
        "browser_channel": config["browser_channel"],
        "scrolls": config["scrolls"],
        "selector_checks": config["selector_checks"],
        "text_checks": config["text_checks"],
    }
    output_dir = Path(str(result.get("output_dir") or config["output_dir"])).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    result_path = output_dir / "result.json"
    result["result_path"] = str(result_path)
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def execute(context: dict, skills: dict, apps: dict) -> dict:
    _ = skills, apps
    try:
        return run_page_visual_test(context, runner=context.get("_runner"))
    except Exception as error:
        return {
            "status": "failed",
            "ability": ABILITY_ID,
            "message": str(error),
        }


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=ABILITY_DESC)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output-dir", default="")
    parser.add_argument("--viewport", default="1600x900", help="格式：WIDTHxHEIGHT")
    parser.add_argument("--wait-ms", type=int, default=1000)
    parser.add_argument("--timeout-ms", type=int, default=30000)
    parser.add_argument("--browser-channel", default="chrome")
    parser.add_argument("--scroll", action="append", default=[], help="滚动位置，格式：Y 或 selector:Y")
    parser.add_argument("--count", action="append", default=[], help="选择器计数，格式：selector 或 name=selector:min:max")
    parser.add_argument("--must-contain", action="append", default=[], help="文本检查，格式：text 或 selector=text")
    parser.add_argument("--full-page", action="store_true")
    return parser.parse_args(argv)


def _parse_viewport(value: str) -> tuple[int, int]:
    match = re.match(r"^(\d+)[x,](\d+)$", value.strip())
    if not match:
        raise PageVisualTestError("viewport 格式必须是 WIDTHxHEIGHT。")
    return int(match.group(1)), int(match.group(2))


def _parse_scroll_arg(value: str) -> dict[str, Any]:
    if ":" in value and not value.strip().isdigit():
        selector, raw_y = value.rsplit(":", 1)
        return {"selector": selector.strip(), "y": _as_int(raw_y, 0), "name": f"{_slugify(selector)}-{raw_y}"}
    return {"y": _as_int(value, 0)}


def _parse_count_arg(value: str) -> dict[str, Any]:
    name = value
    selector_and_bounds = value
    if "=" in value:
        name, selector_and_bounds = value.split("=", 1)
    parts = selector_and_bounds.split(":")
    check: dict[str, Any] = {"name": name.strip(), "selector": parts[0].strip()}
    if len(parts) > 1 and parts[1] != "":
        check["min_count"] = _as_int(parts[1], 0)
    if len(parts) > 2 and parts[2] != "":
        check["max_count"] = _as_int(parts[2], 0)
    return check


def _parse_text_arg(value: str) -> dict[str, str]:
    if "=" in value:
        selector, text = value.split("=", 1)
        return {"selector": selector.strip(), "text": text.strip(), "name": text.strip()}
    return {"selector": "body", "text": value.strip(), "name": value.strip()}


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv or sys.argv[1:])
    width, height = _parse_viewport(args.viewport)
    result = execute(
        {
            "url": args.url,
            "output_dir": args.output_dir,
            "viewport_width": width,
            "viewport_height": height,
            "wait_ms": args.wait_ms,
            "timeout_ms": args.timeout_ms,
            "browser_channel": args.browser_channel,
            "scrolls": [_parse_scroll_arg(item) for item in args.scroll],
            "selector_checks": [_parse_count_arg(item) for item in args.count],
            "text_checks": [_parse_text_arg(item) for item in args.must_contain],
            "full_page": args.full_page,
        },
        {},
        {},
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("status") == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
