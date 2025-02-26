# Sutta Translation Flow

An interactive CLI tool for translating Pali Buddhist suttas to English with the help of LLM models.

## Features

- Fetches Pali text from source files
- Performs batch lookup of Pali words using dictionary API
- Translates paragraphs using DeepSeek models (Reasoner and Chat)
- Interactive human-in-the-loop workflow with VSCode integration
- Saves progress and allows resuming translation
- Supports additional instructions for refining translations
- Shows cURL commands for debugging
- Handles frontmatter and preserves proper formatting

## Installation

From the project root directory:

```bash
cd src/translation-flow
npm install
npm link  # Optional, to make command available globally
```

## Environment Variables

The tool looks for a `.env` file in the project root directory with:

- `DEEPSEEK_API_KEY`: Your DeepSeek API key (required for DeepSeek models)
- `API_BASE_URL`: Base URL for the Pali API (defaults to http://localhost:4321)

## Usage Examples

### Basic Translation

Start translating a sutta:

```bash
# Using the local script
node translation-cli.js sn15.8

# If globally linked
translate-sutta sn15.8
```

### Advanced Options

```bash
# Show debug information including full prompts
node translation-cli.js sn15.8 --debug

# Force retranslation of already translated paragraphs
node translation-cli.js sn15.8 --force

# Choose a specific DeepSeek model
node translation-cli.js sn15.8 --model deepseek-reasoner
node translation-cli.js sn15.8 --model deepseek-chat

# Add special instructions for the last translated paragraph
node translation-cli.js sn15.8 --instruction "Use simpler language and avoid religious terminology"
node translation-cli.js sn15.8 -i "Maintain the poetic style of the original"
node translation-cli.js sn15.8 -i "Translate in a more literal style, preserving Pali grammatical structure"
```

### Combining Options

Options can be combined:

```bash
# Refine last paragraph with instructions using the chat model and debug mode
node translation-cli.js sn15.8 -i "Make translation more accessible to beginners" -m deepseek-chat --debug
```

## File Management

The system handles two types of files:

1. **Raw translation files** (.md) - Stored in the `.work` directory, containing full LLM output including analytical translation
2. **Refined translation files** (.mdx) - Stored in the content directory, containing only the refined (Pass 2) translation

When translating paragraph by paragraph:
- The system properly updates the existing MDX file
- When editing the last paragraph with additional instructions, the content is correctly replaced, not appended
- Frontmatter is preserved with proper spacing
- All paragraphs maintain 1:1 correspondence with the Pali source

## Interactive Workflow

During the translation process, you'll be presented with several options for each paragraph:

- **Accept and continue** - Use the translation as-is and move to the next paragraph
- **Edit before saving** - Modify the translation before saving
  - *Use default editor* - Opens in your default terminal editor
  - *Use VSCode* - Opens in VSCode with proper saving
- **Show prompt used** - Display the prompt that was sent to the LLM
- **Retry with different settings** - Retry the current paragraph
- **Skip this paragraph** - Move to the next paragraph without saving

## Error Handling

If an error occurs during translation:
- **Retry API translation** - Try the API call again
- **Continue with current translation** - Use what was generated so far
- **Edit manually** - Open an editor to write a translation
- **Skip this paragraph** - Move to the next paragraph

## Workflow Overview

1. Load Pali text from source files
2. Parse into paragraphs and extract title
3. If necessary, translate the title separately
4. For each paragraph:
    - Extract words for dictionary lookup (ignoring text after em-dash and removing unicode quotes)
    - Make batch API call to get word meanings
    - Build LLM prompt using a template with context and word meanings
    - Apply any additional instructions if provided
    - Send to LLM for translation
    - Show translation to user for review/editing
    - Save progress in both raw and refined formats
5. Complete translation is saved to the English content directory with proper frontmatter

## Extending with New Models

1. Create a new service class in `services/llm/`
2. Add it to the registry in `services/llm-registry.js`
3. Update the cURL formatter in `utils/prompt-builder.js` if needed

## Future Enhancements

- Support for more LLM models (Claude, GPT-4, etc.)
- Additional analysis tools for Pali text
- Integration with review workflow
- Additional context from similar suttas
- Enhanced dictionary lookup with grammatical analysis
