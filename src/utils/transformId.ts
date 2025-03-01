// src/utils/transformId.ts
export const keyMap: { [key: string]: string } = {
	dhp: "DhammaPada",
	mn: "Middle Length Discourses",
	ud: "Udāna",
	sn: "Linked Discourses",
	snp: "Sutta Nipāta",
	an: "Numerical Discourses",
	iti: "As It Was Said",
	anthologies: "Anthologies",
	"noble-truths-noble-path": "Noble Truths, Noble Path",
	"in-the-buddhas-words": "In the Buddha's Words",
};

// Function to transform the ID based on character and digit boundaries
export const transformId = (id: string) => {
	if (typeof id !== "string") return "";
	id = keyMap[id] || id;
	return id.replace(/([a-zA-Z]+)(\d+)/, (_, chars, digits) => {
		return `${chars.toUpperCase()} ${digits}`;
	});
};

export const getSlugId = (id: string) => {
	if (typeof id !== "string") return "";
	id = keyMap[id] || id;
	return id.replace(/([a-zA-Z]+) (\d+)/, (_, chars, digits) => {
		return `${chars.toLowerCase()}${digits}`;
	});
};
