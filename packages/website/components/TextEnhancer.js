import React, { useState, useEffect, useRef } from "react";
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

const detectRepetition = (currentText, lastText, minThreshold = 30) => {
  const normalize = (word) =>
    word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"]/g, "").toLowerCase();

  const removeBrackets = (text) =>
    text.replace(/\s*\[.*?\]|\s*\(.*?\)/g, "").trim();

  let result = [];
  const currentWords = currentText.match(/\S+|\s+/g);

  if (!lastText) {
    // If lastText is not present, wrap each word in a span and return
    result = currentWords.map((word, i) => (
      <span key={i} style={{ fontSize: "1.2rem" }}>
        {word}
      </span>
    ));
    return result;
  }

  const preprocessedLastText = removeBrackets(lastText).replace(/\s+/g, " ");
  const lastWords = preprocessedLastText.match(/\S+|\s+/g);

  let i = 0;

  while (i < currentWords.length) {
    let matchFound = false;
    let bestMatchLength = 0;
    let bestMatchSegment = [];
    let bestMatchIndex = i;

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
      i = bestMatchIndex;
    } else {
      result.push(
        <span key={i} style={{ fontSize: "1.2rem" }}>
          {currentWords[i]}
        </span>
      );
      i++;
    }
  }

  return result;
};

const handleParenthesesContent = (text) => {
  // Update the regex to handle Unicode word characters, including special characters
  const regex = /(\b[\w\p{L}-]+)\s*\(([^)]+)\)/gu;
  const tooltipMap = {};
  let match;

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, word, tooltip] = match;
    tooltipMap[word] = tooltip;
  }

  return tooltipMap;
};

const stripBracketContent = (elements) => {
  const strippedElements = [];
  let skip = false;

  elements.forEach((element, index) => {
    if (React.isValidElement(element)) {
      let textContent = element.props.children;

      if (typeof textContent === "string") {
        // Start skipping when encountering "("
        if (textContent.includes("(")) {
          skip = true;

          // Check if the previous element is a space, and remove it
          if (index > 0 && elements[index - 1].props.children === " ") {
            strippedElements.pop(); // Remove the space before "("
          }
        }

        // Add element to strippedElements if not in skip mode
        if (!skip) {
          strippedElements.push(element);
        }

        // Stop skipping after encountering ")"
        if (textContent.includes(")")) {
          skip = false;

          // Extract and store any text after the ")" including punctuation
          const [beforeParen, afterParen] = textContent.split(")");
          if (afterParen) {
            strippedElements.push(
              <span key={`punctuation-${index}`} style={element.props.style}>
                {afterParen.trim()}
              </span>
            );
          }
        }
      } else {
        strippedElements.push(element);
      }
    } else {
      strippedElements.push(element);
    }
  });

  return strippedElements;
};

const TextEnhancer = ({ children, minThreshold = 30 }) => {
  const { resolvedTheme } = useTheme();
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef();
  const [lastParagraphText, setLastParagraphText] = useState("");

  const handleWordClick = (event, content) => {
    event.stopPropagation(); // Prevent triggering other click events
    const rect = event.target.getBoundingClientRect();
    setTooltipPosition({ x: rect.left, y: rect.top + window.scrollY - 40 }); // Positioning above the word
    setTooltipContent(content);
  };

  const handleOutsideClick = (event) => {
    if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
      setTooltipContent(null);
    }
  };

  useEffect(() => {
    if (tooltipContent) {
      document.addEventListener("click", handleOutsideClick);
      window.addEventListener("scroll", () => {
        setTooltipContent(null);
      });
    } else {
      document.removeEventListener("click", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("scroll", () => setTooltipContent(null));
    };
  }, [tooltipContent]);

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
          {paragraphText}
        </blockquote>
      );
    } else {
      const tooltipMap = handleParenthesesContent(paragraphText);

      let styledText = detectRepetition(
        paragraphText,
        lastParagraphText,
        minThreshold
      );

      if (typeof styledText === "string") {
        styledText = [<span key="0">{styledText}</span>];
      }

      const usedKeys = new Set(); // To track keys that have been replaced
      const finalContent = styledText.map((element, index) => {
        if (React.isValidElement(element)) {
          const textContent = element.props.children;

          if (typeof textContent === "string") {
            const trimmedText = textContent.trim();

            // Check if the text is in the tooltipMap and hasn't been replaced yet
            if (tooltipMap[trimmedText] && !usedKeys.has(trimmedText)) {
              const tooltip = tooltipMap[trimmedText];

              // Mark this key as used
              usedKeys.add(trimmedText);

              return (
                <span
                  key={`tooltip-${index}`}
                  style={{
                    ...element.props.style,
                    borderBottom: `2px solid var(--secondary-color-${resolvedTheme})`,
                    paddingBottom: "1px",
                    cursor: "pointer",
                  }}
                  onClick={(e) => handleWordClick(e, tooltip)}
                >
                  {textContent}
                </span>
              );
            }
          }
        }

        return element;
      });

      const cleanedContent = stripBracketContent(finalContent);
      return <p className={styles.paragraph}>{cleanedContent}</p>;
    }
  };

  const currentText = React.Children.toArray(children).join("");

  useEffect(() => {
    const storedLastParagraph = sessionStorage.getItem("lastParagraphText");
    if (storedLastParagraph) {
      setLastParagraphText(storedLastParagraph);
      if (currentText) {
        const updatedText = (storedLastParagraph + " \n " + currentText).trim();
        sessionStorage.setItem("lastParagraphText", updatedText);
      }
    } else if (currentText) {
      sessionStorage.setItem("lastParagraphText", currentText);
    }
  }, [currentText]);

  const processedContent = processContent(
    children,
    resolvedTheme,
    lastParagraphText,
    minThreshold
  );

  return (
    <div>
      {processedContent}
      {tooltipContent && (
        <div
          ref={tooltipRef}
          style={{
            position: "absolute",
            padding: "5px 10px",
            top: tooltipPosition.y,
            left: tooltipPosition.x,
            backgroundColor:
              resolvedTheme === "dark"
                ? "var(--background-color-dark)"
                : "var(--background-color-light)",
            color:
              resolvedTheme === "dark"
                ? "var(--text-color-dark)"
                : "var(--text-color-light)",
            border: `1px solid ${
              resolvedTheme === "dark"
                ? "var(--text-color-dark)"
                : "var(--text-color-light)"
            }`,
            zIndex: 1000,
            borderRadius: "4px",
          }}
        >
          {tooltipContent}
        </div>
      )}
    </div>
  );
};

export default TextEnhancer;
