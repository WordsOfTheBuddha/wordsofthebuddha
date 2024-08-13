// pages/_app.js
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { MDXProvider } from "@mdx-js/react";
import TextEnhancer from "/components/TextEnhancer";
import RedditIcon from "/components/RedditIcon";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "/styles/globals.css"; // Import global CSS here

const components = {
  TextEnhancer,
  RedditIcon,
};

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    fetch(window.location.href).then((response) => {
      const fragment = response.headers.get("X-Redirect-Fragment");
      if (fragment) {
        window.location.hash = fragment;
      }
    });
  }, []);

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
