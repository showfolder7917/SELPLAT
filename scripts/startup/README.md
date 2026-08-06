# startup

这里放平台启动脚本。

当前已存在：

- `start-host.ps1`
- `start-host.bat`

`start-host` 先验证 module metadata 和 manifest，再停止占用宿主端口的旧进程，最后以前台 Gradle `run` 任务启动 `apps/host/backend`。关闭脚本会话后，本次宿主进程随之结束。

只验证模块登记、不启动服务时使用：

```powershell
.\scripts\startup\start-host.ps1 -ValidateOnly
```

后续可扩展：

- 启动仍保留独立运行能力的单模块脚本
- 调试模式启动脚本
