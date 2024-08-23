import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import styles from "/styles/NikayaTable.module.css";

const fallbackTranslationsCounts = {
  "sn": {
    "label": "Linked Discourses (SN)",
    "translationCount": 130
  },
  "an": {
    "label": "Numbered Discourses (AN)",
    "translationCount": 231
  },
  "mn": {
    "label": "Middle Length Discourses (MN)",
    "translationCount": 18
  },
  "snp": {
    "label": "Sutta Nipāta (SnP)",
    "translationCount": 10
  },
  "dhp": {
    "label": "Dhamma Pada (DhP)",
    "translationCount": 59
  },
  "iti": {
    "label": "As It Was Said (ITI)",
    "translationCount": 19
  },
  "ud": {
    "label": "Inspired Utterances (Ud)",
    "translationCount": 10
  }
};

export const NikayaTable = () => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
      setData(fallbackTranslationsCounts);
  }, []);

  if (!mounted || !data) {
    return <p>Loading...</p>;
  }

  return (
    <div
      className={`${styles.tableContainer} ${
        resolvedTheme === "dark" ? styles["dark-theme"] : styles["light-theme"]
      }`}
    >
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Section</th>
            <th>English Translation Count</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(data).map((key) => (
            <tr key={key}>
              <td>
                <a href={key}>{data[key].label}</a>
              </td>
              <td>{data[key].translationCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default NikayaTable;