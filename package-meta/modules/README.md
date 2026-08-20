# modules

这里放每个模块的元数据文件。

当前已存在：

- `host.json`
- `reference-data.json`
- `uniauth.json`
- `attendance.json`
- `rule-engine.json`
- `crm.json`
- `cms.json`
- `fujitsu.json`

每个文件说明：

- 模块是否启用
- 模块路径
- 依赖模块

应用身份由 Host 桌面应用清单统一维护；模块元数据不再登记或校验应用级 manifest。
