"""规则主文件与同名资产目录生成能力测试。"""

from __future__ import annotations

# 导入模块加载工具，直接验证能力文件的公开执行入口。
import importlib.util
# 导入临时目录工具，保证生成测试不会修改真实规则资源。
import tempfile
# 导入 unittest，使用现有能力测试统一框架。
import unittest
# 导入 Path，构造临时规则目录和断言文件路径。
from pathlib import Path


# 定位待测能力文件。
ABILITY_PATH = Path(__file__).resolve().parents[1] / "abilities" / "rule_package_generator.py"
# 规则生成器测试资源统一归入当前工程 OPTION/temp。
OPTION_TEMP_ROOT = Path(__file__).resolve().parents[4] / "OPTION" / "temp"


# 动态加载能力模块，保持测试不依赖 Python 包安装。
def load_ability_module():
    # 按能力文件创建模块规格。
    spec = importlib.util.spec_from_file_location("rule_package_generator_test_module", ABILITY_PATH)
    # 规格必须存在。
    assert spec is not None
    # 模块加载器必须存在。
    assert spec.loader is not None
    # 根据规格创建独立模块。
    module = importlib.util.module_from_spec(spec)
    # 执行能力文件完成模块加载。
    spec.loader.exec_module(module)
    # 返回待测模块。
    return module


# 验证并列目录规划、真实生成和非法输入阻断。
class RulePackageGeneratorTests(unittest.TestCase):

    # 每个 Case 创建独立规则资源根。
    def setUp(self) -> None:
        # 加载当前能力模块。
        self.module = load_ability_module()
        # 确保统一测试运行目录存在。
        OPTION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
        # 创建可自动清理的临时目录。
        self.temp_dir = tempfile.TemporaryDirectory(prefix="rule_package_", dir=OPTION_TEMP_ROOT)
        # 临时目录根模拟 rule-engine resources。
        self.resource_root = Path(self.temp_dir.name).resolve()
        # 创建 SELPLAT 通用规则范围目录。
        self.scope_root = self.resource_root / "selplat" / "通用规则"
        # 创建完整父目录。
        self.scope_root.mkdir(parents=True)
        # 创建唯一规则索引。
        (self.resource_root / "RULE_INDEX.md").write_text("# test index\n", encoding="utf-8")

    # 每个 Case 结束后清理临时规则资源。
    def tearDown(self) -> None:
        # 删除当前 Case 全部临时文件。
        self.temp_dir.cleanup()

    # 验证 plan 返回主规则与资产目录并列结构且不写文件。
    def test_plan_returns_sibling_main_rule_and_asset_directory(self) -> None:
        # 请求带模板和样例目录的只读计划。
        result = self.module.execute(self._context("plan"), {}, {})
        # 能力必须返回 planned。
        self.assertEqual("planned", result["status"])
        # 主规则文件直接位于通用规则根。
        self.assertEqual(
            self.scope_root / "RUL_Java业务注释规则.md",
            Path(result["main_rule_path"]),
        )
        # 同名资产目录与主规则文件并列。
        self.assertEqual(
            self.scope_root / "RUL_Java业务注释规则",
            Path(result["asset_root"]),
        )
        # plan 不得提前创建主规则。
        self.assertFalse(Path(result["main_rule_path"]).exists())
        # plan 不得提前创建资产目录。
        self.assertFalse(Path(result["asset_root"]).exists())

    # 验证 generate 创建并列结构、README、可选目录和索引入口。
    def test_generate_creates_sibling_structure_and_index_entry(self) -> None:
        # 执行真实生成。
        result = self.module.execute(self._context("generate"), {}, {})
        # 能力必须明确返回 generated。
        self.assertEqual("generated", result["status"])
        # 主规则文件必须存在。
        self.assertTrue(Path(result["main_rule_path"]).is_file())
        # 同名资产目录必须存在。
        self.assertTrue(Path(result["asset_root"]).is_dir())
        # README 必须通过上级相对路径指向并列主规则。
        self.assertIn(
            "../RUL_Java业务注释规则.md",
            Path(result["readme_path"]).read_text(encoding="utf-8"),
        )
        # 模板目录必须按声明创建。
        self.assertTrue((Path(result["asset_root"]) / "template").is_dir())
        # 样例目录必须按声明创建。
        self.assertTrue((Path(result["asset_root"]) / "examples").is_dir())
        # 唯一索引必须直接指向范围根下的主规则文件。
        self.assertIn(
            "SELPLAT_JAVA_COMMENT_RULES = selplat/通用规则/RUL_Java业务注释规则.md",
            (self.resource_root / "RULE_INDEX.md").read_text(encoding="utf-8"),
        )

    # 验证非标准资产目录在生成前被阻断。
    def test_nonstandard_asset_directory_is_blocked(self) -> None:
        # 构造不允许的 assets 目录。
        context = self._context("generate")
        # 替换成非法目录。
        context["asset_directories"] = ["assets"]
        # 执行能力。
        result = self.module.execute(context, {}, {})
        # 必须返回 blocked。
        self.assertEqual("blocked", result["status"])
        # 被阻断后不得创建主规则。
        self.assertFalse((self.scope_root / "RUL_Java业务注释规则.md").exists())

    # 验证现有主规则文件不会被生成器覆盖。
    def test_existing_main_rule_is_blocked(self) -> None:
        # 预先创建人工维护的真实主规则。
        existing_rule = self.scope_root / "RUL_Java业务注释规则.md"
        # 写入可识别原正文。
        existing_rule.write_text("# existing rule\n", encoding="utf-8")
        # 再次请求生成同名规则。
        result = self.module.execute(self._context("generate"), {}, {})
        # 必须返回现有规则阻断。
        self.assertEqual("blocked_existing_rule", result["status"])
        # 原主规则正文必须保持不变。
        self.assertEqual("# existing rule\n", existing_rule.read_text(encoding="utf-8"))
        # 被阻断后不得创建同名资产目录。
        self.assertFalse((self.scope_root / "RUL_Java业务注释规则").exists())

    # 验证重复索引键会回滚新生成文件。
    def test_duplicate_index_key_is_blocked_and_generated_files_are_removed(self) -> None:
        # 在唯一索引中预先登记相同键。
        (self.resource_root / "RULE_INDEX.md").write_text(
            "# test index\nSELPLAT_JAVA_COMMENT_RULES = existing.md\n",
            encoding="utf-8",
        )
        # 请求生成使用相同索引键的新规则。
        result = self.module.execute(self._context("generate"), {}, {})
        # 必须返回重复索引键阻断。
        self.assertEqual("blocked_existing_index_key", result["status"])
        # 回滚后主规则文件不得残留。
        self.assertFalse((self.scope_root / "RUL_Java业务注释规则.md").exists())
        # 回滚后同名资产目录不得残留。
        self.assertFalse((self.scope_root / "RUL_Java业务注释规则").exists())

    # 构造当前测试统一能力上下文。
    def _context(self, action: str) -> dict:
        # 返回完整规则资源、范围、名称、资产和索引事实。
        return {
            "action": action,
            "resource_root": str(self.resource_root),
            "scope_path": "selplat/通用规则",
            "rule_name": "RUL_Java业务注释规则",
            "asset_directories": ["template", "examples"],
            "index_key": "SELPLAT_JAVA_COMMENT_RULES",
            "rule_content": "# Java 业务注释规则\n",
        }


# 允许直接运行当前测试文件。
if __name__ == "__main__":
    # 启动 unittest。
    unittest.main()
