import React from "react";
import { useConfig } from "nextra-theme-docs";

export function Commentary({ commentary }) {
  const { frontMatter } = useConfig();
  const displayCommentary = commentary || frontMatter.commentary;

  return (
    displayCommentary && (
      <>
        <div style={{ marginBottom: "1rem", whiteSpace: "pre-wrap", fontSize: "0.92rem", fontStyle: "italic" }}>
          {displayCommentary}
        </div>
        <hr />
      </>
    )
  );
}

export default Commentary;