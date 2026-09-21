#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("prepare-readme-i18n.py")


def run_prepare(config: dict, target: str = "all") -> tuple[dict, dict]:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        config_path = root / "config.json"
        source_path = root / "README.md"
        settings_path = root / "settings.json"
        targets_path = root / "targets.txt"
        meta_path = root / "meta.json"

        config_path.write_text(
            json.dumps(config, ensure_ascii=False),
            encoding="utf-8",
        )
        source_path.write_text(
            "# Example\n\nCI と PDDR Kit の説明です。\n",
            encoding="utf-8",
        )

        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--config",
                str(config_path),
                "--source-file",
                str(source_path),
                "--source-language",
                "ja",
                "--target",
                target,
                "--settings-out",
                str(settings_path),
                "--targets-out",
                str(targets_path),
                "--meta-out",
                str(meta_path),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise AssertionError(
                f"prepare failed ({result.returncode}): "
                f"stdout={result.stdout!r} stderr={result.stderr!r}"
            )

        return (
            json.loads(settings_path.read_text(encoding="utf-8")),
            json.loads(meta_path.read_text(encoding="utf-8")),
        )


class PrepareReadmeI18nTests(unittest.TestCase):
    def test_identity_terms_are_masked_but_not_sent_to_glossary(self) -> None:
        settings, meta = run_prepare(
            {
                "targetLanguages": ["en", "fr"],
                "protectedTerms": ["PDDR Kit"],
                "glossary": [
                    {"source": "CI", "target": "CI"},
                    {
                        "source": "canonical term",
                        "target": "preferred translation",
                        "targetLang": "en",
                    },
                ],
            }
        )

        self.assertEqual(
            meta["literalTermsByLanguage"],
            {
                "en": ["PDDR Kit", "CI"],
                "fr": ["PDDR Kit", "CI"],
            },
        )

        terms = settings["glossaryPresets"][0]["terms"]
        self.assertEqual(
            terms,
            [
                {
                    "source": "canonical term",
                    "target": "preferred translation",
                    "targetLang": "en",
                }
            ],
        )
        self.assertTrue(settings["glossaryEnabled"])
        self.assertFalse(
            any(term["source"].casefold() == "ci" for term in terms)
        )

    def test_identity_only_config_disables_glossary_enforcement(self) -> None:
        settings, meta = run_prepare(
            {
                "targetLanguages": ["fr"],
                "protectedTerms": ["PDDR Kit"],
                "glossary": [
                    {"source": " CI ", "target": "CI"},
                ],
            }
        )

        self.assertEqual(
            meta["literalTermsByLanguage"]["fr"],
            ["PDDR Kit", "CI"],
        )
        self.assertFalse(settings["glossaryEnabled"])
        self.assertEqual(settings["glossaryPresets"][0]["terms"], [])


if __name__ == "__main__":
    unittest.main()
