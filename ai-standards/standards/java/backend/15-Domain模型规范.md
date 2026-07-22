# Domain 模型规范

## 1. 目的

本规范用于统一 Java 后端 `domain` 模型的书写方式，避免实体、查询入参、保存入参、返回对象之间职责混乱。

本规范参考 `apps/uniauth/backend/src/main/java/com/sp/selplat/uniauth/user/domain/UniauthUser.java` 的实际写法提炼，强调“继承公共基类 + 业务字段驼峰命名 + 中文业务注释 + 标准 getter/setter”这一套风格。

## 2. 目录分层规则

推荐目录分层如下：

- `domain`：核心业务实体
- `domain.in`：查询、保存、更新等输入模型
- `domain.out`：列表、详情、接口返回模型

当前含义：

- `domain` 承接主表稳定业务字段
- `domain.in` 承接控制层和服务层输入语义
- `domain.out` 承接查询返回和页面展示语义

## 3. 核心实体规则

### 3.1 核心实体优先继承公共 `Domain`

像主业务实体这种模型，优先继承公共 `Domain`，复用：

- `id`
- `tenantId`
- `lastOperateUserId`
- `sortnum`
- `status`
- `createdAt`
- `updatedAt`

这样可以避免每个实体重复定义公共字段。

### 3.2 实体类名与业务对象保持一致

实体类名应直接表达业务对象，不要使用模糊缩写。

示例：

- `UniauthUser`
- `UniauthTenant`
- `OrderMain`

## 4. 字段命名规则

### 4.1 字段统一使用驼峰命名

实体字段必须和数据库列、JSON 字段保持同一套驼峰口径。

正确示例：

- `tenantId`
- `loginName`
- `displayName`
- `displayNameKana`
- `userStatus`
- `expiredAt`

错误示例：

- `tenant_id`
- `login_name`
- `display_name`

### 4.2 字段名要表达业务语义

字段名不能只图短，要让人能一眼看出含义。

推荐：

- `passwordHash`
- `displayNameKana`
- `lastOperateUserId`

不推荐：

- `pwd`
- `name2`
- `flag1`

## 5. 注释规则

### 5.1 业务字段必须写中文业务注释

字段上方统一使用 `//` 中文业务注释，说明这个字段在当前业务流程里的作用，而不是只解释语法。

示例：

```java
// loginName 对应登录账号字段，供认证入口按唯一账号检索用户。
private String loginName;
```

### 5.2 类注释说明“该实体承接什么表/什么职责”

类级注释要明确：

- 对应哪张表
- 该实体承担什么职责
- 为什么继承公共基类

## 6. 类型选择规则

### 6.1 主键和外键优先使用 `Long`

涉及主键、租户标识、最近操作用户标识等字段，统一使用 `Long`。

### 6.2 时间字段优先使用 `LocalDateTime`

像：

- `createdAt`
- `updatedAt`
- `expiredAt`

统一优先使用 `LocalDateTime`。

### 6.3 布尔状态按业务真实语义选择

像 `lockedFlag` 这种字段，如果业务上表达“是否锁定”，可以使用 `Boolean`，保持语义直观。

## 7. getter/setter 规则

### 7.1 每个业务字段都要完整提供 getter/setter

不要省略标准访问器，也不要把访问器写成与字段名不匹配的形式。

### 7.2 getter/setter 使用 Javadoc

方法上统一使用 Javadoc，说明：

- 获取/设置什么字段
- 参数是什么业务含义

示例：

```java
/**
 * 获取登录账号。
 *
 * @return 登录账号
 */
public String getLoginName() {
    return loginName;
}
```

## 8. `domain.in` 规则

### 8.1 输入模型表达“调用方传什么”

`domain.in` 主要承接：

- 查询条件
- 保存入参
- 更新入参

### 8.2 可以继承核心实体，但要明确目的

如果查询入参大量复用实体字段，可以像 `UniauthUserIn` 一样继承核心实体，减少重复定义。

但如果保存入参和实体差异很大，则应单独定义，不要强行继承。

## 9. `domain.out` 规则

### 9.1 输出模型表达“查询返回什么”

`domain.out` 主要承接：

- 列表项
- 详情对象
- 接口专用返回结构

### 9.2 页面展示专属字段放在 `out`

如果某些字段只服务于页面展示、组合显示、扩展标题等，应优先放 `domain.out`，不要混进核心实体。

## 10. 与数据库和 Mapper 的一致性规则

### 10.1 实体字段名要和表结构驼峰列一致

如果数据库列是：

- `tenantId`
- `displayName`
- `lastOperateUserId`

那实体字段也必须是同名驼峰，不要中间再转一层历史命名。

### 10.2 `domain.out` 要与 `resultMap` 保持一致

只要 XML 中 `resultMap` 映射到某个 `domain.out`，这个 `out` 类的字段和类型就必须和 XML 同步维护。

## 11. 不建议的写法

不建议：

- 把查询入参、保存入参、返回对象全塞进一个类
- 字段无中文业务注释
- 用下划线字段名
- 用模糊缩写字段名
- 页面展示字段和数据库核心实体字段混杂

## 12. 最终要求

后续新写 Domain 模型时，统一遵守：

- 核心实体优先继承公共 `Domain`
- 字段统一驼峰命名
- 字段必须补中文业务注释
- getter/setter 使用 Javadoc
- `domain` / `domain.in` / `domain.out` 分层明确
- 类型、命名、字段口径和数据库、Mapper 保持一致
