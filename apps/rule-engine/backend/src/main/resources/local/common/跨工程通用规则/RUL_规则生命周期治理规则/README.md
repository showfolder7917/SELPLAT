# 规则生命周期治理资产目录

## 主入口

- `../RUL_规则生命周期治理规则.md`：规则新增、生成、移动、合并、退役、索引维护以及可选模板材料治理的唯一主规则。

## 生成入口

- 通过 `${MEMORY_CODE_ROOT}/executor.py` 调用 `rule_package_generator`。
- `plan` 返回 `rule/` 主规则文件、可选模板约定位置和叶子索引登记计划，不产生文件。
- `generate` 在全部校验通过后，只在项目或子项目的 `rule/` 创建主规则并向叶子 `RULE_INDEX.md` 追加入口。
- 程序不得自动创建 `template/`、README、样例或空目录；模板材料只能在真实来源核验后人工收集。

当前资产目录没有独立模板或项目配置；后续新增关联资产时必须使用 `docs/`、`template/`、`examples/` 或 `project/` 标准子目录。
