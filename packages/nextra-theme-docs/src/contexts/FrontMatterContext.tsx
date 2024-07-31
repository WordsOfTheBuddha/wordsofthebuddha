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

export const FrontMatterProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [dfrontMatter, setFrontMatter] = useState<FrontMatter | null>(null);

  useEffect(() => {
    // Check if frontMatter is already stored in localStorage
    const storedFrontMatter = localStorage.getItem("frontMatter");
    if (storedFrontMatter) {
      setFrontMatter(JSON.parse(storedFrontMatter));
    } else {
      // Fetch frontMatter from the API and store it in localStorage
      fetchFrontMatter()
        .then((data: FrontMatter) => {
          setFrontMatter(data);
          localStorage.setItem("frontMatter", JSON.stringify(data));
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
