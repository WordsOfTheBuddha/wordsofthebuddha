## Words of the Buddha Project

### Install and Setup

```
yarn && yarn dev
```

You would need to setup a .env file for configuring backend connection for running the project locally.

### Project structure

src/
├── content/
│   ├── en/
│   │   └── an/an1.1-10.mdx            # English content
|   |   └── ${collection}/${file}.mdx  # other collections, files
│   └── pli/
│       └── ${collection}/${file}.md   # Pali content
├── pages/                             # Astro HTML pages, API endpoints
├── layouts/
│   └── layout.astro                   # Main layout
├── components/
│   └── ${component}.astro             # UI components
├── firebase/
│   ├── server.ts
│   └── client.ts
├── middleware/
│   ├── auth.ts
|
├── service/
|   ├── {service}.ts                   # Client API consumer, UI service
|
├── types/
|   └── ${type}.ts
├──utils/
    └── ${util}.js,.ts