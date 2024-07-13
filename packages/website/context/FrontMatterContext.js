// context/FrontMatterContext.js
import React, { createContext, useContext } from 'react';

const FrontMatterContext = createContext({});

export const FrontMatterProvider = ({ children, frontMatter }) => (
  <FrontMatterContext.Provider value={frontMatter}>
    {children}
  </FrontMatterContext.Provider>
);

export const useFrontMatter = () => {
  return useContext(FrontMatterContext);
};
