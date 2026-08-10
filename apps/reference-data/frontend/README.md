# reference-data frontend

本目录预留后续独立 Vue 管理端源码，不放置通用基础控件源码。

当前可运行的第一版管理页面由 Host 统一端口发布，资源暂存于：

```text
backend/src/main/resources/static/reference-data/
```

访问地址：`/reference-data/reference-data.html`。

后续适合实现：

- 把现有类型管理页面逐步组件化迁入本目录。
- 树、下拉选项、右键菜单和类型数据状态查看。
- 数据项维护、发布管理与权限可见性。
- 缓存刷新和版本查看。
- 调用权限与租户范围配置。

真正可跨应用复用的树控件和下拉控件仍应进入前端 shared/base component。
