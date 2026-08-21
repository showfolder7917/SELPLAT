# AI Desktop / AI 桌面应用

AI Desktop 是 Electron + React + TypeScript 双版本桌面应用。办公版保持 Copilot 风格，开发版面向个人工程开发；二者通过安全 IPC 对接官方 [openai/codex](https://github.com/openai/codex) `app-server` harness，不启动应用自建的 HTTP/HTTPS 服务。

## 目录 / Structure

- `src/variants/office`：办公版界面与样式。
- `src/variants/developer`：开发版界面与样式。
- `shared/contracts`：渲染进程和 Electron 共用的 IPC 类型。
- `electron/services`：官方 Codex app-server JSONL harness、ChatGPT OAuth、审批会话与设置存储。
- `electron/ipc`：IPC 白名单、参数校验和服务编排。
- `electron/config`：版本和工程路径解析。
- `electron/window`：安全 BrowserWindow 配置。

渲染进程不直接导入或调用 Codex SDK。

## 启动 / Start

Windows 办公版：双击 `启动办公版.bat`，或执行：

```powershell
npm run start:office
```

开发版：双击 `启动开发版.bat`，或执行：

```powershell
npm run start:developer
```

首次打开开发版后，从左下角设置进入“ChatGPT 账号”，选择“使用 ChatGPT 登录”。登录页由 Codex harness 在系统浏览器中打开，令牌由 Codex 自己保存和刷新；桌面渲染进程不会读取账号密码或令牌。工作区写入和命令执行按官方审批协议显示确认界面。

原来的 `启动本地Copilot.bat` 保留为办公版兼容入口。

macOS 办公版：双击 `启动办公版.command`。首次启动会自动安装缺少的依赖，也可以在终端执行：

```bash
./启动办公版.command
```

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
