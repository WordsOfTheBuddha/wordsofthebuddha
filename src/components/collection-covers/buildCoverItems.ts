import { collectionAvailability } from "../../data/collectionAvailability";
import { homeCollections } from "../../data/collectionHome";
import { countCollectionIllustratedDiscourses } from "../../utils/contentImage";
import {
	collectionHasListeningMode,
	collectionListenHref,
} from "../../utils/listenMode";
import type { CollectionCoverItem } from "./collectionVisuals";

/** Minimum share of discourses illustrated before showing the cover label. */
const ILLUSTRATED_LABEL_THRESHOLD = 0.05;

export function buildCoverItems(): CollectionCoverItem[] {
	return homeCollections.map(
		({ slug, englishName, paliName, suffix, badge }) => {
			const avail = collectionAvailability[slug];
			const translatedCount = avail?.translatedCount ?? 0;
			const readableCount = avail?.readableCount ?? avail?.total ?? 0;
			const total = avail?.total ?? 0;
			const count = avail?.readableCount ?? avail?.total ?? 0;
			const illustratedCount = countCollectionIllustratedDiscourses(slug);
			const showIllustratedLabel =
				illustratedCount > 0 &&
				count > 0 &&
				illustratedCount / count >= ILLUSTRATED_LABEL_THRESHOLD;
			const hasListeningMode = collectionHasListeningMode(slug);
			const listenHref = hasListeningMode
				? (collectionListenHref(slug) ?? undefined)
				: undefined;

			return {
				slug,
				englishName,
				paliName,
				suffix,
				badge,
				translatedCount,
				readableCount,
				total,
				count,
				...(showIllustratedLabel ? { illustratedCount } : {}),
				...(hasListeningMode && listenHref
					? { hasListeningMode: true, listenHref }
					: {}),
			};
		},
	);
}
