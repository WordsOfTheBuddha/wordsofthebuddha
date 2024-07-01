const withNextra = require('nextra')({
    theme: 'nextra-theme-docs',
    themeConfig: './theme.config.jsx',
  });
  
  module.exports = withNextra({
    flexsearch: true,
    i18n: {
      locales: ['en', 'pli'],
      defaultLocale: 'en',
    }
  });
  