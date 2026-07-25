# SELPLAT

`SELPLAT` 是多业务可插拔平台的空骨架工程。

当前目录只包含平台结构、模块声明和最小启动校验入口，不包含任何旧工程迁移内容。

## 目录说明

- `apps/`：宿主与业务模块目录。
- `shared/`：跨模块复用资产目录。
- `docs/`：平台级文档目录。
- `ai-standards/`：给 AI 使用的当前工程规范与同步修正索引目录。
- `scripts/`：启动、构建、测试、维护脚本目录。
- `runtime/`：日志、报告、缓存目录。
- `package-meta/`：模块启用、依赖和装配元数据目录。

## 当前模块

- `host`
- `uniauth`
- `attendance`
- `rule-engine`
- `crm`
- `cms`
- `fujitsu`

## 最小启动验证

Windows PowerShell:

```powershell
.\scripts\startup\start-host.ps1
```

Windows CMD:

```bat
scripts\startup\start-host.bat
```

最小启动验证只检查：

1. 平台基础目录是否存在。
2. 模块元数据是否存在。
3. 每个启用模块是否具备对应的 `manifest/module.json`。
4. `host` 模块是否已启用。

它不启动任何旧工程，也不加载任何业务代码。
