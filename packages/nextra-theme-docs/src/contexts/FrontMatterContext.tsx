import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchFrontMatter } from "../utils/api";

interface FrontMatterEntry {
  title: string;
  description: string;
  fetter: string;
  tags: string;
  id: string;
  path: string;
  updatedTime: string;
}

export interface FrontMatter {
  [key: string]: FrontMatterEntry;
}

interface FrontMatterContextType {
  dfrontMatter: FrontMatter | null;
  setFrontMatter: (data: FrontMatter) => void;
}

const FrontMatterContext = createContext<FrontMatterContextType | undefined>(
  undefined
);

const CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

export const FrontMatterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [dfrontMatter, setFrontMatter] = useState<FrontMatter | null>(null);

  useEffect(() => {
    const storedFrontMatter = localStorage.getItem("frontMatter");
    const storedTimestamp = localStorage.getItem("frontMatterTimestamp");

    const isCacheValid =
      storedFrontMatter &&
      storedTimestamp &&
      Date.now() - parseInt(storedTimestamp, 10) < CACHE_DURATION;

    if (isCacheValid) {
      setFrontMatter(JSON.parse(storedFrontMatter));
    } else {
      fetchFrontMatter()
        .then((data: FrontMatter) => {
          setFrontMatter(data);
          localStorage.setItem("frontMatter", JSON.stringify(data));
          localStorage.setItem("frontMatterTimestamp", Date.now().toString());
        })
        .catch((error: Error) =>
          console.error("Failed to fetch frontMatter:", error)
        );
    }
  }, []);

  return (
    <FrontMatterContext.Provider value={{ dfrontMatter, setFrontMatter }}>
      {children}
    </FrontMatterContext.Provider>
  );
};

export const useFrontMatter = (): FrontMatterContextType => {
  const context = useContext(FrontMatterContext);
  if (!context) {
    throw new Error("useFrontMatter must be used within a FrontMatterProvider");
  }
  return context;
};
