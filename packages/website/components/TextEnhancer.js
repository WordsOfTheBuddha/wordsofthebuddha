import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import styles from "/styles/TextEnhancer.module.css";

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
  // Update the regex to handle both single words/phrases and curly bracketed phrases with tooltips
  const regex = /(\b[\w\p{L}-]+)\s*\(([^)]+)\)|\{([^}]+)\}\s*\(([^)]+)\)/gu;
  const tooltipMap = {};
  let match;

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, word, tooltip, curlyText, curlyTooltip] = match;

    if (word && tooltip) {
      tooltipMap[word] = tooltip; // Handles the single word (tooltip) case
    } else if (curlyText && curlyTooltip) {
      const cleanedCurlyText = curlyText.trim();
      tooltipMap[cleanedCurlyText] = curlyTooltip.trim(); // Handles the {multiple words} (tooltip) case
    }
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
  const [theme, setTheme] = useState(null);
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef();
  const [lastParagraphText, setLastParagraphText] = useState("");

  useEffect(() => {
    setTheme(resolvedTheme);
  }, [resolvedTheme]);

  const handleWordClick = (event, content) => {
    event.stopPropagation(); // Prevent triggering other click events

    // Temporarily set the content to calculate height
    setTooltipContent(content);

    const lineHeight =
      parseFloat(window.getComputedStyle(event.target).lineHeight) + 1;
    const padding = 10; // Fixed padding of the tooltip

    // Use a Range to get precise positions of each line the element spans
    const range = document.createRange();
    range.selectNodeContents(event.target);
    const rects = range.getClientRects(); // Get an array of DOMRect objects

    let firstLineRect = rects[0]; // Assume the first rect is the first line's bounding box

    // Now you can use firstLineRect instead of rect for positioning
    setTimeout(() => {
      if (tooltipRef.current) {
        const tooltipHeight = tooltipRef.current.offsetHeight;
        const tooltipWidth = tooltipRef.current.offsetWidth; // Get the tooltip's width
        const viewportWidth = window.innerWidth; // Get the viewport width

        // Calculate how many line heights the tooltip content spans, including padding
        const numberOfLines = Math.ceil((tooltipHeight - padding) / lineHeight);

        // Set the tooltip offset based on the number of lines the tooltip spans
        let tooltipOffset;
        if (numberOfLines >= 4) {
          tooltipOffset = lineHeight * 4;
        } else if (numberOfLines === 3) {
          tooltipOffset = lineHeight * 3;
        } else if (numberOfLines === 2) {
          tooltipOffset = lineHeight * 2;
        } else {
          tooltipOffset = lineHeight + 1; // Default to one line height
        }

        // Calculate the desired x position based on the start of the first line
        let xPosition = firstLineRect.x;

        // Check if the tooltip overflows the viewport
        if (xPosition + tooltipWidth > viewportWidth) {
          // If it does, shift it to the left
          xPosition = viewportWidth - tooltipWidth - 10; // Add some padding

          // Ensure xPosition is not negative
          if (xPosition < 0) {
            xPosition = 10; // Add a minimum padding from the left edge
          }
        }

        setTooltipPosition({
          x: xPosition,
          y: firstLineRect.top + window.scrollY - tooltipOffset, // Adjust position based on content
        });
      }
    }, 0); // Delay to allow content to render and height to be measured
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

  const processContent = (children, theme, lastParagraphText, minThreshold) => {
    let currentContent = [];

    React.Children.forEach(children, (child) => {
      if (typeof child === "string") {
        currentContent.push(child);
      } else if (React.isValidElement(child)) {
        currentContent.push(child.props.children);
      }
    });

    const paragraphText = currentContent.join("");
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
    const finalContent = [];
    let underlineActive = false;
    let underlineText = "";

    for (let i = 0; i < styledText.length; i++) {
      const element = styledText[i];
      if (React.isValidElement(element)) {
        let textContent = element.props.children;

        if (typeof textContent === "string") {
          const trimmedText = textContent.trim();

          // Handle curly brace content { ... }
          if (trimmedText.includes("{")) {
            underlineActive = true;
            underlineText += trimmedText.replace("{", "").replace(/^['"]/, "");
          } else if (underlineActive && trimmedText.endsWith("}")) {
            underlineActive = false;
            underlineText += " " + trimmedText.replace("}", "");

            const fullText = underlineText.trim().replace(/\s+/g, " ");

            const tooltip = tooltipMap[fullText];

            finalContent.push(
              <span
                key={`underline-${i}`}
                style={{
                  fontSize: "1.2rem",
                  borderBottom: `2px solid var(--secondary-color-${theme})`,
                  paddingBottom: "1px",
                  cursor: tooltip ? "pointer" : "default",
                }}
                onClick={(e) => tooltip && handleWordClick(e, tooltip)}
              >
                {fullText}
              </span>
            );

            underlineText = ""; // Reset the accumulated text
          } else if (underlineActive) {
            underlineText += " " + trimmedText;
          } else if (tooltipMap[trimmedText] && !usedKeys.has(trimmedText)) {
            const tooltip = tooltipMap[trimmedText];
            usedKeys.add(trimmedText);

            finalContent.push(
              <span
                key={`tooltip-${i}`}
                style={{
                  ...element.props.style,
                  borderBottom: `2px solid var(--secondary-color-${theme})`,
                  paddingBottom: "1px",
                  cursor: "pointer",
                }}
                onClick={(e) => handleWordClick(e, tooltip)}
              >
                {textContent}
              </span>
            );
          } else {
            finalContent.push(element);
          }
        } else {
          finalContent.push(element);
        }
      } else {
        finalContent.push(element);
      }
    }

    const cleanedContent = stripBracketContent(finalContent);

    return isVerse(paragraphText) ? (
      <blockquote
        className={`${styles.blockquote} ${
          theme === "dark" ? styles.blockquoteDark : styles.blockquoteLight
        }`}
      >
        {cleanedContent}
      </blockquote>
    ) : (
      <p className={styles.paragraph}>{cleanedContent}</p>
    );
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
    theme,
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
            maxWidth: "450px",
            padding: "5px 10px",
            top: tooltipPosition.y,
            left: tooltipPosition.x,
            backgroundColor:
              theme === "dark"
                ? "var(--background-color-dark)"
                : "var(--background-color-light)",
            color:
              theme === "dark"
                ? "var(--text-color-dark)"
                : "var(--text-color-light)",
            border: `1px solid ${
              theme === "dark"
                ? "var(--text-color-dark)"
                : "var(--text-color-light)"
            }`,
            zIndex: 1000,
            borderRadius: "4px",
          }}
          dangerouslySetInnerHTML={{ __html: tooltipContent }}
        />
      )}
    </div>
  );
};

export default TextEnhancer;
