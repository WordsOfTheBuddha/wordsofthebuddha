import { directoryStructure } from "../data/directoryStructure";
import { transformId } from "../utils/transformId";
import { keyMap } from "./transformId";

export interface BreadcrumbItem {
	label: string;
	path: string;
	title?: string;
}

export function getBreadcrumbPath(idPath: string[]): BreadcrumbItem[] {
	const path: BreadcrumbItem[] = [{ label: "Home", path: "/" }];

	const id = idPath[idPath.length - 1];
	// Handle non-collection routes
	if (idPath[0] === "anthologies") {
		path.push({
			label: "Anthologies",
			path: "/anthologies",
		});
		path.push({
			label: keyMap[id],
			path: `/${id}`,
		});
		return path;
	}

	// Handle qualities pages
	if (idPath[0] === "qualities") {
		path.push({
			label: "Qualities",
			path: "/qualities",
		});
		return path;
	}
	// Extract prefix and numbers
	const prefix = id.match(/^[a-z]+/i)?.[0] || "";
	const [baseId, subNumber] = id.split(".");
	console.log("id: ", id, ", prefix: ", prefix);
	if (prefix && prefix in directoryStructure) {
		// Add collection level (e.g., "SN")
		const collection = directoryStructure[prefix];
		path.push({
			label: prefix.toUpperCase(),
			path: `/${prefix}`,
			title: collection.title,
		});
		if (!collection.children) {
			if (id !== prefix) {
				path.push({
					label: transformId(id),
					path: `/${id}`,
				});
			}
			return path;
		}

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
				collection.children,
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
						if (baseId !== id) {
							path.push({
								label: transformId(id),
								path: `/${id}`,
							});
						}
					} else {
						path.push({
							label: transformId(id),
							path: `/${id}`,
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
			if (baseId !== id) {
				path.push({
					label: transformId(id),
					path: `/${id}`,
				});
			}
			return path;
		}
	}

	return path;
}
