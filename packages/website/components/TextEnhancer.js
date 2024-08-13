import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import styles from "/styles/Verse.module.css";

const isVerse = (paragraph) => {
  const lines = paragraph.trim().split("\n");
  if (lines.length < 2) return false;

  const lastLine = lines[lines.length - 1].trim();
  const otherLines = lines.slice(0, -1);

  const lastLineValid = /[.?"-']$/.test(lastLine);
  const otherLinesValid = otherLines.every((line) =>
    /[,;:.?]?$/i.test(line.trim())
  );

  return lastLineValid && otherLinesValid;
};

const detectRepetition = (currentText, lastText, minThreshold = 20) => {
  if (!lastText) return currentText; // No comparison if no last text exists

  // Helper function to remove punctuation and normalize casing for comparison purposes
  const normalize = (word) =>
    word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"]/g, "").toLowerCase();

  // Helper function to remove content within brackets for comparison purposes
  const removeBrackets = (text) =>
    text.replace(/\s*\[.*?\]|\s*\(.*?\)/g, "").trim();

  // Preprocess lastText by removing brackets
  const preprocessedLastText = removeBrackets(lastText).replace(/\s+/g, " ");

  // Split into words and spaces/punctuation
  const currentWords = currentText.match(/\S+|\s+/g);
  const lastWords = preprocessedLastText.match(/\S+|\s+/g);

  let result = [];
  let i = 0;

  while (i < currentWords.length) {
    let matchFound = false;
    let matchCount = 0;
    let bestMatchLength = 0;
    let bestMatchSegment = [];
    let bestMatchIndex = i;

    // Search for a matching sequence in lastWords
    for (let j = 0; j < lastWords.length; j++) {
      let k = 0;

      while (
        i + k < currentWords.length &&
        j + k < lastWords.length &&
        normalize(currentWords[i + k]) === normalize(lastWords[j + k])
      ) {
        k++;
      }

      const matchingSegmentLength = currentWords.slice(i, i + k).length;

      // Check if the match length is greater than or equal to the minThreshold
      if (
        matchingSegmentLength >= minThreshold &&
        matchingSegmentLength > bestMatchLength
      ) {
        bestMatchLength = matchingSegmentLength;
        bestMatchSegment = currentWords.slice(i, i + k);
        bestMatchIndex = i + k;
        matchFound = true;
      }
    }

    if (matchFound) {
      const matchingSegment = bestMatchSegment.join("");
      result.push(
        <span key={i} style={{ opacity: 0.7, fontSize: "1.2rem" }}>
          {matchingSegment}
        </span>
      );
      i = bestMatchIndex; // Skip over the matched segment
    } else {
      result.push(
        <span key={i} style={{ fontSize: "1.2rem" }}>
          {currentWords[i]}
        </span>
      );
      i++;
    }
  }

  // Join the result to verify the output text matches currentText
  const resultText = result.map((span) => span.props.children).join("");

  // If the result text doesn't match currentText, return currentText without any modifications
  if (resultText !== currentText) {
    return currentText;
  }

  return result.length > 0 ? result : currentText;
};

const processContent = (
  children,
  resolvedTheme,
  lastParagraphText,
  minThreshold
) => {
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
          resolvedTheme === "dark"
            ? styles.blockquoteDark
            : styles.blockquoteLight
        }`}
      >
        {currentContent}
      </blockquote>
    );
  } else {
    const styledText = detectRepetition(
      paragraphText,
      lastParagraphText,
      minThreshold
    );

    return <p className={styles.paragraph}>{styledText}</p>;
  }
};

const TextEnhancer = ({ children, minThreshold = 20 }) => {
  const { resolvedTheme } = useTheme();
  const [lastParagraphText, setLastParagraphText] = useState("");

  const currentText = React.Children.toArray(children).join("");

  // Retrieve the last paragraph text from sessionStorage when the component is rendered
  useEffect(() => {
    const storedLastParagraph = sessionStorage.getItem("lastParagraphText");
    if (storedLastParagraph) {
      setLastParagraphText(storedLastParagraph);
      if (currentText) {
        const updatedText = (storedLastParagraph + " \n " + currentText).trim();
        sessionStorage.setItem("lastParagraphText", updatedText);
      }
    } else if (currentText) {
      // If there is no stored value, just save the current text
      sessionStorage.setItem("lastParagraphText", currentText);
    }
  }, [currentText]);
  const processedContent = processContent(
    children,
    resolvedTheme,
    lastParagraphText,
    minThreshold
  );

  return <div>{processedContent}</div>;
};

export default TextEnhancer;
