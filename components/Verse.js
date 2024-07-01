// components/Verse.js
import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { useTheme } from "next-themes";

// Define a styled blockquote element
const Blockquote = styled.blockquote`
  font-style: italic;
  color: var(--text-color);
  border-left: 4px solid #ccc;
  padding-left: 16px;
  margin: 16px 0;

  &.light {
    --text-color: #555;
  }

  &.dark {
    --text-color: #fff;
  }
`;

// Utility function to extract text content from children
const extractText = (children) => {
  if (typeof children === "string") {
    return children;
  } else if (Array.isArray(children)) {
    return children
      .map((child) => {
        if (typeof child === "string") {
          return child;
        } else if (child.props && child.props.children) {
          return extractText(child.props.children);
        } else {
          return "";
        }
      })
      .join("");
  } else if (children.props && children.props.children) {
    return extractText(children.props.children);
  } else {
    return "";
  }
};

export function Verse({ children }) {
  const { theme } = useTheme();
  // Extract text from children if it's an array of objects
  const text = Array.isArray(children)
    ? children.map((child) => extractText(child.props.children)).join("\n\n")
    : extractText(children);

  // Split the text into paragraphs and lines
  const paragraphs = text
    .trim()
    .split("\n\n")
    .map((paragraph, index) => (
      <Blockquote key={index} className={theme}>
        <p>
          {paragraph.split("\n").map((line, lineIndex) => (
            <React.Fragment key={lineIndex}>
              {line}
              <br />
            </React.Fragment>
          ))}
        </p>
      </Blockquote>
    ));

  return <>{paragraphs}</>;
}

Verse.propTypes = {
  children: PropTypes.node.isRequired,
};

export default Verse;
