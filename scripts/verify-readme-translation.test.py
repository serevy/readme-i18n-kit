#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("verify-readme-translation.py")


class SourceResidueVerifierTests(unittest.TestCase):
    def run_verifier(
        self,
        source: str,
        translated: str,
        *,
        allowed: list[str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source_path = root / "README.md"
            translated_path = root / "README.en.md"
            config_path = root / "config.json"

            source_path.write_text(source, encoding="utf-8")
            translated_path.write_text(translated, encoding="utf-8")
            config_path.write_text(
                json.dumps(
                    {
                        "protectedTerms": [],
                        "sourceResiduePatterns": ["[ぁ-んァ-ヶ]"],
                        "allowedSourceResiduePatterns": allowed or [],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            return subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    str(source_path),
                    str(translated_path),
                    str(config_path),
                ],
                text=True,
                capture_output=True,
                check=False,
            )

    def test_detects_source_residue_outside_fence(self) -> None:
        run = self.run_verifier(
            "# Title\n\n日本語です。\n",
            "# Title\n\n日本語です。\n",
        )
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("source-language residue detected", run.stdout)

    def test_allows_matching_allowlist_line(self) -> None:
        run = self.run_verifier(
            "# Title\n\n日本語の原題 https://example.test/source\n",
            "# Title\n\n日本語の原題 https://example.test/source\n",
            allowed=[r"example\.test/source"],
        )
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)

    def test_ignores_source_residue_inside_fenced_code(self) -> None:
        source = "# Title\n\n```text\n日本語コメント\n```\n"
        run = self.run_verifier(source, source)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)


if __name__ == "__main__":
    unittest.main()
