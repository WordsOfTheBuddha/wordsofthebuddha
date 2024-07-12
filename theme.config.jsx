// Ensure you have the correct import at the top of your file
import { useConfig } from "nextra-theme-docs";
import { useRouter } from "next/router";
import Title from "/components/Title";
import Description from "/components/Description";
import Verse from "/components/Verse";
import RedditIcon from "/components/RedditIcon";

export default {
	logo: <span>Words Of The Buddha</span>,
	components: {
		p: (props) => {
			return <Verse>{props.children}</Verse>;
		},
	},
	head() {
		const { frontMatter } = useConfig();
		const router = useRouter();
		const { asPath } = router;

		// Split the path and get the last segment
		const pathSegments = asPath.split("/");
		const pageName = pathSegments[pathSegments.length - 1];

		let title = "Words of the Buddha";
		console.log("frontMatter title: ", frontMatter.title);
		if (frontMatter.title !== "" && pageName !== "") {
			title = `${pageName} - ${frontMatter.title}`;
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
		"https://github.com/siddharthlatest/suttas/tree/main/pages",
	main: ({ children }) => {
		return (
			<div>
				<Title />
				<Description />
				<br />
				{children}
			</div>
		);
	},
	search: {
		placeholder: "Search the translations",
	},
	footer: {
		component: null,
	},
	faviconGlyph: "📜",
	themeSwitch: {
		useOptions() {
			return {
				light: "Light",
				dark: "Dark",
				system: "System",
			};
		},
	},
	editLink: {
		component: null,
	},
	feedback: {
		content: null,
	},
	sidebar: {
		toggleButton: true,
		defaultMenuCollapseLevel: 0,
	},
};
