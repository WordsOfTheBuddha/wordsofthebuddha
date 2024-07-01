import { useConfig } from "nextra-theme-docs";
import { Callout } from "nextra/components";

export function Description() {
  const { frontMatter } = useConfig();

  return (
    frontMatter.description && (
      <Callout type="info" emoji="ⓘ" style={{"width": "fit-content"}}>
        <p>{frontMatter.description}</p>
      </Callout>
    )
  );
}
