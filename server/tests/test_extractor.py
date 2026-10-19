import base64
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from extractor import ExtractionError, extract, normalize_task, valid_date


class ExtractorTests(unittest.TestCase):
    def test_explicit_date_and_no_relative_guess(self):
        with patch.dict(os.environ, {"AI_API_KEY": ""}):
            result = extract({"text": "请于2026年10月25日18:00前提交报名表\n周五前填写问卷\n大家晚上好"})
        self.assertEqual(result["mode"], "rules")
        self.assertEqual(len(result["tasks"]), 2)
        self.assertEqual(result["tasks"][0]["dueDate"], "2026-10-25")
        self.assertEqual(result["tasks"][0]["dueTime"], "18:00")
        self.assertEqual(result["tasks"][1]["dueDate"], "")
        self.assertTrue(result["tasks"][1]["warnings"])

    def test_dates_and_fabricated_quotes(self):
        self.assertEqual(valid_date("2026-02-30"), "")
        self.assertEqual(valid_date("2028-02-29"), "2028-02-29")
        task = normalize_task({"title": "提交", "dueDate": "2026-02-30", "dueTime": "99:99", "sourceQuote": "不存在"}, "原始通知", 0)
        self.assertEqual(task["sourceQuote"], "")
        self.assertEqual(task["dueTime"], "")
        self.assertGreaterEqual(len(task["warnings"]), 2)

    def test_image_requires_ai_and_rejects_invalid_bytes(self):
        image = {"mime": "image/png", "data": base64.b64encode(b"\x89PNG\r\n\x1a\nexample").decode()}
        with patch.dict(os.environ, {"AI_API_KEY": ""}):
            with self.assertRaisesRegex(ExtractionError, "视觉模型"):
                extract({"images": [image]})
        with self.assertRaisesRegex(ExtractionError, "类型不符"):
            extract({"images": [{"mime": "image/png", "data": "YQ=="}]})

    def test_changes_are_flagged(self):
        with patch.dict(os.environ, {"AI_API_KEY": ""}):
            task = extract({"text": "提交报名表改到下周一"})["tasks"][0]
        self.assertTrue(any("变更" in warning for warning in task["warnings"]))
        self.assertEqual(task["dueDate"], "")

    def test_ai_contract_and_secrets_not_in_result(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({"choices": [{"message": {"content": json.dumps({"tasks": [
            {"title": "提交报名表", "dueDate": "2026-10-25", "sourceQuote": "提交报名表", "materials": ["简介"]}
        ]})}}]}).encode()
        with patch.dict(os.environ, {"AI_API_KEY": "test-secret", "AI_MODEL": "vision-test", "AI_BASE_URL": "https://example.com/v1"}), patch("urllib.request.urlopen", return_value=response) as call:
            result = extract({"text": "请提交报名表", "referenceDate": "2026-10-19"})
        self.assertEqual(result["mode"], "ai")
        self.assertEqual(result["tasks"][0]["materials"], ["简介"])
        request = call.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.com/v1/chat/completions")
        self.assertNotIn("test-secret", json.dumps(result))
        self.assertIn("2026-10-19", json.loads(request.data)["messages"][0]["content"])

    def test_empty_and_model_malformed(self):
        with self.assertRaises(ExtractionError):
            extract({})
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"choices": []}'
        with patch.dict(os.environ, {"AI_API_KEY": "x", "AI_MODEL": "test"}), patch("urllib.request.urlopen", return_value=response):
            with self.assertRaisesRegex(ExtractionError, "无法解析"):
                extract({"text": "报名"})

    def test_model_array_and_non_string_warning_are_rejected(self):
        task = normalize_task({"title": "填写", "warnings": [None, {}, "需核对"]}, "填写", 0)
        self.assertIn("需核对", task["warnings"])
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"choices": [{"message": {"content": "[]"}}]}'
        with patch.dict(os.environ, {"AI_API_KEY": "x", "AI_MODEL": "test"}), patch("urllib.request.urlopen", return_value=response):
            with self.assertRaises(ExtractionError):
                extract({"text": "报名"})


if __name__ == "__main__":
    unittest.main()
