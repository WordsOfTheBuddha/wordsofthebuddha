export type ThanksPlace = {
	name: string;
	location?: string;
	note?: string;
};

export type ThanksPerson = {
	name: string;
	location?: string;
	note: string;
};

/** Monasteries and places of seclusion that have supported practice. */
export const thanksPlaces: ThanksPlace[] = [
	// { name: "…", location: "…", note: "seclusion and practice" },
	{ name: "Pa Pae Meditation Retreat", location: "Pa Pae, Thailand" },
	{ name: "Don Kiem Dhamma Hermitage", location: "Surat Thani, Thailand" },
	{ name: "Na Uyana Monastery", location: "Melsiripura, Sri Lanka" },
	{ name: "Bhala Ho Yoga Dham", location: "Uttarkashi, India" },
	{ name: "Joshi Cottage", location: "Binsar, India"},
	{ name: "Himlay Riverside Hotel", location: "Narainbagar, India"},
	{ name: "Sapumalgaskada Monastery", location: "Kelabogaswewa, Sri Lanka"},
	{ name: "Walagamba Monastery", location: "Galgamuwa, Sri Lanka"}
];

/** People who helped with time, expertise, or material support — not donation amounts. */
export const thanksPeople: ThanksPerson[] = [
	// { name: "…", location: "…", note: "…" },
];
