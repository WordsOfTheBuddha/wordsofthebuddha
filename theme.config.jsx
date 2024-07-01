export default {
  logo: <span>Words Of The Buddha</span>,
  project: {
    link: 'https://github.com/siddharthlatest/suttas'
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – WOTB'
    }
  },
  darkMode: true,
  docsRepositoryBase: 'https://github.com/siddharthlatest/suttas/tree/main/pages',
  i18n: [
    { locale: 'en', text: 'English' },
    { locale: 'pli', text: 'Pali' },
  ],
  search: {
    placeholder: 'Search the translations'
  },
  footer: {
    component: null,
  },
}