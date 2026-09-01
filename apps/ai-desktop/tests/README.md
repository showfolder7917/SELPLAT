# AI Desktop 测试结构

- `applications/`：Renderer 窗口、页面组合与布局契约。
- `features/`：Renderer 业务控件和前端状态。
- `services/`：Electron 业务与 support 服务，目录镜像真实生产所有者。
- `contracts/`：跨模块边界、目录结构和 SELUI 静态门禁。
- `interaction/`：真实 Electron 与 Playwright 用户流程。
- `release/`：构建、依赖、规则包、平台包、签名和启动验收。
- `support/`：公共测试路径、worker 和 fixture，不承载业务断言。

完整 Node 测试由 `node scripts/run-owned-tests.mjs` 递归发现；命名测试入口统一登记在应用 `package.json`。
