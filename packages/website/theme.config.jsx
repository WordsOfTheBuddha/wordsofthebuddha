// Ensure you have the correct import at the top of your file
import { useConfig } from "nextra-theme-docs";
import { useRouter } from "next/router";
import Title from "/components/Title";
import Description from "/components/Description";
import TextEnhancer from "/components/TextEnhancer";
import RedditIcon from "/components/RedditIcon";
import GitHubIcon from "/components/GitHubIcon";

export default {
  logo: <span>Words Of The Buddha</span>,
  components: {
    p: (props) => {
      return <TextEnhancer>{props.children}</TextEnhancer>;
    },
  },
  head() {
    const { frontMatter } = useConfig();
    const router = useRouter();
    const { asPath } = router;

    // Split the path and get the last segment
    const pathSegments = asPath.split("/");
    const transformLabel = (name) => {
      // Capitalize all initial characters before the first number and add space before the first number
      return name.replace(/([a-zA-Z]+)(\d)?/, (match, p1, p2) =>
        p2 ? `${p1.toUpperCase()} ${p2}` : p1.toUpperCase()
      );
    };

    const pageName = transformLabel(pathSegments[pathSegments.length - 1]);

    let title = "Words of the Buddha";
    if (frontMatter.title) {
      title = frontMatter.title;
    }
    if (pageName !== "") {
      title = `${pageName} ${title}`;
    }

    return (
      <>
        <title>{`${title}`}</title>
        <meta name="title" content={`${title}`} />
        <meta
          name="description"
          content={
            frontMatter.description ||
            `Read the words of the Buddha from ${pageName}`
          }
        />
      </>
    );
  },
  darkMode: true,
  docsRepositoryBase:
    "https://github.com/wordsofthebuddha/wordsofthebuddha/tree/main/packages/website",
  main: ({ children }) => {
    return (
      <div>
        <Description />
        <Title />
        {children}
      </div>
    );
  },
  search: {
    placeholder: "Search a discourse",
  },
  toc: {
    extraContent: <div></div>,
    backToTop: true,
  },
  footer: {
    component: null,
  },
  themeSwitch: {
    useOptions() {
      return {
        light: "Light",
        dark: "Dark",
        system: "System",
      };
    },
  },
  chat: {
    link: 'https://github.com/WordsOfTheBuddha/wordsofthebuddha/discussions',
    icon: <GitHubIcon />,
  },
  feedback: {
    content: null,
  },
  sidebar: {
    toggleButton: false,
    defaultMenuCollapseLevel: 1,
  },
};
