// components/Card.js
import React from 'react';
import styles from '/styles/Card.module.css';
import { useTheme } from 'next-themes';

export const Card = ({ title, description, link, id }) => {
  const { theme } = useTheme();

  return (
    <div className={`${styles.card} ${theme === 'dark' ? styles.dark : styles.light}`}>
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>
          <a href={link}>{id}</a>
          <span>{title}</span>
        </h2>
        <p className={styles.cardDescription}>{description}</p>
      </div>
    </div>
  );
};

export default Card;
