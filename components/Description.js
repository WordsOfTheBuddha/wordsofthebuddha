import React from 'react';
import { useConfig } from 'nextra-theme-docs';
import { Callout } from 'nextra/components';
import styles from '/styles/Description.module.css';

export function Description({ description }) {
  const { frontMatter } = useConfig();
  const displayDescription = description || frontMatter.description;

  return (
    displayDescription && (
      <div className={styles.description}>
        <Callout type="info" emoji="ⓘ">
          <p>{displayDescription}</p>
        </Callout>
      </div>
    )
  );
}

export default Description;
