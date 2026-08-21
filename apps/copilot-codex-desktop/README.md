# Copilot Local Desktop / 本地 Copilot 桌面应用

Electron + React + TypeScript 双版本桌面应用。办公版保持 Copilot 风格，开发版面向个人工程开发；二者通过安全 IPC 共用本机 Codex SDK，不启动 HTTP/HTTPS 服务。

## 目录 / Structure

- `src/variants/office`：办公版界面与样式。
- `src/variants/developer`：开发版界面与样式。
- `shared/contracts`：渲染进程和 Electron 共用的 IPC 类型。
- `electron/services`：Codex 会话与设置存储。
- `electron/ipc`：IPC 白名单、参数校验和服务编排。
- `electron/config`：版本和工程路径解析。
- `electron/window`：安全 BrowserWindow 配置。

渲染进程不直接导入或调用 Codex SDK。

## 启动 / Start

办公版：双击 `启动办公版.bat`，或执行：

```powershell
npm run start:office
```

开发版：双击 `启动开发版.bat`，或执行：

```powershell
npm run start:developer
```

原来的 `启动本地Copilot.bat` 保留为办公版兼容入口。

## 打包 / Package

```powershell
npm run dist:win:office
npm run dist:win:developer
```

Windows 产物分别进入 `release/office` 和 `release/developer`。

macOS 应在 macOS 机器上构建并签名：

```bash
npm run dist:mac:office
npm run dist:mac:developer
```
