// pages/_app.js
import { ThemeProvider } from "next-themes";
import { MDXProvider } from "@mdx-js/react";
import Verse from "/components/Verse";
import RedditIcon from "/components/RedditIcon";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "/styles/globals.css"; // Import global CSS here

const components = {
  Verse,
  RedditIcon,
};

function MyApp({ Component, pageProps }) {
  return (
    <ThemeProvider attribute="class">
      <MDXProvider components={components}>
        <Component {...pageProps} />
        <Analytics />
        <SpeedInsights />
      </MDXProvider>
    </ThemeProvider>
  );
}

export default MyApp;
