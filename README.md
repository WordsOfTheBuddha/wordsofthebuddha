## Words of the Buddha Project

### Install and Setup

```
yarn && yarn dev
```

You would need to setup a .env file for configuring backend connection for running the project locally.

### Project Guide

#### Build & Development Commands

- `yarn dev` - Start development server with route watcher
- `yarn build` - Build production version
- `yarn run watch-routes` - Watch for route changes
- `astro check` - Run TypeScript type checking
- `npx astro check` - Alternative type checking command

#### Code Style Guidelines

- **TypeScript**: Use strict typing with interfaces in `/src/types`
- **Imports**: Sort imports by external, then internal; group by type
- **Components**: Use Astro components (.astro) where possible
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **MDX Content**: Buddhist suttas in `/src/content/` with parallel English/Pali files
- **Error Handling**: Use type guards and nullish coalescing for optional values
- **Formatting**: 2-space indentation, single quotes for strings
- **Firebase**: All Firebase interactions should go through service layer

#### Project Structure

- `/src/content/` - Buddhist suttas content (en/pli language folders)
- `/src/components/` - Reusable UI components
- `/src/layouts/` - Page layouts
- `/src/service/` - Services for data management
- `/src/utils/` - Utility functions
- `/src/types/` - TypeScript type definitions
- `/src/translation-flow/` - CLI workflow for Pali -> English translation pipeline, uses Pāli Dictionary and reasoner LLM to provide an initial paragraph-level translation

#### Conventions

- Follow Astro's best practices for SSR/SSG
- Use Tailwind for styling
- Keep content processing functions in `/src/utils`

### Translation Memory (Dev Mode)

The Translation Memory feature helps find similar Pali passages with existing translations. It's available in dev mode only.

#### Debug Console Functions

When viewing any discourse page in dev mode, you can use `tmDebug` in the browser console:

```javascript
// First, load the translation memory index
await tmDebug.loadIndex();

// Get index statistics
tmDebug.getIndexStats();
// => { entries: 11132, ngrams: 135619, ngramSize: 5, version: 2 }

// Check how text is normalized and tokenized
tmDebug.getWords("Katame pañca? Seyyathidaṁ—rūpupādānakkhandho...");
// => { all: [...], content: [...], totalCount: 10, contentCount: 8 }

// Check if a word is a stop word
tmDebug.isStopWord("kho"); // true
tmDebug.isStopWord("bhagavā"); // false

// Find matches for any Pali text (returns JSON for easy copy/paste)
tmDebug.findMatchesJSON("Your Pali paragraph here", "sn47.102");

// Get Pali paragraphs from current page
tmDebug.getPaliParagraphs();

// Find matches for paragraphs on current page
await tmDebug.findPageMatches(); // All paragraphs
await tmDebug.findPageMatches(3); // Just paragraph 3
await tmDebug.findPageMatches(1, 5); // Paragraphs 1-5
```

#### How It Works

1. **N-gram Index**: At dev startup, a 5-gram index is built from all translated paragraphs
2. **Matching**: When viewing a paragraph, ngrams are looked up to find candidate entries
3. **Grouping**: Similar matches are grouped by content words (stop words ignored)
4. **Subset Detection**: Smaller phrase matches are merged into larger containing matches
