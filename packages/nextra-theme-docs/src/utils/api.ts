import { FrontMatter } from "../contexts/FrontMatterContext";

export const fetchFrontMatter = async (): Promise<FrontMatter> => {
  const response = await fetch("/frontMatter.json");
  if (!response.ok) {
    throw new Error("Failed to fetch frontMatter");
  }
  return response.json();
};
