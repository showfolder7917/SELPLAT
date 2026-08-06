# apps

这里放平台宿主与各业务模块。

放置原则：

- 每个一级目录代表一个可独立接入、可独立下线的模块。
- 模块内部再按 `backend`、`frontend`、`doc`、`manifest` 分层。
- 跨模块复用内容不要放在这里，应进入 `shared`。

当前模块：

- `host`
- `reference-data`
- `uniauth`
- `attendance`
- `rule-engine`
- `crm`
- `cms`
- `fujitsu`
