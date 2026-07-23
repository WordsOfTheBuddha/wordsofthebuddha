import { playlists } from "./playlists.generated";
import { getCollectionVisual } from "../components/collection-covers/collectionVisuals";

export type StartHereEntryType = "anthology" | "listen";

export type StartHereEntry = {
	type: StartHereEntryType;
	title: string;
	/** One short contextual line — author, chapter, or format hint. */
	subtitle: string;
	imagePath?: string;
	accent: string;
	href: string;
	ctaLabel: string;
};

const itbw = playlists["in-the-buddhas-words"];
const ntnp = playlists["noble-truths-noble-path"];
const dhpVisual = getCollectionVisual("dhp");

/** Curated entry points for /discover — items not already shown as collection covers. */
export const discoverStartHereEntries: StartHereEntry[] = [
	{
		type: "anthology",
		title: itbw.title,
		subtitle: "Bhikkhu Bodhi · Anthology",
		imagePath: "/assets/in-the-buddha's-words.jpg",
		accent: "#6b5b4f",
		href: "/anthologies/in-the-buddhas-words",
		ctaLabel: "Read",
	},
	{
		type: "anthology",
		title: ntnp.title,
		subtitle: "Bhikkhu Bodhi · Anthology",
		imagePath: "/assets/noble-truths-noble-path-book-cover.jpeg",
		accent: "#8b5a6b",
		href: "/anthologies/noble-truths-noble-path",
		ctaLabel: "Read",
	},
	{
		type: "listen",
		title: "Dhammapada",
		subtitle: "Chapter 1 — Pairs · Audio",
		accent: dhpVisual.accent,
		href: "/listen/dhp1-20",
		ctaLabel: "Listen",
	},
];
