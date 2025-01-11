import React, { useEffect, useState } from "react";
import CardGrid from "/components/CardGrid";
import frontMatter from "/public/frontMatter.json";

export const LatestTranslations = ({ count, locale }) => {
	const [translations, setTranslations] = useState([]);
	if (!locale) {
		locale = "en";
	}

	const parseRange = (idStr) => {
		// e.g. "dhp273-289" => [273, 289]
		// e.g. "dhp273" => [273, 273]
		const match = idStr.match(/^dhp(\d+)(?:-(\d+))?$/);
		if (!match) return null;
		const start = parseInt(match[1], 10);
		const end = match[2] ? parseInt(match[2], 10) : start;
		return [start, end];
	};

	useEffect(() => {
		const fetchData = async () => {
			try {
				// Sort by updated time
				const sortedData = Object.entries(frontMatter)
					.filter(
						([key]) => key.endsWith(`.${locale}`) && !key.startsWith("index")
					)
					.sort(
						([, a], [, b]) => new Date(b.updatedTime) - new Date(a.updatedTime)
					).slice(0, count*15);

				const finalList = [];
				const includedRanges = [];

				for (const [key, value] of sortedData) {
					const filename = key.replace(`.${locale}`, ""); // e.g. "dhp273-289"
					const [start, end] = parseRange(filename) || [];

					// Check if it’s already covered by a previous range
					const isWithinIncludedRange = includedRanges.some(
						([rStart, rEnd]) => {
							return start >= rStart && end <= rEnd;
						}
					);

					// Only add if not covered
					if (!isWithinIncludedRange) {
						finalList.push({
							id: filename,
							title: value.title,
							description: value.description,
							path: value.path,
							updatedTime: value.updatedTime,
						});
						// If it's a range, record it
						if (start && end && start !== end) {
							includedRanges.push([start, end]);
						}
					}
				}

				// Finally slice to "count"
				setTranslations(finalList.slice(0, count));
			} catch (error) {
				console.error("Error processing translation data:", error);
			}
		};

		fetchData();
	}, [count, locale]);

	return (
		<div>
			<CardGrid items={translations} />
		</div>
	);
};

export default LatestTranslations;
