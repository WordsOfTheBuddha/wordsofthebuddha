// pages/_app.js
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { MDXProvider } from "@mdx-js/react";
import TextEnhancer from "/components/TextEnhancer";
import HighlightLayout from "/components/HighlightLayout";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "/styles/globals.css"; // Import global CSS here

const components = {
  TextEnhancer,
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
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
      <MDXProvider components={components}>
		<HighlightLayout>
			<Component {...pageProps} />
			<Analytics />
			<SpeedInsights />
		</HighlightLayout>
      </MDXProvider>
    </ThemeProvider>
  );
}

export default MyApp;
