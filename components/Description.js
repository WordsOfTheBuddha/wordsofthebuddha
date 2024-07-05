import React from 'react';
import { useConfig } from 'nextra-theme-docs';
import { Callout } from 'nextra/components';

export function Description({ description }) {
  const { frontMatter } = useConfig();
  const displayDescription = description || frontMatter.description;

  return (
    displayDescription && (
        <Callout type="info" emoji="ⓘ" styles={{'width': 'fit-content'}}>
          {displayDescription}
        </Callout>
    )
  );
}

export default Description;
