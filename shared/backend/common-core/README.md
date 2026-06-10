# common-core

这里放 Java 后端公共核心能力。

定位：

- 给 `uniauth`、`attendance`、`rule-engine`、`crm`、`cms` 等子工程统一复用
- 承接真正跨模块稳定复用的公共方法和公共支撑类
- 作为类似公共 `common` 包的共享后端公共工程入口

推荐包路径：

```text
com.sp.selplat.common
```

适合放：

- 通用值处理工具
- 通用哈希与编码工具
- 通用时间与字符串工具
- 通用返回结构基类
- 通用异常基类

不适合放：

- 某个业务模块专有规则
- 某个模块私有 SQL 逻辑
- 某个模块私有 DTO 或 Entity

当前状态：

- 已建立 `src/main/java/com/sp/selplat/common`
- 已放入首批公共工具类骨架
