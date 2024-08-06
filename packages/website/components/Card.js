import React from "react";
import styles from "/styles/Card.module.css";
import { useTheme } from "next-themes";
import { useRouter } from "next/router";

export const Card = ({ title, description, path, id, updatedTime, counts }) => {
  const { resolvedTheme } = useTheme();
  const { locale } = useRouter();

  // Function to transform the ID based on character and digit boundaries
  const transformId = (id) => {
    if (typeof id !== "string") return "";
    return id.replace(/([a-zA-Z]+)(\d+)/, (_, chars, digits) => {
      return `${chars.toUpperCase()} ${digits}`;
    });
  };

  const formattedDate = updatedTime
    ? new Date(updatedTime).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // Default to 'en' if no locale is specified
  const currentLocale = locale || "en";
  const count = counts && counts[currentLocale] ? counts[currentLocale] : 0;

  return (
    <div
      className={`${styles.card} ${
        resolvedTheme === "dark" ? styles.darkCard : styles.lightCard
      }`}
    >
      {count > 0 && <div className={styles.cardCount}>{count}</div>}
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>
          <a href={path + id}>{transformId(id)}</a>
          <span>{title}</span>
        </h2>
        <p className={styles.cardDescription}>{description}</p>
        {updatedTime && (
          <div
            className={`${styles.updatedTime} nx-text-xs nx-text-gray-500 ltr:nx-text-right rtl:nx-text-left dark:nx-text-gray-400`}
          >
            Last updated on <time dateTime={updatedTime}>{formattedDate}</time>
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;
