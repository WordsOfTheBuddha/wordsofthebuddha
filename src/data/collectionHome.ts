import { keyMap } from "../utils/transformId";

export type CollectionBadge = "new-translation";

export type HomeCollection = {
	slug: string;
	englishName: string;
	paliName: string;
	description: string;
	suffix: string;
	badge?: CollectionBadge;
};

/** Reader-friendly ordering: short Khuddaka entry points, four Nikāyas, then remaining Khuddaka. */
export const homeCollections: HomeCollection[] = [
	{
		slug: "dhp",
		englishName: keyMap.dhp,
		paliName: "Dhammapada",
		description:
			"Memorable verses on ethics, mindfulness, and liberation — an ideal first read.",
		suffix: "verses",
		badge: "new-translation",
	},
	{
		slug: "iti",
		englishName: keyMap.iti,
		paliName: "Itivuttaka",
		description:
			"Brief discourses framed as “thus it was said,” covering core teachings in compact form.",
		suffix: "sayings",
		badge: "new-translation",
	},
	{
		slug: "ud",
		englishName: keyMap.ud,
		paliName: "Udāna",
		description:
			"Inspired utterances spoken at moments of profound insight and realization.",
		suffix: "utterances",
		badge: "new-translation",
	},
	{
		slug: "dn",
		englishName: keyMap.dn,
		paliName: "Dīgha Nikāya",
		description:
			"The longest discourses — cosmology, meditation, ethics, and the Buddha's final days.",
		suffix: "discourses",
	},
	{
		slug: "mn",
		englishName: keyMap.mn,
		paliName: "Majjhima Nikāya",
		description:
			"Middle-length teachings balancing practical guidance with deep philosophical inquiry.",
		suffix: "discourses",
		badge: "new-translation",
	},
	{
		slug: "sn",
		englishName: keyMap.sn,
		paliName: "Saṁyutta Nikāya",
		description:
			"Discourses grouped by theme — dependent origination, the aggregates, and the path.",
		suffix: "discourses",
	},
	{
		slug: "an",
		englishName: keyMap.an,
		paliName: "Aṅguttara Nikāya",
		description:
			"Teachings organized in numbered sets, from daily practice to the highest attainments.",
		suffix: "discourses",
	},
	{
		slug: "snp",
		englishName: keyMap.snp,
		paliName: "Sutta Nipāta",
		description:
			"Early poetic discourses on simplicity, renunciation, and the heart of the path.",
		suffix: "teachings",
	},
	{
		slug: "kp",
		englishName: keyMap.kp,
		paliName: "Khuddakapāṭha",
		description:
			"Nine essential passages — refuge, precepts, and loving-kindness for daily recitation.",
		suffix: "passages",
		badge: "new-translation",
	},
];
