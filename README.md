## Words of the Buddha Project

### Install and Setup

```
yarn && yarn dev
```

You would need to setup a .env file for configuring backend connection for running the project locally.

### Project Guide

#### Build & Development Commands

-   `yarn dev` - Start development server with route watcher
-   `yarn build` - Build production version
-   `yarn run watch-routes` - Watch for route changes
-   `astro check` - Run TypeScript type checking
-   `npx astro check` - Alternative type checking command

#### Code Style Guidelines

-   **TypeScript**: Use strict typing with interfaces in `/src/types`
-   **Imports**: Sort imports by external, then internal; group by type
-   **Components**: Use Astro components (.astro) where possible
-   **Naming**: camelCase for variables/functions, PascalCase for components/types
-   **MDX Content**: Buddhist suttas in `/src/content/` with parallel English/Pali files
-   **Error Handling**: Use type guards and nullish coalescing for optional values
-   **Formatting**: 2-space indentation, single quotes for strings
-   **Firebase**: All Firebase interactions should go through service layer

#### Project Structure

-   `/src/content/` - Buddhist suttas content (en/pli language folders)
-   `/src/components/` - Reusable UI components
-   `/src/layouts/` - Page layouts
-   `/src/service/` - Services for data management
-   `/src/utils/` - Utility functions
-   `/src/types/` - TypeScript type definitions
-   `/src/translation-flow/` - CLI workflow for Pali -> English translation pipeline, uses Pāli Dictionary and reasoner LLM to provide an initial paragraph-level translation

#### Conventions

-   Follow Astro's best practices for SSR/SSG
-   Use Tailwind for styling
-   Keep content processing functions in `/src/utils`
