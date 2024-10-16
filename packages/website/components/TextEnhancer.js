import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import styles from "/styles/TextEnhancer.module.css";
import ReactMarkdown from 'react-markdown';

const isVerse = (paragraph) => {
	const lines = paragraph.trim().split("\n");
	if (lines.length < 2) return false;

	const lastLine = lines[lines.length - 1].trim();
	const otherLines = lines.slice(0, -1);

	const lastLineValid = /[.?"-—']$/.test(lastLine);
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

const extractTextFromChildren = (children) => {
	let text = "";

	React.Children.forEach(children, (child) => {
	  if (typeof child === "string") {
		text += child;
	  } else if (React.isValidElement(child)) {
		if (child.props && child.props.children) {
		  text += extractTextFromChildren(child.props.children);
		}
	  }
	});

	return text;
};

const hasMarkdownSyntax = (text) => {
	const markdownRegex = /(\*\*[^*\n]+\*\*|\*[^\*\n]+\*|__[^_\n]+__|_[^_\n]+_|`[^`\n]+`|!\[[^\]]*\]\([^\)]+\)|\[[^\]]+\]\([^\)]+\))/;
	return markdownRegex.test(text);
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

  const extractPhrasesAndTooltips = (text) => {
    const phrasesAndTooltips = [];
    const regex = /(\{[^}]+\}|[\w\p{L}-]+)\s*\(((?:[^()]*|\([^()]*\))*?)\)/gu;
    let match;
  
    while ((match = regex.exec(text)) !== null) {
      const [fullMatch, phraseOrWord, tooltip] = match;
      let cleanedPhrase = phraseOrWord;
  
      // Remove curly braces if present
      if (cleanedPhrase.startsWith('{') && cleanedPhrase.endsWith('}')) {
        cleanedPhrase = cleanedPhrase.slice(1, -1).trim();
      }
  
      phrasesAndTooltips.push({
        phrase: cleanedPhrase.trim(),
        tooltip: tooltip.trim(),
        startIndex: match.index,
        endIndex: regex.lastIndex,
      });
    }
  
    return phrasesAndTooltips;
  };

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const processContent = (children, theme, lastParagraphText, minThreshold) => {
	let paragraphText = extractTextFromChildren(children);
	// console.log(`paragraphText: ${paragraphText}`);

	// Check if the paragraph starts with a number
	const numberAtStart = paragraphText.match(/^\d+\s/);

	let numberToken = null;
  
	if (numberAtStart) {
	  // If there is a number at the start, create a token for it with special styling
	  numberToken = {
		type: 'number',
		content: numberAtStart[0],
	  };
	  // Remove the number from paragraphText for further processing
	  paragraphText = paragraphText.slice(numberAtStart[0].length).trim();
	}
  
	// Extract phrases and tooltips using the new function
	const phrasesAndTooltips = extractPhrasesAndTooltips(paragraphText);
  
	// Build tokens from the paragraphText
	let tokens = [];
	let lastIndex = 0;
  
	phrasesAndTooltips.forEach(({ phrase, tooltip, startIndex, endIndex }) => {
	  // Add text before the matched phrase
	  if (startIndex > lastIndex) {
		tokens.push({
		  type: 'text',
		  content: paragraphText.slice(lastIndex, startIndex),
		});
	  }
  
	  // Add the underlined phrase
	  tokens.push({
		type: 'underline',
		content: phrase,
		tooltip: tooltip,
	  });
  
	  lastIndex = endIndex;
	});
  
	// Add any remaining text after the last match
	if (lastIndex < paragraphText.length) {
	  tokens.push({
		type: 'text',
		content: paragraphText.slice(lastIndex),
	  });
	}
  
	// Remove any parentheses and their content from the text tokens
	tokens = tokens.map((token) => {
	  if (token.type === 'text') {
		return {
		  ...token,
		  content: token.content.replace(/(?<!\])\s*\([^()]*\)\s*/g, " "),
		};
	  } else {
		return token;
	  }
	});
  
	// Build the cleaned text for detectRepetition
	const cleanedText = tokens.map((token) => token.content).join('');
  
	// Apply detectRepetition to the cleaned text
	let styledTextArray = detectRepetition(
	  cleanedText,
	  lastParagraphText,
	  minThreshold
	);
  
	// Now, reconstruct the final content by mapping tokens to styledTextArray
	let finalContent = [];
	let styledTextIndex = 0;
  
	// Add the number token at the start if it exists
	if (numberToken) {
	  finalContent.push(
		<span
		  key="number-token"
		  style={{
			fontSize: '1.5rem',
			fontWeight: 900,
			marginRight: '0.5rem',
		  }}
		>
		  {numberToken.content}
		</span>
	  );
	}

	let prevTokenHasMarkdown = false;
	let anyTokenHasMarkdown = false;
	tokens.forEach((token, i) => {
	  const tokenHasMarkdown = hasMarkdownSyntax(token.content);
	  // console.log('token: ', token, ', has markdown: ', tokenHasMarkdown, i);
	  if (token.type === 'text') {
		if (tokenHasMarkdown || anyTokenHasMarkdown) {
			finalContent.push(
			  <ReactMarkdown key={`text-${i}`} components={{
				a: ({ node, ...props }) => <a {...props} />,
				p: ({ node, ...props }) => <span {...props} />,
				// Add any other components you need to customize
			  }}>
				{token.content.replace(/^\s/, '\u00A0')}
			  </ReactMarkdown>
			);
		} else {
			// For text tokens, extract the corresponding elements from styledTextArray
			let tokenLength = token.content.length;
			let accumulatedLength = 0;
			let elements = [];

			while (
			styledTextIndex < styledTextArray.length &&
			accumulatedLength < tokenLength
			) {
				let element = styledTextArray[styledTextIndex];
				let textContent =
					typeof element === 'string' ? element : element.props.children;

				let remainingLength = tokenLength - accumulatedLength;

				if (textContent.length > remainingLength) {
					// Split the element if it's longer than needed
					let neededText = textContent.slice(0, remainingLength);
					let leftoverText = textContent.slice(remainingLength);

					// Create a new element with the needed text
					let newElement =
					typeof element === 'string'
						? neededText
						: React.cloneElement(element, {}, neededText);
					elements.push(newElement);

					// Replace the current element in styledTextArray with the leftover text
					styledTextArray[styledTextIndex] =
					typeof element === 'string'
						? leftoverText
						: React.cloneElement(element, {}, leftoverText);

					accumulatedLength += neededText.length;
				} else {
					elements.push(element);
					accumulatedLength += textContent.length;
					styledTextIndex++;
				}
			}

			finalContent.push(
			<span key={`text-${i}`} style={{ fontSize: '1.2rem' }}>
				{elements}
			</span>
			);
		}
	  } else if (token.type === 'underline') {
		// For underlined tokens, create the underlined span
		if (i > 0 && prevTokenHasMarkdown) {
			finalContent.push(' ');
		}
		finalContent.push(
		  <span
			key={`underline-${i}`}
			style={{
			  fontSize: '1.2rem',
			  borderBottom: `2px solid var(--secondary-color-${theme})`,
			  paddingBottom: '1px',
			  cursor: 'pointer',
			}}
			onClick={(e) => handleWordClick(e, token.tooltip)}
		  >
			{token.content}
		  </span>
		);
  
		// Consume the corresponding length from styledTextArray
		let tokenLength = token.content.length;
		let accumulatedLength = 0;
  
		while (
		  styledTextIndex < styledTextArray.length &&
		  accumulatedLength < tokenLength
		) {
		  let element = styledTextArray[styledTextIndex];
		  let textContent =
			typeof element === 'string' ? element : element.props.children;
  
		  let remainingLength = tokenLength - accumulatedLength;
  
		  if (textContent.length > remainingLength) {
			// Split the element if it's longer than needed
			let neededText = textContent.slice(0, remainingLength);
			let leftoverText = textContent.slice(remainingLength);
  
			// Replace the current element in styledTextArray with the leftover text
			styledTextArray[styledTextIndex] =
			  typeof element === 'string'
				? leftoverText
				: React.cloneElement(element, {}, leftoverText);
  
			accumulatedLength += neededText.length;
		  } else {
			accumulatedLength += textContent.length;
			styledTextIndex++;
		  }
		}
	  }
	  prevTokenHasMarkdown = tokenHasMarkdown;
	  if (tokenHasMarkdown) {
		anyTokenHasMarkdown = true;
	  }
	});
  
	return isVerse(paragraphText) ? (
	  <blockquote
		className={`${styles.blockquote} ${
		  theme === 'dark' ? styles.blockquoteDark : styles.blockquoteLight
		}`}
	  >
		{finalContent}
	  </blockquote>
	) : (
	  <p className={styles.paragraph}>{finalContent}</p>
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
          >
					<ReactMarkdown>{tooltipContent}</ReactMarkdown>
				</div>
			)}
		</div>
	);
};

export default TextEnhancer;
