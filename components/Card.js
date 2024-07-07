// components/Card.js
import React from "react";
import styles from "/styles/Card.module.css";
import { useTheme } from "next-themes";

export const Card = ({ title, description, path, id }) => {
  const { theme } = useTheme();

  // Function to transform the ID based on character and digit boundaries
  const transformId = (id) => {
    if (typeof id !== "string") return "";
    return id.replace(/([a-zA-Z]+)(\d+)/, (_, chars, digits) => {
      return `${chars.toUpperCase()} ${digits}`;
    });
  };

  return (
    <div
      className={`${styles.card} ${
        theme === "dark" ? styles.dark : styles.light
      }`}
    >
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>
          <a href={path+id}>{transformId(id)}</a>
          <span>{title}</span>
        </h2>
        <p className={styles.cardDescription}>{description}</p>
      </div>
    </div>
  );
};

export default Card;
