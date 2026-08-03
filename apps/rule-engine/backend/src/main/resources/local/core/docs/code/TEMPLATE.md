# Python File Template

这个模板用于 `./apps/rule-engine/backend/src/main/python/com/sp/selplat/local/code/core/` 下的 Python 技能文件、应用文件与能力文件。

## 必须包含的结构

1. 文件头说明
2. 唯一标识常量
3. 名称常量
4. 说明常量
5. 输入或依赖定义
6. `run(...)` 入口函数

## 文件头要求

每个 `.py` 文件开头必须先写文档字符串，至少包含：

- 功能
- 作用
- 适用场景

## 注释要求

- 保持中文注释
- 当前目录下的样板文件默认每一行关键代码都补中文说明
- 返回字典中的每个字段建议单独加注释说明

## Skill 模板

```python
"""技能名称。

功能：
说明技能做什么。

作用：
说明这个技能在系统中的位置。

适用场景：
- 场景一
- 场景二
"""

# 技能唯一标识。
SKILL_ID = "sample_skill"
# 技能名称。
SKILL_NAME = "示例技能"
# 技能说明。
SKILL_DESC = "这是一个示例技能。"

# 技能输入定义。
REQUIRED_INPUTS = ["input_a"]
# 技能输出定义。
OUTPUTS = ["result"]


# 定义技能入口。
def run(input_a: str) -> dict:
    # 组织输出结果。
    result = {
        # 返回处理结果。
        "result": input_a,
    }
    # 返回结果字典。
    return result
```

## Ability 模板

- `ability` 可以依赖 1 个或多个 `skill`
- `ability` 也可以依赖 0 个或多个 `app`
- 即使一个需求只需要 1 个 `skill`，也要提供对应 `ability`

```python
"""能力名称。

功能：
说明能力做什么。

作用：
说明这个能力在系统中的位置。

适用场景：
- 场景一
- 场景二
"""

# 能力唯一标识。
ABILITY_ID = "sample_ability"
# 能力名称。
ABILITY_NAME = "示例能力"
# 能力说明。
ABILITY_DESC = "这是一个示例能力。"

# 记录依赖技能。
REQUIRED_SKILLS = ["sample_skill_a"]
# 记录依赖应用。
REQUIRED_APPS = ["sample_app_a"]


# 定义能力入口。
def run(context: dict) -> dict:
    # 组织能力结果。
    result = {
        # 返回能力标识。
        "ability": ABILITY_ID,
        # 返回依赖技能。
        "required_skills": REQUIRED_SKILLS,
        # 返回依赖应用。
        "required_apps": REQUIRED_APPS,
        # 返回上下文。
        "context": context,
    }
    # 返回结果字典。
    return result
```

## App 模板

```python
"""应用名称。

功能：
说明应用做什么。

作用：
说明这个应用在系统中的位置。

适用场景：
- 场景一
- 场景二
"""

# 应用唯一标识。
APP_ID = "sample_app"
# 应用名称。
APP_NAME = "示例应用"
# 应用说明。
APP_DESC = "这是一个示例应用。"


# 定义应用入口。
def main() -> None:
    # 输出应用启动说明。
    print("sample app")
```
