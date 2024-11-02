import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import styles from "/styles/Card.module.css";
import { useTheme } from "next-themes";
import { useRouter } from "next/router";

export const Card = ({ title, description, path, id, updatedTime, counts, subtitle, image, author }) => {
  const { resolvedTheme } = useTheme();
  const { locale } = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  if (!isMounted) {
    // You can return null or a placeholder here if you want to avoid showing any content before the theme is resolved
    return null;
  }

  return (
    <div
      className={`${styles.card} ${
        resolvedTheme === "dark" ? styles.darkCard : styles.lightCard
      }`}
    >
      {count > 0 && <div className={styles.cardCount}>{count}</div>}
      {path.startsWith("/books") && image && (
        <img
          src={image}
          alt="Book Cover"
          className={styles.cardImage}
        />
      )}
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>
          {!path.startsWith("/books") && (
            <>
              <a href={'/' + id}>{transformId(id)}</a>
              <span>{title}</span>
            </>
          )}
          {path.startsWith("/books") && <a href={path + id}>{title}</a>}
        </h2>
        {path.startsWith("/books") && subtitle && <h3 className={styles.cardSubtitle}>{subtitle}</h3>}
        <p className={styles.cardDescription}>
          <ReactMarkdown>{description}</ReactMarkdown>
        </p>
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
