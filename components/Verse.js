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
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      const paragraphs = child.split("\n\n");
      return paragraphs.map((paragraph, i) => {
        const trimmedParagraph = paragraph.trim();
        const verseNumberMatch = trimmedParagraph.match(/^(\d+)\.\n?/);

        const blockquoteClass =
          theme === "dark" ? styles.blockquoteDark : styles.blockquoteLight;

        if (verseNumberMatch) {
          const verseNumber = verseNumberMatch[1];
          const verseText = trimmedParagraph.replace(/^(\d+)\.\n?/, "");
          const isVerseContent = isVerse(verseText);

          if (isVerseContent) {
            return (
              <React.Fragment key={i}>
                <p>{verseNumber}.</p>
                <blockquote
                  className={`${styles.blockquote} ${blockquoteClass}`}
                >
                  {verseText}
                </blockquote>
              </React.Fragment>
            );
          }
        }

        if (isVerse(trimmedParagraph)) {
          return (
            <React.Fragment key={i}>
              <blockquote className={`${styles.blockquote} ${blockquoteClass}`}>
                {trimmedParagraph}
              </blockquote>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={i}>
              <p className={styles.paragraph}>{trimmedParagraph}</p>
              <br /> {/* Ensure double newlines */}
            </React.Fragment>
          );
        }
      });
    } else if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        children: processContent(child.props.children, theme),
      });
    } else {
      return child;
    }
  });
};

const Verse = ({ children }) => {
  const { resolvedTheme } = useTheme();
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(resolvedTheme);
  }, [resolvedTheme]);

  if (theme === null) {
    return null; // Avoid rendering until the theme is resolved
  }

  return <div>{processContent(children, theme)}</div>;
};

export default Verse;
