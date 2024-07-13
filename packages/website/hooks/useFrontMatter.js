// hooks/useFrontMatter.js
import { useState, useEffect } from 'react';

export const useFrontMatter = () => {
  const [frontMatter, setFrontMatter] = useState({});

  useEffect(() => {
    const fetchFrontMatter = async () => {
      const response = await fetch('/frontMatter.json');
      const data = await response.json();
      setFrontMatter(data);
    };

    fetchFrontMatter();
  }, []);

  return frontMatter;
};
