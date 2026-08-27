import importlib.util
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.dont_write_bytecode = True


PROJECT_ROOT = next(
    candidate for candidate in Path(__file__).resolve().parents
    if (candidate / "settings.gradle").is_file()
)
ABILITY_ROOT = (
    PROJECT_ROOT
    / "apps/ai-desktop/ruleengine/python/local/XUNAN/abilities"
)
ABILITY_PATH = (
    ABILITY_ROOT / "japanese_n2_ai_question_reviewer.py"
)


def load_ability():
    sys.path.insert(0, str(ABILITY_ROOT))
    spec = importlib.util.spec_from_file_location("japanese_n2_ai_question_reviewer", ABILITY_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class JapaneseN2AiQuestionReviewerTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.ability = load_ability()

    def test_compose_audio_text_replaces_only_question_placeholder(self):
        record = {
            "sourceQuestionNo": 3,
            "questionText": "田中選手は、全国大会が終わったら（　）するそうだ。",
            "optionA": "移動",
            "optionB": "完了",
            "optionC": "引退",
            "optionD": "失業",
            "correctOption": "C",
        }

        actual = self.ability.compose_audio_text(record)

        self.assertEqual("田中選手は、全国大会が終わったら引退するそうだ。", actual)

    def test_compose_audio_text_keeps_non_fill_question(self):
        record = {
            "sourceQuestionNo": 1,
            "questionText": "日本では野球選手に憧れる子どもたちが多い。",
            "optionA": "あこがれる",
            "optionB": "みだれる",
            "optionC": "めぐまれる",
            "optionD": "たおれる",
            "correctOption": "A",
        }

        self.assertEqual(record["questionText"], self.ability.compose_audio_text(record))

    def test_compose_audio_text_fills_paired_grammar_slots(self):
        record = {
            "sourceQuestionNo": 300,
            "questionText": "テーブルにはノート（　）辞書（　）が置かれていた。",
            "optionA": "たり／たり",
            "optionB": "やら／やら",
            "optionC": "とか／とか",
            "optionD": "という／という",
            "correctOption": "B",
        }

        actual = self.ability.compose_audio_text(record)

        self.assertEqual(
            "テーブルにはノートやら辞書やらが置かれていた。", actual)

    def test_apply_review_locks_correct_option_and_derives_audio(self):
        records = []
        reviews = []
        for question_no in range(1, 731):
            records.append({
                "sourceQuestionNo": question_no,
                "questionType": "GRAMMAR",
                "questionText": "これは（　）です。",
                "optionA": "正解",
                "optionB": "誤り",
                "optionC": "別案",
                "optionD": "未定",
                "correctOption": "A",
                "explanation": "old",
            })
            reviews.append({
                "sourceQuestionNo": question_no,
                "questionText": "これは（　）です。",
                "optionA": "正解",
                "optionB": "誤り",
                "optionC": "別案",
                "optionD": "未定",
                "explanation": "正确答案是A。",
                "confidence": "HIGH",
                "notes": "",
            })
        with TemporaryDirectory() as directory:
            root = Path(directory)
            dataset = root / "dataset.json"
            review = root / "review.json"
            output = root / "output.json"
            dataset.write_text(json.dumps({"records": records}), encoding="utf-8")
            review.write_text(json.dumps({"records": reviews}), encoding="utf-8")

            result = self.ability.apply_review(dataset, review, output)

        self.assertEqual("A", result["records"][0]["correctOption"])
        self.assertEqual("これは正解です。", result["records"][0]["audioText"])
        self.assertEqual({"HIGH": 730, "MEDIUM": 0, "LOW": 0},
                         result["aiReviewConfidenceCounts"])

    def test_validate_review_rejects_duplicate_options(self):
        source = [{
            "sourceQuestionNo": 152,
            "questionText": "国境を越える。",
            "optionA": "こくきょう",
            "optionB": "こっきょ",
            "optionC": "こくぎょう",
            "optionD": "こっきょう",
            "correctOption": "D",
        }]
        reviewed = [{
            "sourceQuestionNo": 152,
            "questionText": "国境を越える。",
            "optionA": "こくきょう",
            "optionB": "こっきょう",
            "optionC": "こくぎょう",
            "optionD": "こっきょう",
            "explanation": "国境读作こっきょう。",
            "confidence": "LOW",
            "notes": "B和D重复。",
        }]

        with self.assertRaisesRegex(ValueError, "must be distinct"):
            self.ability.validate_review_batch(source, reviewed)


if __name__ == "__main__":
    unittest.main()
