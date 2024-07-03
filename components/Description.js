// components/Description.js
import { useConfig } from 'nextra-theme-docs';
import { Callout } from 'nextra/components';

export function Description({ description }) {
  const { frontMatter } = useConfig();
  const displayDescription = description || frontMatter.description;

  return (
    displayDescription && (
      <Callout type="info" emoji="ⓘ" style={{ width: 'fit-content' }}>
        <p>{displayDescription}</p>
      </Callout>
    )
  );
}

export default Description;
