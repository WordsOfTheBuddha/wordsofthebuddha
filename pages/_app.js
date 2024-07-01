// pages/_app.js
import { ThemeProvider } from 'next-themes';
import { MDXProvider } from '@mdx-js/react';
import Verse from '/components/Verse';
import RedditIcon from '/components/RedditIcon';
import '/styles/globals.css'; // Import global CSS here

const components = {
  Verse,
  RedditIcon,
};

function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider attribute="class">
      <MDXProvider components={components}>
        <Component {...pageProps} />
      </MDXProvider>
    </ThemeProvider>
  );
}

export default MyApp;
