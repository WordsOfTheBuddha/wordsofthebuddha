/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            color: "var(--text-color)",
            a: {
              color: "var(--link-color)",
              "&:hover": {
                color: "var(--link-hover-color)",
              },
            },
            strong: {
              color: "var(--text-color)",
            },
            // Add more customizations as needed
          },
        },
      },
      colors: {
        "icon-fill": {
          light: "var(--icon-fill-color-light)",
          dark: "var(--icon-fill-color-dark)",
        },
        "bookmark-fill": {
          light: "var(--bookmark-fill-color-light)",
          dark: "var(--bookmark-fill-color-dark)",
        },
        "text-color": {
          light: "var(--text-color-light)",
          dark: "var(--text-color-dark)",
        },
        "background-color": {
          light: "var(--background-color-light)",
          dark: "var(--background-color-dark)",
        },
        "primary-color": {
          light: "var(--primary-color-light)",
          dark: "var(--primary-color-dark)",
        },
        "secondary-color": {
          light: "var(--secondary-color-light)",
          dark: "var(--secondary-color-dark)",
        },
        "link-color": {
          light: "var(--link-color-light)",
          dark: "var(--link-color-dark)",
        },
        "link-hover-color": {
          light: "var(--link-hover-color-light)",
          dark: "var(--link-hover-color-dark)",
        },
        // Add other colors as needed
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
