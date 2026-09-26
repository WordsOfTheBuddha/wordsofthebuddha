#!/usr/bin/env python3
from __future__ import annotations

import unittest

from mdx_section_toc import (
    extract_mdx_section_toc,
    heading_listen_label,
    is_mdx_section_toc_line,
)


class MdxSectionTocTests(unittest.TestCase):
    def test_toc_on_following_line(self) -> None:
        body, toc = extract_mdx_section_toc(
            "#### 2.11\n{/* toc: Two Powers */}\n\nText.\n",
        )
        self.assertNotIn("toc:", body)
        self.assertEqual(toc["2.11"], "Two Powers")

    def test_interleaved_blank_lines(self) -> None:
        body, toc = extract_mdx_section_toc(
            "#### 2.11\n\n#### 2.11\n{/* toc: Two Powers */}\n\nText.\n",
        )
        self.assertEqual(toc["2.11"], "Two Powers")
        self.assertNotIn("{/*", body)

    def test_legacy_html_toc_line(self) -> None:
        body, toc = extract_mdx_section_toc(
            "#### 2.11\n<!-- toc: Two Powers -->\n\nText.\n",
        )
        self.assertEqual(toc["2.11"], "Two Powers")
        self.assertNotIn("<!--", body)

    def test_is_toc_line(self) -> None:
        self.assertTrue(is_mdx_section_toc_line("{/* toc: X */}"))
        self.assertTrue(is_mdx_section_toc_line("<!-- toc: X -->"))

    def test_listen_label_composite(self) -> None:
        self.assertEqual(
            heading_listen_label("2.12", {"2.12": "Two Powers - II"}),
            "2.12 — Two Powers - II",
        )
        self.assertEqual(heading_listen_label("2.12", {}), "2.12")


if __name__ == "__main__":
    unittest.main()
