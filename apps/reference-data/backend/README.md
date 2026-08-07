# reference-data backend

本模块实现平台引用数据的运行时服务，由 `apps/host/backend` 装配，不单独占用 HTTP 端口。

## 当前框架

- `service`：实现 contract 查询接口。
- `provider`：登记具体项目提供的树和类型数据源。
- `controller`：绑定 HTTP 参数并直接序列化 API Service 返回的 `CommonResult`。
- `config`：把 reference-data 组件显式装配进 platform-runtime。
- `persistence`：维护 reference-data 自己的 `JdbcTemplate`，不注册公共 `DataSource`，避免影响 Host 与其他应用数据库。
- `type`：类型目录的 Repository、Service 和管理 Controller。

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

## 当前 HTTP 契约

```text
GET /api/reference-data/{projectCode}/{resourceCode}/tree
GET /api/reference-data/{projectCode}/{resourceCode}/options
```

成功响应固定使用 `CommonResult`：

```json
{
  "success": true,
  "moduleCode": "reference-data",
  "requestPath": "/api/reference-data/reference-data/resource-kind/options",
  "data": [
    {
      "value": "TREE",
      "label": "Tree resource",
      "groupCode": "reference-data-resource-kind",
      "sortOrder": 10,
      "disabled": false,
      "attributes": {
        "resourceKind": "TREE"
      }
    }
  ],
  "msg": "引用数据选项查询完成。"
}
```

未登记资源返回 HTTP 400、`errorType=BUSINESS` 和
`errorCode=REFERENCE_DATA_RESOURCE_NOT_FOUND`。Provider 技术故障返回 HTTP 500、
`errorType=SYSTEM` 和 `errorCode=REFERENCE_DATA_PROVIDER_FAILED`。

## 类型管理

管理页面：

```text
/reference-data/reference-data.html
```

管理 API：

```text
GET  /api/reference-data/admin/types
GET  /api/reference-data/admin/types/{id}
POST /api/reference-data/admin/types
POST /api/reference-data/admin/types/{id}
POST /api/reference-data/admin/types/{id}/delete
```

删除采用 `status=0` 的逻辑删除。内置坐标 `reference-data/resource-kind` 不允许删除。

默认数据库地址由 `ReferenceDataPersistenceConfiguration` 从工程根解析为
`apps/reference-data/db/data/reference-data`。可以通过
`reference-data.datasource.url`、`username`、`password` 覆盖；正式环境默认文件库，测试必须显式改用隔离库。

## 后续实现边界

- 类型目录与 Provider 注册表当前相互独立：后台登记类型不会自动生成 Provider 或执行任意 SQL。
- 资源注册表只保存受控的逻辑资源与物理实现映射。
- 树和类型缓存必须按项目、资源、租户和版本隔离。
- 数据库写入、导入和批处理由资源所有者负责本地事务。
- 未登记或重复登记的资源必须明确失败，禁止返回静默空数据。
