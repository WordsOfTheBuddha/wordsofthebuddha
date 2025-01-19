import { visit } from "unist-util-visit";
import { h } from "hastscript";

/**
 * Replaces text `{...} (...)` with:
 *   <span class="tooltip-text" data-tooltip="(...)"> ... </span>
 */
export default function rehypeTooltip() {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      // Safety check: must have a parent and text
      if (!parent || !node.value) return;

      const regex = /\{([^}]*)\}\s*\(([^)]*)\)/g;
      let match;
      const results = [];
      let lastIndex = 0;

      // Go through all matches within a text node
      while ((match = regex.exec(node.value)) !== null) {
        // Text before match
        if (match.index > lastIndex) {
          results.push({
            type: "text",
            value: node.value.slice(lastIndex, match.index),
          });
        }

        const tooltipText = match[1];
        const tooltipContent = match[2];

        // The tooltip element
        results.push(
          h(
            "span",
            {
              class: "tooltip-text",
              "data-tooltip": tooltipContent,
            },
            tooltipText
          )
        );

        lastIndex = regex.lastIndex;
      }

      // Remainder of text after last match
      if (lastIndex < node.value.length) {
        results.push({
          type: "text",
          value: node.value.slice(lastIndex),
        });
      }

      // If we found any matches, splice them into the parent's children
      if (results.length > 0) {
        parent.children.splice(index, 1, ...results);

        // We return the new position in the array so that
        // the visitor continues correctly after our inserted nodes
        return index + results.length;
      }
    });
  };
}
