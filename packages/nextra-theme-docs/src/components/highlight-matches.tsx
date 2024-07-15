import escapeStringRegexp from 'escape-string-regexp';
import type { ReactElement, ReactNode } from 'react';
import { memo } from 'react';

type MatchArgs = {
  value?: string;
  match: string;
};

export const HighlightMatches = memo<MatchArgs>(function HighlightMatches({
  value,
  match
}: MatchArgs): ReactElement | null {
  if (!value) {
    return null;
  }

  const escapedSearch = escapeStringRegexp(match.trim());
  const regexp = new RegExp(escapedSearch.replaceAll(/\s+/g, '|'), 'ig');
  let result;
  let lastIndex = 0;
  const content: (string | ReactNode)[] = [];

  while ((result = regexp.exec(value))) {
    const before = value.slice(lastIndex, result.index);
    const matchText = value.slice(result.index, regexp.lastIndex);
    if (before) {
      content.push(before);
    }
    content.push(
      <span key={result.index} className="nx-text-primary-600">
        {matchText}
      </span>
    );
    lastIndex = regexp.lastIndex;
  }

  // Add any remaining text after the last match
  if (lastIndex < value.length) {
    content.push(value.slice(lastIndex));
  }

  // Function to handle splitting text into lines and rendering
  const renderContent = (content: (string | ReactNode)[]) => {
    const renderedContent: ReactNode[] = [];

    content.forEach((part, index) => {
      if (typeof part === 'string') {
        const lines = part.split('\n');
        lines.forEach((line, idx) => {
          renderedContent.push(
            <span key={`${index}-${idx}`} style={{'marginBottom': '1rem'}}>
              {line}
              {idx < lines.length - 1 && <div style={{height: '0.3rem'}} />}
            </span>
          );
        });
      } else {
        renderedContent.push(part);
      }
    });

    return renderedContent;
  };

  return (
    <>
      {renderContent(content)}
    </>
  );
});