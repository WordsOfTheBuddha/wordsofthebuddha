import { useConfig } from "nextra-theme-docs";
import { useRouter } from 'next/router';

export function Title() {
  const { frontMatter } = useConfig();
  const router = useRouter();
  const { asPath } = router;

  // Split the path and get the last segment
  const pathSegments = asPath.split('/');
  const pageName = pathSegments[pathSegments.length - 1];

return (
        <h2 className="nx-font-semibold nx-tracking-tight nx-text-slate-900 dark:nx-text-slate-100 nx-mt-10 nx-border-b nx-pb-1 nx-text-3xl nx-border-neutral-200/70 contrast-more:nx-border-neutral-400 dark:nx-border-primary-100/10 contrast-more:dark:nx-border-neutral-400">{frontMatter.title || pageName}</h2>
);
}