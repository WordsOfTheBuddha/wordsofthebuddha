# Collection PDF Generation Setup

## Installation

To enable collection PDF generation, you need to install Playwright:

```bash
npm install playwright
# or
yarn add playwright

# Install browser binaries
npx playwright install chromium
```

## Dependencies Added

The following new dependencies are required:
- `playwright` - For PDF generation
- `jsdom` - Already installed (for server-side DOM manipulation)

## Features Implemented

### 1. Collection Print Button (`CollectionPrintButton.astro`)
- Appears on collection pages when viewing discourses
- Downloads a professionally formatted PDF of the entire collection
- Shows loading states and error handling

### 2. Server-side PDF Generation (`/api/print-collection/[...slug].ts`)
- Fetches all discourse content from collections and sub-collections
- Applies rich tooltip formatting (same logic as copy button)
- Generates PDF with **accurate page numbers** using DOM measurement
- Uses single-pass approach for optimal performance
- Handles nested collection structures automatically

### 3. Rich Content Formatting (`serverPrintFormatter.ts`)
- Reuses tooltip formatting logic from `tooltipFormatter.ts`
- Supports both inline and footnoted tooltips
- Handles Pali terms and definitions

## PDF Structure

1. **Intro Page**: Collection title, description, metadata
2. **Table of Contents**: List of all discourses with page numbers
3. **Individual Discourses**: Each discourse on separate pages with:
   - Formatted tooltips (inline or footnoted based on threshold)
   - Proper typography and spacing
   - Page breaks between discourses

## Usage

1. Navigate to any collection page (e.g., `/snp2`)
2. Switch to "Discourses" view
3. Click "Download Collection PDF" button
4. PDF will be generated and automatically downloaded

## Configuration

- **Tooltip Threshold**: Uses the same threshold as the copy button
- **Page Limit**: Currently limited to 50 discourses per collection (configurable)
- **Batch Processing**: Processes 5 discourses at a time to avoid server overload

## Error Handling

- Failed discourse fetches don't break the entire PDF generation
- Graceful fallbacks for missing content
- User feedback for all error states
- Loading indicators during generation

## Performance Considerations

- Batched processing to avoid overwhelming the server
- Browser reuse for multiple PDF generations
- Memory cleanup after each generation
- Reasonable timeouts for large collections

## Accurate Page Numbering System

The PDF generation uses a sophisticated single-pass approach for **100% accurate page numbers**:

### How It Works
1. **Generate Measurable HTML**: Creates HTML with CSS page breaks and measurement hooks
2. **DOM Measurement**: Uses Playwright to render content and measure actual page positions
3. **Page Number Calculation**: JavaScript calculates exact page numbers based on rendered content height
4. **ToC Update**: Updates Table of Contents with accurate page references
5. **Final PDF Generation**: Generates PDF with correct page numbers

### Benefits
- ✅ **100% Accurate**: Page numbers match actual PDF pages
- ✅ **Single Pass**: No double rendering overhead  
- ✅ **Accounts for Everything**: Descriptions, footnotes, variable content lengths
- ✅ **Browser-Native**: Uses same engine that generates the PDF
- ✅ **Fast & Reliable**: Simple DOM measurement approach

### Technical Details
- Uses A4 page dimensions with proper margin calculations
- Accounts for intro page, ToC page, and individual discourse sections
- Measures actual rendered heights to determine page spans
- Updates ToC placeholders with real page numbers before PDF generation
