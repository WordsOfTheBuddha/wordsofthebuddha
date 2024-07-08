import React, { useEffect, useState } from "react";
import CardGrid from "/components/CardGrid";
import frontMatter from "/public/frontMatter.json";

export const LatestTranslations = ({ count, locale }) => {
  const [translations, setTranslations] = useState([]);
  if (!locale) {
    locale = "en";
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sortedData = Object.entries(frontMatter)
          .filter(([key]) => key.endsWith(`.${locale}`))
          .sort(([, a], [, b]) => new Date(b.updatedTime) - new Date(a.updatedTime))
          .slice(0, count)
          .map(([key, value]) => {
            const id = key.replace(`.${locale}`, '');
            return {
              id,
              title: value.title,
              description: value.description,
              path: value.path,
              updatedTime: value.updatedTime
            };
          });
        setTranslations(sortedData);
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