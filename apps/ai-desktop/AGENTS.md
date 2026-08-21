# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product-specific visual contract

- Use `ai-desktop` as the canonical application directory, package, runtime client, and rule scope name; use `AI Desktop` as the product identity.
- Keep Copilot wording only where the office variant intentionally reproduces the supplied visual reference or preserves a documented compatibility launcher; do not reuse it as the engineering project identity.
- Dismiss transient settings panels when the user clicks outside or presses Escape; interactions inside the panel must not dismiss it, and the behavior must not resolve or suppress approval dialogs.
- Keep workspace roots in an independently expandable multi-panel Accordion. Register real directories through the Electron main-process folder picker, persist them in local user data, default new roots to read-only, and map only explicitly writable registered roots into the official Codex turn sandbox policy.
- Treat `OPTION/copilot/image.png`, `image1.png`, and `image3.png` as the source of truth for the desktop shell, chat states, and settings menu.
- Keep the main experience visually faithful to the supplied Microsoft 365 Copilot screenshots; do not expose Codex-specific labels in the chat chrome.
- Put locale switching, SELPLAT project selection, Codex connection details, and execution safety controls behind the lower-left settings gear.
- Support Japanese and Simplified Chinese without changing the core layout or control geometry.
- Do not present the binary publisher, signature, installer metadata, or About information as an official Microsoft product.
- Keep `启动办公版.bat` as the Windows office launcher and `启动办公版.command` as the macOS double-click office launcher; the macOS launcher must resolve the repository root from its own location and install missing desktop dependencies before starting.
