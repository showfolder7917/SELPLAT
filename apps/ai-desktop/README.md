# AI Desktop

AI Desktop 是 Electron、React 与 TypeScript 构建的 Developer 桌面应用。应用通过安全 IPC 对接官方 `@openai/codex` app-server Harness，不启动自建 HTTP/HTTPS 服务。

## 目录

- `src/variants/developer`：Developer 界面与应用样式。
- `contracts`：AI Desktop 主进程、preload 与渲染进程共用的应用私有 IPC 协议；跨工程共通才进入 SELPLAT 根 `shared`。
- `electron/services`：Codex Harness、ChatGPT OAuth、设置、日志、截图及协同服务。
- `electron/services/collaboration/nangong-evolution-*`：南宫婉只读对话转专项课题、双来源版本化提案、韩立独立审批、恢复点及审批后协同分发。
- `electron/ipc`：IPC 白名单、参数校验与服务编排。
- `electron/config`：应用和工程路径解析。
- `electron/window`：安全 BrowserWindow 配置。

渲染进程不直接导入或调用 Codex SDK。

## VS Code 依赖链接

首次检出工程或 `package-lock.json` 变化后，在当前平台准备锁文件缓存并建立本机开发链接：

```powershell
npm run dependencies:link
```

Windows 创建 Junction，macOS 与 Linux 创建目录符号链接。链接目标始终由当前锁文件哈希解析到工程根 `cache/ai-desktop/dependencies/`，应用根的 `node_modules` 只属于本机开发环境，不提交 Git。需要清理本机开发链接时执行：

```powershell
npm run dependencies:unlink
```

## Windows 启动

日常开发双击 `启动开发版.bat`。该入口检查锁文件专属依赖缓存、正式编译 Developer 桌面运行时，并由 Electron 直接加载本地构建页面；不启动 Vite HTTP 服务，也不占用开发端口。

正式编译后启动：

```powershell
npm run start:developer
```

首次打开后，可从左下角设置进入 ChatGPT 登录。账号认证由 Codex Harness 在系统浏览器中完成，应用不读取账号密码。

## macOS 启动

双击 `启动开发版.command`。该入口使用重新构建的 Developer 运行时，并保持已注册应用身份稳定。

## 构建与打包

编译 Developer：

```powershell
npm run build:developer
```

Windows 安装包：

```powershell
npm run dist:win:developer
```

Windows 免安装 ZIP：

```powershell
npm run dist:zip:developer
```

macOS 安装包：

```bash
npm run dist:mac:developer
```

产物统一进入工程根 `build/ai-desktop/package/developer`。Developer 安装包在构建时写入已验证的 SELPLAT 工程根，运行时可使用 `--selplat-root` 或 `SELPLAT_ROOT` 覆盖；免安装 ZIP 把日志、缓存和临时材料写入压缩包旁的独立数据根。

检查安装包中的工程根元数据：

```powershell
npm run verify:developer-package-root
```
