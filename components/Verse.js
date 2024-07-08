import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import styles from "/styles/Verse.module.css";

const isVerse = (paragraph) => {
  const lines = paragraph.trim().split("\n");
  if (lines.length < 2) return false;

  const lastLine = lines[lines.length - 1].trim();
  const otherLines = lines.slice(0, -1);

  const lastLineValid = /[.?"-]$/.test(lastLine);
  const otherLinesValid = otherLines.every((line) =>
    /[,;:.?]?$/i.test(line.trim())
  );

  return lastLineValid && otherLinesValid;
};

const processContent = (children, theme) => {
  let currentContent = [];

  React.Children.forEach(children, (child) => {
    if (typeof child === "string") {
      currentContent.push(child);
    } else if (React.isValidElement(child)) {
      currentContent.push(child);
    }
  });

  const paragraphText = currentContent.join("");
  if (isVerse(paragraphText)) {
    return (
      <blockquote
        className={`${styles.blockquote} ${
          theme === "dark" ? styles.blockquoteDark : styles.blockquoteLight
        }`}
      >
        {currentContent}
      </blockquote>
    );
  } else {
    return <p className={styles.paragraph}>{currentContent}</p>;
  }
};

const Verse = ({ children }) => {
  const { resolvedTheme } = useTheme();

  if (resolvedTheme === null) {
    return null; // Avoid rendering until the theme is resolved
  }

  return <div>{processContent(children, resolvedTheme)}</div>;
};

export default Verse;