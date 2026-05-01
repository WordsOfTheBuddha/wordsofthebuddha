#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from voice_text_normalizer import extract_paragraphs_auto, strip_frontmatter


def _load_detector_module():
    p = Path(__file__).resolve().parent / "detect-rerecord-impact.py"
    spec = importlib.util.spec_from_file_location("detect_rerecord_impact", p)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load detector module")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


DETECTOR = _load_detector_module()


def _texts(raw: str, mode: str) -> dict[int, str]:
    body = strip_frontmatter(raw)
    if mode == "manifest":
        pairs = extract_paragraphs_auto(body, for_manifest=True)
    elif mode == "tts":
        pairs = extract_paragraphs_auto(body, for_tts=True)
    else:
        pairs = extract_paragraphs_auto(body)
    return {pid: txt for pid, txt, _ in pairs}


class ReRecordImpactTests(unittest.TestCase):
    def test_gloss_tooltip_only_edit_no_impact(self):
        old = "---\ntitle: T\n---\n\nA |taints::outflows| remain."
        new = "---\ntitle: T\n---\n\nA |taints::defilements| remain."
        impact = DETECTOR.classify(
            "x",
            _texts(old, "manifest"),
            _texts(new, "manifest"),
            _texts(old, "tts"),
            _texts(new, "tts"),
            _texts(old, "display"),
            _texts(new, "display"),
        )
        self.assertEqual(impact.severity, "none")

    def test_gloss_display_segment_change_detected(self):
        old = "---\ntitle: T\n---\n\nA |mental defilements::outflows| remain."
        new = "---\ntitle: T\n---\n\nA |taints::outflows| remain."
        impact = DETECTOR.classify(
            "x",
            _texts(old, "manifest"),
            _texts(new, "manifest"),
            _texts(old, "tts"),
            _texts(new, "tts"),
            _texts(old, "display"),
            _texts(new, "display"),
        )
        self.assertIn("manifestTextChanged", impact.reason_flags)
        self.assertGreaterEqual(len(impact.changed_paragraphs), 1)

    def test_punctuation_only_override_changes_manifest(self):
        old = "---\ntitle: T\n---\n\nHello |, bhikkhus,::::| world."
        new = "---\ntitle: T\n---\n\nHello |, bhikkhus,::::,| world."
        impact = DETECTOR.classify(
            "x",
            _texts(old, "manifest"),
            _texts(new, "manifest"),
            _texts(old, "tts"),
            _texts(new, "tts"),
            _texts(old, "display"),
            _texts(new, "display"),
        )
        self.assertIn("manifestTextChanged", impact.reason_flags)

    def test_paragraph_count_drift_major(self):
        old = "---\ntitle: T\n---\n\nP1.\n\nP2."
        new = "---\ntitle: T\n---\n\nP1."
        impact = DETECTOR.classify(
            "x",
            _texts(old, "manifest"),
            _texts(new, "manifest"),
            _texts(old, "tts"),
            _texts(new, "tts"),
            _texts(old, "display"),
            _texts(new, "display"),
        )
        self.assertEqual(impact.severity, "major")
        self.assertIn("paragraphCountChanged", impact.reason_flags)

    def test_heading_structure_drift_major(self):
        old = "---\ntitle: T\n---\n\n#### 1\n\nVerse one.\n\n#### 2\n\nVerse two."
        new = "---\ntitle: T\n---\n\nVerse one.\n\nVerse two."
        impact = DETECTOR.classify(
            "x",
            _texts(old, "manifest"),
            _texts(new, "manifest"),
            _texts(old, "tts"),
            _texts(new, "tts"),
            _texts(old, "display"),
            _texts(new, "display"),
            heading_structure_changed=DETECTOR.has_heading_structure_drift(old, new),
        )
        self.assertEqual(impact.severity, "major")
        self.assertIn("headingStructureChanged", impact.reason_flags)

    def test_retake_recommendation_singular_plural(self):
        self.assertIn("paragraph 3.", DETECTOR.retake_recommendation("minor", [3]))
        self.assertIn("paragraphs 3-4.", DETECTOR.retake_recommendation("minor", [3, 4]))
        self.assertTrue(
            DETECTOR.retake_recommendation("moderate", [1, 2, 3]).startswith("Retake paragraphs")
        )


if __name__ == "__main__":
    unittest.main()

