/**
 * Parse text into paragraphs, handling frontmatter
 * @param {string} text - Full text content
 * @returns {Object} Object containing paragraphs and title
 */
export function parseParagraphs(text) {
  if (!text) return { paragraphs: [], title: '' };
  
  // Check for frontmatter (---) and extract it
  let title = '';
  let mainContent = text;
  
  if (text.startsWith('---')) {
    // Extract frontmatter
    const secondDash = text.indexOf('---', 3);
    if (secondDash !== -1) {
      const frontmatter = text.substring(3, secondDash);
      
      // Extract title from frontmatter
      const titleMatch = frontmatter.match(/title:\s*([^\n]+)/);
      if (titleMatch && titleMatch[1]) {
        // Get title, excluding "sutta" if present
        const fullTitle = titleMatch[1].trim();
        if (fullTitle.toLowerCase().includes(' sutta')) {
          // Only use the part before "sutta"
          title = fullTitle.split(' sutta')[0].trim();
        } else {
          title = fullTitle;
        }
      }
      
      // Remove frontmatter from main content
      mainContent = text.substring(secondDash + 3).trim();
    }
  }
  
  // Split on double newlines to separate paragraphs
  const paragraphs = mainContent.split(/\n{2,}/);
  
  // Filter out empty paragraphs and trim each one
  const parsedParagraphs = paragraphs
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  // Return both paragraphs and the extracted title
  return {
    paragraphs: parsedParagraphs,
    title
  };
}

/**
 * Extract words from a paragraph for lookup, excluding certain characters
 * @param {string} paragraph Pali paragraph
 * @returns {string[]} Array of words
 */
export function extractWords(paragraph) {
  if (!paragraph) return [];
  
  // Remove words after em-dash
  const textBeforeEmdash = paragraph.split('—')[0];
  
  // Replace unicode quotes with empty strings
  // \u201C = " (left double quotation mark)
  // \u201D = " (right double quotation mark)
  // \u02BB = ʻ (modifier letter turned comma)
  // \u02BC = ʼ (modifier letter apostrophe)
  const textWithoutQuotes = textBeforeEmdash
    .replace(/[\u201C\u201D\u02BB\u02BC]/g, '');
  
  // Split by whitespace 
  const words = textWithoutQuotes
    .split(/\s+/)
    // Remove punctuation and special characters
    .map(word => word.replace(/[.,;'"!?()]/g, ''))
    // Remove empty words
    .filter(word => word.length > 0);
  
  return words;
}