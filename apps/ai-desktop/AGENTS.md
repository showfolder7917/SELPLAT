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
- Keep the developer shell typography at desktop-IDE readability: primary navigation, workspace tree, controls, chat content, and context values should normally render at 13–15 CSS px with matching row height; do not use 10–11px for critical readable content.
- Keep screenshot originals, annotations, metadata, and other disposable runtime files under `apps/ai-desktop/temp`; expose both “open temp directory” and confirmed “clear all temp files” controls, and send screenshots to the official harness only as main-process-resolved `localImage` attachments.
- Preserve the screen exactly as it looked when the screenshot button was clicked, then show only the screenshot selector and annotation layer in temporary full screen; completing or cancelling must restore the AI Desktop editor window to its original bounds and state.
- Keep the developer chat history in a height-constrained independent scroll region with a visible vertical scrollbar; the composer stays fixed, and newly appended messages scroll into view without preventing the user from reviewing earlier content.
- Render Codex work from official app-server notifications as a real stream: append `item/agentMessage/delta`, show readable reasoning summaries, plans, command/file/tool lifecycle and changed-file updates, then reconcile with authoritative completed items. Keep the verbose execution-process list collapsed by default with a visible current-step summary. Never manufacture progress or expose raw reasoning text.
- Treat `OPTION/copilot/image.png`, `image1.png`, and `image3.png` as the source of truth for the desktop shell, chat states, and settings menu.
- Keep the main experience visually faithful to the supplied Microsoft 365 Copilot screenshots; do not expose Codex-specific labels in the chat chrome.
- Put locale switching, SELPLAT project selection, Codex connection details, and execution safety controls behind the lower-left settings gear.
- Support Japanese and Simplified Chinese without changing the core layout or control geometry.
- Do not present the binary publisher, signature, installer metadata, or About information as an official Microsoft product.
- Keep `启动办公版.bat` as the Windows office launcher and `启动办公版.command` as the macOS double-click office launcher; the macOS launcher must resolve the repository root from its own location and install missing desktop dependencies before starting.
