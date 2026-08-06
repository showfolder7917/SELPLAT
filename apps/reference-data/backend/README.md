# reference-data backend

本模块实现平台引用数据的运行时服务，由 `apps/host/backend` 装配，不单独占用 HTTP 端口。

## 当前框架

- `service`：实现 contract 查询接口。
- `provider`：登记具体项目提供的树和类型数据源。
- `config`：把 reference-data 组件显式装配进 platform-runtime。

## Provider 规则

每个 Provider 必须声明唯一的：

```text
projectCode + resourceCode
```

例如：

```text
uniauth + department
order + product-category
warehouse + location-type
```

Provider 由数据所属项目实现。通用查询 Service 只负责路由，不直接猜测表名、列名或跨库事务。

## 后续实现边界

- HTTP API 统一放在 `/api/reference-data/**`。
- 资源注册表只保存受控的逻辑资源与物理实现映射。
- 树和类型缓存必须按项目、资源、租户和版本隔离。
- 数据库写入、导入和批处理由资源所有者负责本地事务。
- 未登记或重复登记的资源必须明确失败，禁止返回静默空数据。
