import qualities from "../data/qualities.json";

export function getQualityContentType(qualitySlug: string): "bright-quality" | "negative-quality" | "neutral-quality" {
  if (qualities.positive.includes(qualitySlug)) return "bright-quality";
  if (qualities.negative.includes(qualitySlug)) return "negative-quality";
  return "neutral-quality";
}

export function getContentTypeFromApiData(item: any): "bright-quality" | "negative-quality" | "neutral-quality" | "simile" | "topic" | "person" {
  if (item.type === "quality") {
    return getQualityContentType(item.slug);
  }
  return item.type as "simile" | "topic" | "person";
}