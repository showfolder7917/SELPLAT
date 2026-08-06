# host manifest

本目录保存 platform-runtime 的模块身份。

- `module_id` 固定为 `host`。
- `module_type` 固定为 `host`。
- `route_prefix` 为平台根路径 `/`。
- host 不依赖具体业务模块；具体启用列表由 Profile 和运行时装配共同决定。

这里放宿主模块声明文件。

建议内容：

- `module.json`
- 后续可扩展 `routes.json`
- 后续可扩展 `menus.json`
- 后续可扩展 `dependencies.json`

当前已存在：`module.json`
