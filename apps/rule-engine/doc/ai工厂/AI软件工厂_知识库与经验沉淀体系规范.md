# AI软件工厂-知识库与经验沉淀体系规范

版本：V1.0

## 1. 设计目标

本系统不建设传统意义上的经验库（Experience Library）与知识库（Knowledge Base）。

核心思想：

- 以事实为基础
- 以规则为沉淀
- 以门禁为执行
- 以日志为追溯

系统长期资产仅保留：

- Log Library（日志库）
- Rule Library（规则库）
- Gate Library（门禁库）

---

# 2. 设计原则

## 原则1：日志记录事实

日志只记录发生过的事情。

例如：

- 谁执行
- 何时执行
- 执行结果
- 失败原因
- 修复过程

禁止在日志中记录推测性内容。

---

## 原则2：规则沉淀结论

规则用于指导未来执行。

例如：

R001

设计文档必须包含：

- 文件路径
- 函数名称
- 验收标准

规则应简洁明确。

---

## 原则3：门禁负责执法

门禁用于验证规则是否被遵守。

例如：

G001

检查：

- 是否包含文件路径
- 是否包含函数名称
- 是否包含验收标准

未满足则拒绝进入下一阶段。

---

## 原则4：不建立经验库

错误模式：

日志
↓
经验总结
↓
经验库
↓
知识库
↓
Agent阅读

问题：

- 经验越来越多
- 难以维护
- Agent难以阅读
- 易产生冲突

因此不建设经验库。

---

# 3. Log Library（日志库）

## 目标

保存完整事实记录。

## 内容

记录：

- ThreadID
- 时间
- Agent
- 操作
- 输入
- 输出
- 结果

示例：

```text
2026-08-19 09:00
ThreadID:10001
Agent:Design Agent
Result:FAIL
Reason:缺少接口定义
```

---

# 4. Rule Library（规则库）

## 目标

指导Agent行为。

## 分类

### Requirement Rules

需求规则。

### Architecture Rules

架构规则。

### Design Rules

设计规则。

### Coding Rules

编码规则。

### Testing Rules

测试规则。

### Gate Rules

门禁规则。

---

## 规模控制

目标：50条

警戒线：100条

最大值：200条

超过100条必须启动规则审查。

超过200条禁止新增规则。

---

# 5. Gate Library（门禁库）

## 目标

验证规则是否被遵守。

## 特点

可持续增长。

数量不限。

优先新增Gate。

避免无限新增Rule。

---

示例：

G001 需求完整性检查

G002 架构完整性检查

G003 设计完整性检查

G004 测试通过率检查

G005 覆盖率检查

G006 审计完整性检查

---

# 6. 问题处理机制

当发现问题时：

日志记录
↓
根因分析
↓
判断问题类型

### 类型A

实现问题

处理：

代码修复

结束。

---

### 类型B

规则缺陷

处理：

修改Rule Library。

---

### 类型C

门禁缺陷

处理：

修改Gate Library。

---

### 类型D

流程缺陷

处理：

修改Process Library。

---

# 7. 根因分析流程

日志
↓
Root Cause Analysis
↓
是否需要修改Rule？
↓
是否需要修改Gate？
↓
是否需要修改流程？
↓
结束

禁止产生独立经验库。

---

# 8. 数据资产结构

最终保留资产：

```text
Knowledge Assets
│
├─ Log Library
├─ Rule Library
├─ Gate Library
└─ Process Library
```

不保留：

```text
Experience Library
Case Library
Memory Library
Knowledge Wiki
```

---

# 9. 核心理念

日志记录事实。

规则沉淀方法。

门禁负责执法。

流程负责治理。

任何问题最终都应转化为：

- Rule更新
- Gate更新
- Process更新

而不是不断堆积经验与知识。