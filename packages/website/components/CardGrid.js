import React from "react";
import { Card } from "/components/Card";
import styles from "/styles/CardGrid.module.css";

const CardGrid = ({ items }) => {
  return (
    <div className={styles.gridContainer}>
      {items.map((item, index) => (
        <div key={index}>
          <Card {...item} />
        </div>
      ))}
    </div>
  );
};

export default CardGrid;
