# SELPLAT

`SELPLAT` 是多业务应用统一装配与运行的平台工程。

Host 作为统一 JVM 和 HTTP 入口，通过 Gradle 工程登记与显式依赖装配服务端模块；AI Desktop 保持独立桌面应用的构建和运行边界。

## 目录说明

- `apps/`：宿主、业务模块、内部能力和桌面应用目录。
- `shared/`：跨模块复用资产目录。
- `docs/`：平台级文档目录。
- `runtime/`：日志、报告、缓存目录。

## 当前模块

- `host`
- `reference-data`
- `uniauth`
- `mda`
- `japanese`
- `ai-factiory`
- `rule-engine`
- `ai-desktop`：独立桌面应用，不参与统一平台启动。

## 统一平台启动

Windows PowerShell:

```powershell
.\启动SELPLAT.ps1
```

Windows CMD:

```bat
启动SELPLAT.bat
```

统一入口会先结束占用 `8080` 的旧进程，再通过 Host 的 Gradle `run` 任务编译并启动全部显式服务端依赖。它不会编译或启动 `apps/ai-desktop`。

只检查启动入口而不启动服务：

```powershell
.\启动SELPLAT.ps1 -ValidateOnly
```

启动前检查：

1. 平台基础目录是否存在。
2. `apps/host/backend` 和其 `build.gradle` 是否存在。
3. 根 `settings.gradle` 和 Gradle Wrapper 是否存在。

真实模块装配以 `settings.gradle` 和 `apps/host/backend/build.gradle` 为准。
