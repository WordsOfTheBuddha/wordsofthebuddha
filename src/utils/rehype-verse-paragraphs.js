import { visit } from "unist-util-visit";
import { toText } from "hast-util-to-text";

const isVerse = (text) => {
  // Preserve line breaks from both markdown and HTML <br>
  const lines = text
    .split(/(?:\r\n|\n|\r|<br>)/)
    .map((l) => l.trim())
    .filter(Boolean);

  // console.log("Lines detected:", lines); // Debug line
  if (lines.length < 2) return false;

  const lastLine = lines[lines.length - 1];
  const otherLines = lines.slice(0, -1);

  const lastLineValid = /[.?"—'’;‘]$/.test(lastLine);
  const otherLinesValid = otherLines.every((line) => /[,;:.?!]?$/.test(line));

  /* console.log("Verse check:", {
    lines,
    lastLine,
    lastLineValid,
    otherLines,
    otherLinesValid,
  }); */ // Debug line

  return lastLineValid && otherLinesValid;
};

export function rehypeVerseParagraphs() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "p") {
        // Preserve line breaks from both markdown and HTML
        const paragraphText = toText(node, {
          whitespace: "pre",
          allowDangerousHtml: true, // Preserve <br> elements
        })
          .replace(/<br\s*\/?>/gi, "\n") // Convert <br> to newlines
          .replace(/ +/g, " ") // Collapse multiple spaces
          .trim();

        if (isVerse(paragraphText)) {
          node.properties = node.properties || {};
          node.properties.className = [
            ...(node.properties.className || []),
            "verse",
          ];
        }
      }
    });
  };
}
