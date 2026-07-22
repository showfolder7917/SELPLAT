# DAO 样板说明

参考来源：

- `com.sp.selfsp.uniauth.user.dao.UniauthUserDao`
- `com.sp.selfsp.uniauth.role.dao.UniauthRoleDao`

样板特征：

- DAO 接口按领域拆分
- 接口上使用 `@Mapper`
- 方法职责清晰，围绕主表和强相关关系表组织
- 中文业务注释直接写明方法承担的持久化职责
