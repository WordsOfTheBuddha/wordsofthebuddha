# Translation Workflow Pipeline

This document outlines the translation workflow pipeline structure, which can be extended with additional steps.

## Workflow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Load Pali Text │────▶│ Check Existing  │────▶│ Parse           │
│                 │     │  Translation    │     │  Paragraphs     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Save           │◀────│ User Review     │◀────│ Translate       │
│  Translation    │     │  & Editing      │     │  Paragraph      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │                 │
                                               │ Process Next    │
                                               │  Paragraph      │
                                               │                 │
                                               └─────────────────┘
```

## Detailed Steps

### 1. Load Pali Text
- **Input**: Sutta ID (e.g., an3.131)
- **Process**: Locate and load Pali text file from content directory
- **Output**: Raw Pali text content

### 2. Check Existing Translation
- **Input**: Sutta ID
- **Process**: Check if translation exists, load if available
- **Output**: Existing translation or null

### 3. Parse Paragraphs
- **Input**: Raw Pali text
- **Process**: Split text into paragraphs by double newlines
- **Output**: Array of Pali paragraphs

### 4. Translate Paragraph
- **Input**: Pali paragraph, previous translations
- **Process**:
  - Extract words from paragraph (ignoring text after em-dash and removing unicode quotes: ", ", ʻ, ʼ)
  - Look up words in dictionary API
  - Build prompt using a template with word meanings and context
  - Send to LLM model for translation
- **Output**: Translated paragraph

### 5. User Review & Editing
- **Input**: Translation from LLM
- **Process**: 
  - Display translation to user
  - Provide options to accept, edit, retry, or view prompt
  - If edit, open editor for user modifications
- **Output**: Final translated paragraph

### 6. Save Translation
- **Input**: Translated paragraphs
- **Process**: Save to English content directory with same structure
- **Output**: Updated translation file

### 7. Process Next Paragraph
- **Input**: Next paragraph index
- **Process**: Loop back to step 4 for next paragraph
- **Output**: Full translation when complete

## Extension Points

The workflow can be extended at various points:

1. **Pre-translation processing**:
   - Add similar sutta references
   - Add contextual notes
   - Linguistic analysis

2. **Translation enhancement**:
   - Add multiple LLM models
   - Add specialized Buddhist terminology glossary
   - Custom formatting rules

3. **Post-translation processing**:
   - Quality checks
   - Consistency validation
   - Style standardization

4. **Review workflow**:
   - Peer review integration
   - Version comparison
   - Quality metrics