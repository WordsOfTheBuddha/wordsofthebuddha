import { directoryStructure } from "../data/directoryStructure";
import { transformId } from "../utils/transformId";

export interface BreadcrumbItem {
	label: string;
	path: string;
	title?: string;
}

export function getBreadcrumbPath(id: string): BreadcrumbItem[] {
	const path: BreadcrumbItem[] = [{ label: "Home", path: "/" }];

	// Extract prefix and numbers
	const prefix = id.match(/^[a-z]+/i)?.[0] || "";
	const [baseId, subNumber] = id.split(".");

	if (prefix && prefix in directoryStructure) {
		// Add collection level (e.g., "SN")
		const collection = directoryStructure[prefix];
		path.push({
			label: prefix.toUpperCase(),
			path: `/${prefix}`,
			title: collection.title,
		});

		// If the id is a range key or a direct child, add it once
		if (collection.children?.[id]) {
			const child = collection.children[id];
			path.push({
				label: transformId(id),
				path: `/${id}`,
				title: child.title,
			});
			return path;
		}

		// Otherwise, look for matching range
		const num = parseInt(baseId.replace(prefix, ""));
		if (collection.children) {
			for (const [rangeKey, rangeData] of Object.entries(
				collection.children
			)) {
				if (
					rangeData.range &&
					num >= rangeData.range.start &&
					num <= rangeData.range.end
				) {
					path.push({
						label: transformId(rangeKey),
						path: `/${rangeKey}`,
						title: rangeData.title,
					});
					// Check if there is a baseId level match in a child of the range
					if (rangeData.children?.[baseId]) {
						const child = rangeData.children[baseId];
						path.push({
							label: transformId(baseId),
							path: `/${baseId}`,
							title: child.title,
						});
					}
					break;
				}
			}
		}

		// Add the baseId level if present
		if (collection.children?.[baseId]) {
			const child = collection.children[baseId];
			path.push({
				label: transformId(baseId),
				path: `/${baseId}`,
				title: child.title,
			});
			return path;
		}
	}

	return path;
}
