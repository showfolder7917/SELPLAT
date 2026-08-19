客户对应需求分析师 需求分析师 把需求拆分成需求要件 多个文件后 下发给架构师拆分成架构要件 每个文件要完整 一个文件对应一个架构师或多个架构师 所以每一个文档都能够从头到尾实现

# 企业级 AI 开发工厂系统

## 1. 需求文档（Requirements）

### 1.1 项目名称
AI 需求驱动自动开发与门禁治理平台

### 1.2 项目目标
通过单一需求会话，自动完成需求分析、设计生成、任务拆分、代码执行、测试验证、门禁检查、缺陷修复、规则优化与审计追踪。

### 1.3 核心原则

1. Rule 负责指导 Agent。
2. Gate 负责拦截错误。
3. 错误必须被沉淀为经验。
4. 所有任务均通过 ThreadID 关联。
5. 一个需求对应一个工作空间。

### 1.4 状态流转

WAITING
→ RUNNING
→ TESTED
→ GATE_APPROVED
→ DONE

### 1.5 功能需求

#### FR-001 需求会话

用户通过聊天窗口输入需求。

系统自动生成：

- requirement.md
- design.md

#### FR-002 线程管理

统一命名：

中文名称_ThreadID

示例：

用户导入功能_10001

#### FR-003 文档生成

每个需求自动生成：

- requirement.md
- design.md
- test.md
- audit.md
- gate.md

#### FR-004 任务拆分

Design Agent 根据设计文档拆分任务。

输出：

- TASK-001
- TASK-002
- TASK-003

#### FR-005 分支管理

采用需求级分支。

示例：

feature/thread-10001

#### FR-006 自动执行

Execution Agent 根据设计执行代码修改。

设计至少精确至：

- 文件路径
- 函数名称
- 修改说明

#### FR-007 自动测试

测试 Agent 负责：

- 单元测试
- 集成测试
- 覆盖率统计

#### FR-008 门禁系统

门禁独立于测试系统。

输出：

- PASS
- FAIL

未通过禁止进入下一阶段。

#### FR-009 修复系统

门禁失败后：

Gate → Fix Agent

自动修复问题并重新测试。

#### FR-010 经验沉淀

生成：

retrospective.md

记录：

- 根因
- 修复方案
- 经验教训

#### FR-011 规则优化

Rules Agent 根据总结更新规则库。

规则变更需经过审核。

### 1.6 非功能需求

#### 性能

普通需求处理时间 ≤ 30分钟。

#### 审计

所有 Agent 操作写入 audit.md。

#### 可追溯性

所有记录均可通过 ThreadID 查询。

#### 扩展性

支持新增 Agent。

---

# 2. 概要设计（High Level Design）

## 2.1 总体架构

需求Agent
↓
设计Agent
↓
执行Agent
↓
测试Agent
↓
门禁Agent
↓
完成

失败分支：

门禁Agent
↓
修复Agent
↓
总结Agent
↓
规则Agent
↓
重新执行

## 2.2 目录结构

```text
workspace/

用户导入功能_10001/
├─ metadata.yaml
├─ requirement.md
├─ design.md
├─ test.md
├─ gate.md
├─ audit.md
├─ retrospective.md
└─ release.md
```

## 2.3 Metadata

```yaml
thread_id: 10001
title: 用户导入功能
status: RUNNING
branch: feature/thread-10001
```

## 2.4 Rule Library

推荐规模：

- 目标：50条
- 警戒：100条
- 上限：200条

规则分类：

- Requirement Rules
- Design Rules
- Coding Rules
- Testing Rules
- Gate Rules

## 2.5 Gate Library

Gate 数量不设上限。

示例：

G001 需求完整性检查
G002 设计完整性检查
G003 设计外文件修改检查
G004 测试通过检查
G005 覆盖率检查
G006 审计完整性检查

## 2.6 覆盖率策略

普通模块：85%以上

核心模块：95%以上

新增代码：90%以上

## 2.7 审计机制

记录：

- 时间
- Agent
- 操作内容
- 修改文件
- 测试结果

## 2.8 版本管理

采用 Git。

规则：

一个需求一个分支。

示例：

feature/thread-10001
feature/thread-10002

## 2.9 查询机制

统一使用 ThreadID。

支持查询：

- Requirement
- Design
- Test
- Gate
- Audit
- Branch

## 2.10 门禁原则

Rule 负责预防。

Gate 负责执法。

禁止仅通过增加 Prompt 提高质量。

优先增加 Gate。
