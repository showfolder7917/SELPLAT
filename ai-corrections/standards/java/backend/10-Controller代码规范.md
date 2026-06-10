# Controller 代码规范

职责：

- 接收请求
- 做参数边界校验
- 调用 Service
- 返回统一响应

禁止：

- Controller 直接写 SQL 参数拼装逻辑
- Controller 直接跨层访问 DAO
- Controller 承担核心业务编排
