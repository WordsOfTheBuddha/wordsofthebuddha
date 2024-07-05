import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import styles from '/styles/NikayaTable.module.css';

export const NikayaTable = () => {
  const { theme } = useTheme();
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/translationCounts.json');
        const jsonData = await response.json();
        setData(jsonData);
      } catch (error) {
        console.error('Error fetching translation counts:', error);
      }
    };

    fetchData();
  }, []);

  if (!data) {
    return <p>Loading...</p>;
  }

  return (
    <div className={`${styles.tableContainer} ${theme === 'dark' ? styles['dark-theme'] : styles['light-theme']}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Section</th>
            <th>English Translation Count</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(data).map(key => (
            <tr key={key}>
              <td>{data[key].label}</td>
              <td>{data[key].translationCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default NikayaTable;
